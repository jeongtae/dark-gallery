import nodeFs from "fs";
import { cloneDeep, union } from "lodash";
import nodePath from "path";
import rimraf from "rimraf";
import { Op, Sequelize } from "sequelize";
import { promisify } from "util";
import { isDev } from "./environments";
import type { GalleryConfigs, GalleryPathInfo } from "./ipc";
import { createSequelize, Models } from "./sequelize";
import {
  countAllChildFiles,
  generateAllChildFileRelativePaths,
  getFileHash,
  getFileInfo,
  getImageInfo,
  getResizedImageSize,
  getResizedWebpImageBufferOfImageFile,
  getVideoInfo,
  PathFilteringOptions,
  writeResizedWebpImageFileOfImageFile,
  writeResizedWebpImageFileOfVideoFile,
} from "./indexing";

const INDEXING_DIRNAME = ".darkgallery";
const DEFAULT_CONFIGS: Readonly<GalleryConfigs> = {
  title: "",
  description: "",
  createdAt: new Date(0),
  imageExtensions: ["jpg", "jpeg", "gif", "png", "bmp", "webp"],
  videoExtensions: ["webm", "mp4", "mov", "avi"],
};

/** 갤러리 인덱싱 폴더의 절대경로를 얻습니다.
 * @param galleryPath 갤러리의 절대경로
 * @returns 인덱싱 폴더의 절대경로
 */
function buildIndexDirectoryPath(galleryPath: string) {
  return nodePath.join(galleryPath, INDEXING_DIRNAME);
}

/** 갤러리 데이터베이스 파일의 절대경로를 얻습니다.
 * @param galleryPath 갤러리의 절대경로
 * @returns 데이터베이스 파일의 절대경로
 */
function buildSqliteFilePath(galleryPath: string) {
  return nodePath.join(galleryPath, INDEXING_DIRNAME, "db.sqlite");
}

type ThumbnailPaths = {
  /** 썸네일이 저장되어야할 디렉터리 절대경로 */
  directory: string;
  /** WEBP 이미지 썸네일의 절대 경로 */
  image: string;
  /** WEBM 프리뷰 비디오의 절대 경로 */
  video: string;
};
/** 갤러리 아이템 썸네일 파일의 절대경로 목록을 얻습니다.
 * @param galleryPath 갤러리의 절대경로
 * @param hash 아이템의 해시값
 * @returns 썸네일 파일의 절대경로를 포함하는 객체
 */
function buildThumbnailPathsForHash(galleryPath: string, hash: string): ThumbnailPaths {
  const indexPath = buildIndexDirectoryPath(galleryPath);
  const dirPath = nodePath.join(indexPath, "thumbs", hash[0]);
  return {
    directory: dirPath,
    image: nodePath.join(dirPath, hash + ".webp"),
    video: nodePath.join(dirPath, hash + ".webm"),
  };
}

type ImageIndexingData = {
  width: number;
  height: number;
  /** 이미지의 메타데이터에 기록된 시간 */
  time?: Date;
  /** DB에 저장할 WEBP 썸네일의 Base64 문자열 */
  thumbnailBase64: string;
};
/** 이미지 파일의 썸네일 이미지를 만들고, DB에 저장할 썸네일의 Base64 문자열을 포함한 이미지 인덱싱 정보를 반환한다.
 * @param filePath 이미지 파일의 절대경로
 * @param thumbnailPath 썸네일 저장할 절대경로 (WEBP 확장자)
 * @returns 이미지 인덱싱 정보
 */
async function processImageIndexing(
  filePath: string,
  thumbnailPath: string
): Promise<ImageIndexingData> {
  const { width, height, taggedTime: time } = await getImageInfo(filePath);

  const bigThumbnailSize = getResizedImageSize(width, height, 256, 3);
  const smallThumbnailSize = getResizedImageSize(width, height, 20, 3);

  await writeResizedWebpImageFileOfImageFile(
    filePath,
    thumbnailPath,
    bigThumbnailSize.width,
    bigThumbnailSize.height,
    60
  );
  const thumbnailBuffer = await getResizedWebpImageBufferOfImageFile(
    thumbnailPath,
    smallThumbnailSize.width,
    smallThumbnailSize.height,
    50
  );
  const thumbnailBase64 = thumbnailBuffer.toString("base64");

  return {
    width,
    height,
    thumbnailBase64,
    ...(time && { time }),
  };
}

type VideoIndexingData = {
  width: number;
  height: number;
  /** 비디오의 길이 (밀리초 단위) */
  duration: number;
  /** 비디오의 메타데이터에 기록된 시간 */
  time?: Date;
  /** DB에 저장할 WEBP 썸네일의 Base64 문자열 */
  thumbnailBase64: string;
};
/** 비디오 파일의 썸네일 비디오를 만들고, DB에 저장할 썸네일의 Base64 문자열을 포함한 비디오 인덱싱 정보를 반환한다.
 * @param filePath 비디오 파일의 절대경로
 * @param thumbnailPath 썸네일 저장할 절대경로 (WEBP 확장자)
 * @returns 비디오 인덱싱 정보
 */
async function processVideoIndexing(
  filePath: string,
  thumbnailPath: string
): Promise<VideoIndexingData> {
  const { width, height, duration, taggedTime: time } = await getVideoInfo(filePath);

  const bigThumbnailSize = getResizedImageSize(width, height, 256, 3);
  const smallThumbnailSize = getResizedImageSize(width, height, 20, 3);

  await writeResizedWebpImageFileOfVideoFile(
    filePath,
    thumbnailPath,
    bigThumbnailSize.width,
    bigThumbnailSize.height,
    60
  );
  const thumbnailBuffer = await getResizedWebpImageBufferOfImageFile(
    thumbnailPath,
    smallThumbnailSize.width,
    smallThumbnailSize.height,
    50
  );
  const thumbnailBase64 = thumbnailBuffer.toString("base64");

  return {
    width,
    height,
    duration,
    thumbnailBase64,
    ...(time && { time }),
  };
}

interface GalleryModels {
  item: Models.ItemCtor;
  tag: Models.TagCtor;
  tagGroup: Models.TagGroupCtor;
  config: Models.ConfigCtor;
}

export interface IndexingStepForPreexistences {
  /** 작업할 전체 항목 수 */
  totalCount: number;
  /** 작업한 항목 수 */
  processedCount: number;
  /** 지금 작업한 항목의 정보 */
  processedInfo?: {
    /** 항목의 경로 (갤러리 폴더에 대한 상대경로) */
    path: string;
    error?: string;
    /** DB 상에서 항목의 변경된 필드 (`mtime`의 변경은 표시되지 않음) */
    itemChanged: "no-change" | "hash-and-others" | "lost-only";
    /** DB 상에서 항목의 `lost` 필드 값 */
    itemLost: boolean;
    /** 파일의 존재 여부 */
    fileExists: boolean;
    /** 파일과 항목의 해시 일치 여부 */
    fileHash: "same" | "different" | "estimated-same" | "unknown";
  };
  alt?: {
    path: string;
  } & (
    | {
        result:
          | "item-keep-lost"
          | "item-set-lost"
          | "found-lost-item-and-updated"
          | "found-lost-item-candidate"
          | "no-action"
          | "item-updated-mtime-only"
          | "item-updated";
      }
    | { result: "error"; error: string }
  );
}

// 기존에 사라졌던 항목을 찾기도 하지만, 경로가 다르면 못 한다.
export interface IndexingStepForNewFiles {
  /** 작업할 전체 항목 수 */
  totalCount: number;
  /** 작업한 항목 수 */
  processedCount: number;
  /** 지금 작업한 항목의 정보 */
  processedInfo?: {
    path: string;
  } & (
    | { result: "no-action" | "item-added" | "found-lost-item-and-updated" }
    | { result: "found-lost-item-candidates"; lostItemCandidatePaths: string[] }
    | { result: "error"; error: string }
  );
}

/**
 * 갤러리 폴더와 데이터베이스를 다루는 클래스
 * @implements {Disposable}
 */
export default class Gallery implements Disposable {
  /** 이 갤러리의 SQLite 데이터베이스 파일과 연결된 Sequelize 객체 */
  private sequelize: Sequelize = null;

  /** 기본 설정 객체 */
  private readonly defaultConfigs: Readonly<GalleryConfigs> = {
    ...DEFAULT_CONFIGS,
  };

  /** Sequelize 인스턴스가 생성되었는지 여부 (데이터베이스 연결 여부) */
  get isOpened(): boolean {
    return !!this.sequelize;
  }

  #models: Readonly<GalleryModels>;
  /** 갤러리 데이터베이스에 접근할 수 있는 Sequelize 모델 객체 모음
   * @throws 갤러리 인스턴스를 생성하면 처음 사용하기 전에 `open()` 메서드를 반드시 한 번 실행해야 합니다.
   *         그렇지 않고 이 프로퍼티에 접근하는 경우 에러가 발생합니다.
   */
  get models(): Readonly<GalleryModels> {
    if (this.sequelize === null) {
      throw new Error("The gallery must be opened before accessing its models.");
    }
    return this.#models;
  }

  /** 데이터베이스에 기록된 설정을 모두 가져옵니다.
   * @param key 설정 키
   * @returns 설정 객체
   */
  async getAllConfigs(): Promise<GalleryConfigs> {
    const { config: Config } = this.models;
    const configs = cloneDeep(this.defaultConfigs);
    const rows = await Config.findAll();
    for (const { key, value: jsonValue } of rows) {
      const value = JSON.parse(jsonValue);
      (<any>configs)[key] = value;
    }
    return configs;
  }

  /** 데이터베이스에 기록된 설정을 가져옵니다.
   * @param key 설정 키
   * @returns 설정 값
   */
  async getConfig<K extends keyof GalleryConfigs>(key: K): Promise<GalleryConfigs[K]> {
    const { config: Config } = this.models;
    const row = await Config.findByPk(key);
    if (!row) {
      return this.defaultConfigs[key];
    } else {
      const jsonValue = row.value;
      return JSON.parse(jsonValue);
    }
  }

  /** 데이터베이스에 설정을 기록합니다.
   * @param key 설정 키
   * @param value 설정 값
   */
  async setConfig<K extends keyof GalleryConfigs>(key: K, value: GalleryConfigs[K]) {
    const { config: Config } = this.models;
    const jsonValue = JSON.stringify(value);
    const [affectedCount] = await Config.update({ value: jsonValue }, { where: { key } });
    if (affectedCount === 0) {
      await Config.create({ key, value: jsonValue });
    }
  }

  /** 갤러리의 인덱스 폴더를 삭제하여, 갤러리를 초기화합니다.
   * @returns 초기화 작업의 성공 여부
   */
  static async resetGallery(galleryPath: string): Promise<boolean> {
    try {
      const galleryIndexPath = buildIndexDirectoryPath(galleryPath);
      await promisify(rimraf)(galleryIndexPath);
      return true;
    } catch {}
    return false;
  }

  /** 주어진 경로를 갤러리의 관점에서 조사합니다.
   * @returns 조사 결과
   */
  static async getGalleryPathInfo(galleryPath: string): Promise<GalleryPathInfo> {
    const { R_OK, W_OK } = nodeFs.constants;
    const result: GalleryPathInfo = {
      isAbsolute: nodePath.isAbsolute(galleryPath),
      exists: false,
    };

    // 존재하는지 확인
    try {
      await nodeFs.promises.access(galleryPath);
      result.exists = true;
    } catch {
      return result;
    }

    // 디렉터리인지 확인
    const galleryPathStat = await nodeFs.promises.lstat(galleryPath);
    result.isDirectory = galleryPathStat.isDirectory();
    if (!result.isDirectory) {
      return result;
    }

    // 디렉터리의 권한 확인
    try {
      result.directoryHasReadPermission = false;
      await nodeFs.promises.access(galleryPath, R_OK);
      result.directoryHasReadPermission = true;

      result.directoryHasWritePermission = false;
      await nodeFs.promises.access(galleryPath, W_OK);
      result.directoryHasWritePermission = true;
    } catch {}

    // 다른 갤러리의 자식 디렉터리인지 확인
    if (result.isAbsolute) {
      const upper = (p: string) => nodePath.join(p, "..");
      let upperLevelPath = galleryPath;
      while (upperLevelPath !== upper(upperLevelPath)) {
        upperLevelPath = upper(upperLevelPath);
        const sqlitePath = buildSqliteFilePath(upperLevelPath);
        try {
          await nodeFs.promises.access(sqlitePath);
          result.isDecendantDirectoryOfGallery = true;
          break;
        } catch {}
      }
    }

    // DB 파일의 존재 및 권한 확인
    const sqlitePath = buildSqliteFilePath(galleryPath);
    try {
      await nodeFs.promises.access(sqlitePath);
      result.isGallery = true;
      await nodeFs.promises.access(sqlitePath, R_OK);
      result.sqliteFileHasReadPermission = true;
      await nodeFs.promises.access(sqlitePath, W_OK);
      result.sqliteFileHasWritePermission = true;
    } catch {}

    return result;
  }

  /** 주어진 경로의 갤러리 인스턴스를 생성합니다.
   * 사용하기 전에 `open()`메서드를 호출하여 데이터베이스 파일에 연결되어야합니다.
   * @param path 갤러리의 경로 (상대경로 허용)
   */
  constructor(readonly path: string) {
    this.path = nodePath.resolve(path);
  }

  /** 갤러리 데이터베이스 파일을 열어서 연결합니다. */
  async open() {
    if (this.isOpened) {
      return;
    }

    // 열 수 있는 갤러리인지 확인
    const pathInfo = await Gallery.getGalleryPathInfo(this.path);
    if (
      !pathInfo.exists ||
      pathInfo.isDirectory === false ||
      !pathInfo.directoryHasWritePermission
    ) {
      throw new Error();
    }

    // SQLite 파일 없으면 새로 생성하는 갤러리라고 가정
    let isNew = false;
    const sqlitePath = buildSqliteFilePath(this.path);
    try {
      await nodeFs.promises.access(sqlitePath);
    } catch (error) {
      if (error.code === "ENOENT") {
        isNew = true;
      } else {
        throw error;
      }
    }

    // 새로 생성하는 갤러리인데, 인덱싱 폴더가 없으면 생성
    if (isNew) {
      const indexPath = buildIndexDirectoryPath(this.path);
      try {
        nodeFs.promises.access(indexPath);
      } catch (error) {
        if (error.code === "ENOENT") {
          await nodeFs.promises.mkdir(indexPath, { recursive: true });
        } else {
          throw error;
        }
      }
    }

    // Sequelize 객체 생성
    const sequelize = createSequelize(sqlitePath);
    const { item, tag, tagGroup, config } = sequelize.models as any;
    this.#models = {
      item,
      tag,
      tagGroup,
      config,
    };
    this.sequelize = sequelize;

    // 새로 생성하는 갤러리면 Sequelize 객체를 Sync 호출하고 데이터베이스에 기본설정값 입력
    if (isNew) {
      await sequelize.sync();
      const { title } = this.defaultConfigs;
      const createdAt = new Date();
      await this.setConfig("title", title);
      await this.setConfig("createdAt", createdAt);
    }
  }

  // async indexForExistingOne() {}
  /** 기존에 인덱싱한 항목에 대해 업데이트를 하나씩 수행하는 제너레이터를 반환합니다.
   * @yields
   * 처음에 열거되는 객체는 `totalCount`와 `processedCount`만 포함합니다.
   * 이후에는 항목을 하나 거칠 때마다 열거되며, 항목에 대한 상세 정보는 `processedInfo`에서 확인이 가능합니다.
   * @example
   * for (const step of generateIndexingSequenceForPreexistences()) {
   *   if (step.processedInfo?.itemChanged !== "no-change") {
   *     // 실제 파일이 기존에 인덱싱된 항목에 기록된 것과 다르다면 적절하게 업데이트되며,
   *     // 변경된 내용은 `processedInfo.itemChanged`에서 알 수 있습니다.
   *     // 단, `mtime`의 변경은 알 수 없습니다.
   *   }
   *   if (step.processedInfo?.itemChanged === "lost-only") {
   *     // 파일을 찾았거나, 파일이 사라진 경우를 알 수 있습니다.
   *     // `lost` 필드의 값이 적절하게 변경됩니다.
   *   }
   *   if (step.processedInfo?.fileExists && !step.processedInfo.itemLost) {
   *     // 파일을 찾았어도, 파일의 해시가 항목에 기록된 해시와 다를 경우, lost 필드는 변경되지 않습니다.
   *     // 이러한 파일들은 별도의 검수 과정을 거치고, ??? 함수를 이용해 강제 업데이트 해야합니다.
   *   }
   *   ...
   * }
   */
  async *generateIndexingSequenceForPreexistences(): AsyncGenerator<IndexingStepForPreexistences> {
    const {
      path: galleryPath,
      models: { item: Item },
    } = this;

    const totalCount = await Item.count();
    let processedCount = 0;
    yield { totalCount, processedCount };
    let lastId = 0;
    let lastResultCount = 0;
    do {
      const items = await Item.findAll({
        attributes: [
          "id",
          "type",
          "directory",
          "filename",
          "mtime",
          "size",
          "hash",
          "lost",
          "thumbnailPath",
          "previewVideoPath",
        ],
        order: Sequelize.col("id"),
        where: {
          id: { [Op.gt]: lastId },
        },
        limit: 1000,
        raw: true,
      });
      lastId = items[items.length - 1]?.id;
      lastResultCount = items.length;
      for (const item of items) {
        processedCount += 1;
        const step: IndexingStepForPreexistences = {
          totalCount,
          processedCount,
        };
        const relativeFilePath = nodePath.join(item.directory, item.filename);
        try {
          const fullFilePath = nodePath.join(galleryPath, relativeFilePath);
          try {
            // 파일의 존재 확인
            await nodeFs.promises.access(fullFilePath);
          } catch (error) {
            if (error.code === "ENOENT") {
              if (item.lost) {
                // 원래 lost: true였던 항목인데, 여전히 파일이 없음
                yield {
                  ...step,
                  processedInfo: {
                    path: relativeFilePath,
                    itemChanged: "no-change",
                    itemLost: true,
                    fileExists: false,
                    fileHash: "unknown",
                  },
                };
                continue;
              } else {
                // 원래는 lost: false였는데, 갑자기 파일이 없음
                await Item.update({ lost: true }, { where: { id: item.id }, sideEffects: false });
                yield {
                  ...step,
                  processedInfo: {
                    path: relativeFilePath,
                    itemChanged: "lost-only",
                    itemLost: true,
                    fileExists: false,
                    fileHash: "unknown",
                  },
                };
                continue;
              }
            } else {
              throw error;
            }
          }
          if (item.lost) {
            const fileHash = await getFileHash(fullFilePath);
            if (item.hash === fileHash) {
              // 원래 lost: true였던 항목인데, 같은 위치에 똑같은 파일을 찾았음
              // TODO: time 필드
              const fileInfo = await getFileInfo(fullFilePath);
              await Item.update(
                { mtime: fileInfo.mtime, lost: false },
                { where: { id: item.id }, sideEffects: false }
              );
              yield {
                ...step,
                processedInfo: {
                  path: relativeFilePath,
                  itemChanged: "no-change",
                  itemLost: true,
                  fileExists: true,
                  fileHash: "different",
                },
              };
              continue;
            } else {
              // 원래 lost: true였던 항목인데, 같은 경로의 파일을 찾았지만 해시가 다름
              yield {
                ...step,
                processedInfo: {
                  path: relativeFilePath,
                  itemChanged: "no-change",
                  itemLost: true,
                  fileExists: true,
                  fileHash: "different",
                },
              };
              continue;
            }
          }
          const fileInfo = await getFileInfo(fullFilePath);
          const isMtimeOrSizeDifferent =
            item.mtime !== fileInfo.mtime || item.size !== fileInfo.size;
          if (!isMtimeOrSizeDifferent) {
            // 크기나 날짜가 같으므로 업데이트가 필요하지 않음
            yield {
              ...step,
              processedInfo: {
                path: relativeFilePath,
                itemChanged: "no-change",
                itemLost: false,
                fileExists: true,
                fileHash: "estimated-same",
              },
            };
            continue;
          }
          const fileHash = await getFileHash(fullFilePath);
          const shouldBeUpdated = item.hash !== fileHash;
          if (!shouldBeUpdated) {
            // mtime이 다르지만 해시가 같으므로, mtime만 갱신함
            // TODO: 그렇다면 timeType 필드 추가하여, time까지 바꿔야하나 체크
            await Item.update(
              { mtime: fileInfo.mtime },
              { where: { id: item.id }, sideEffects: false }
            );
            yield {
              ...step,
              processedInfo: {
                path: relativeFilePath,
                itemChanged: "no-change",
                itemLost: true,
                fileExists: true,
                fileHash: "same",
              },
            };
            continue;
          }
          const thumbnailFullPaths = buildThumbnailPathsForHash(galleryPath, fileHash);
          const updatingItem: Partial<Models.ItemAttributes> = {
            ...fileInfo,
            hash: fileHash,
            time: fileInfo.mtime,
            thumbnailPath: nodePath.relative(galleryPath, thumbnailFullPaths.image),
            lost: false,
          };
          if (!nodeFs.existsSync(thumbnailFullPaths.directory)) {
            await nodeFs.promises.mkdir(thumbnailFullPaths.directory, { recursive: true });
          }
          // 새로운 썸네일 생성 및 메타데이터의 시간 할당
          switch (item.type) {
            case "IMG":
              const imageIndexingData = await processImageIndexing(
                fullFilePath,
                thumbnailFullPaths.image
              );
              // if (imageIndexingData.time) imageIndexingData.time = imageIndexingData.time;
              Object.assign(updatingItem, imageIndexingData);
              break;
            case "VID":
              const videoIndexingData = await processVideoIndexing(
                fullFilePath,
                thumbnailFullPaths.video
              );
              // videoIndexingData.time = videoIndexingData.time || updatingItem.time;
              Object.assign(updatingItem, videoIndexingData);
              break;
            default:
              throw new Error("Unknown media type.");
          }
          // DB에 반영
          await Item.update(updatingItem, { where: { id: item.id }, sideEffects: false });
          // 기존의 썸네일 파일은 삭제
          if (item.thumbnailPath) {
            try {
              await nodeFs.promises.unlink(nodePath.join(galleryPath, item.thumbnailPath));
            } catch {}
          }
          if (item.previewVideoPath) {
            try {
              await nodeFs.promises.unlink(nodePath.join(galleryPath, item.previewVideoPath));
            } catch {}
          }
          yield {
            ...step,
            processedInfo: {
              path: relativeFilePath,
              itemChanged: "hash-and-others",
              itemLost: false,
              fileExists: true,
              fileHash: "different",
            },
          };
        } catch (error) {
          yield {
            ...step,
            processedInfo: {
              path: relativeFilePath,
              error: isDev ? error.stack : error.toString(),
              itemChanged: "no-change",
              itemLost: item.lost,
              fileExists: true,
              fileHash: "unknown",
            },
          };
        }
      }
    } while (lastResultCount > 0);
  }

  // TODO: 중간에 누가 지워질지 모른다. 누가 생기진 않겠지만 누가 지워지기는 하니까 주의.
  /** 기존에 인덱싱되지 않은 파일을 찾아, 인덱싱 항목에 하나씩 추가하는 제너레이터를 반환합니다. */
  async *generateIndexingSequenceForNewFiles(
    bulkCount = 100
  ): AsyncGenerator<IndexingStepForNewFiles> {
    const {
      path: galleryPath,
      models: { item: Item },
    } = this;

    const imageExtensions = (await this.getConfig("imageExtensions")).map(ext => ext.toLowerCase());
    const videoExtensions = (await this.getConfig("videoExtensions")).map(ext => ext.toLowerCase());
    const childFilesFilter: PathFilteringOptions = {
      ignoreDirectories: [INDEXING_DIRNAME],
      acceptingExtensions: union(imageExtensions, videoExtensions),
    };

    const allChildFilesCount = await countAllChildFiles(galleryPath, childFilesFilter);
    const allNonLostItemsCount = await Item.count({ where: { lost: false } });
    const totalCount = allChildFilesCount - allNonLostItemsCount;
    let processedCount = 0;
    yield { totalCount, processedCount };

    /** Key: *hash*, Value: *preindexed lost item's path* */
    const hashToLostItemPathSetMap = new Map<string, Set<string>>();
    (
      await Item.findAll({
        attributes: ["hash", "directory", "filename"],
        raw: true,
        where: { lost: true },
      })
    ).forEach(({ hash, directory, filename }) => {
      directory = directory.replace(nodePath.posix.sep, nodePath.sep);
      const path = nodePath.join(directory, filename);
      const set = hashToLostItemPathSetMap.get(hash);
      if (set) {
        set.add(path);
      } else {
        hashToLostItemPathSetMap.set(hash, new Set([path]));
      }
    });

    const filenameToItemMapPerDirectory = {
      directory: null as string,
      //TODO: which time field
      map: null as Map<string, Pick<Models.Item, "lost" | "hash" | "time">>,
    };

    let itemsToBulkCreate: Models.ItemCreationAttributes[] = [];

    const generator = generateAllChildFileRelativePaths(galleryPath, childFilesFilter);
    for await (const relativeFilePath of generator) {
      const step: IndexingStepForNewFiles = {
        totalCount,
        processedCount,
      };
      try {
        const extension = nodePath.extname(relativeFilePath).toLowerCase().slice(1);
        const hasImageExtension = imageExtensions.includes(extension);
        const hasVideoExtension = !hasImageExtension && videoExtensions.includes(extension);
        if (!hasImageExtension && !hasVideoExtension) {
          // This code will never be executed thanks to the generator's reliable integrity.
          continue;
        }

        const directory = nodePath.join(relativeFilePath, "..");
        if (filenameToItemMapPerDirectory.directory !== directory) {
          // Fetch preindexed items in the same directory of the file
          const map: typeof filenameToItemMapPerDirectory["map"] = new Map();
          (
            await Item.findAll({
              attributes: ["filename", "lost", "hash", "time"],
              where: { directory, lost: true },
              raw: true,
            })
          ).forEach(({ filename, ...attrs }) => map.set(filename, { ...attrs }));
          filenameToItemMapPerDirectory.directory = directory;
          filenameToItemMapPerDirectory.map = map;
        }

        // 1. 이미 동일 경로로 인덱싱된 Non-Lost 항목이 있으면 -> PASS (노카운트)
        // 2. 이미 동일 경로로 인덱싱된 항목이 Lost면?
        //   a. Hash가 같다면 lost:false 처리 및 time갱신
        //   b. Hash가 다르다면 사용자에게 lost:false로 처리할 후보임을 알림
        // 3. 인덱싱한 항목중에 경로는 다르지만 Hash가 같으며 Lost인게 있다면?
        //   a. 그게 이 파일일 수도 있으니 (파일이 이동되어서) lost:false로 처리할 후보임을 알림)
        // 4. 1,2,3을 통과했으면 인덱싱처리!

        const filename = nodePath.basename(relativeFilePath);
        const preindexedSamePathItem = filenameToItemMapPerDirectory.map.get(filename) ?? null;
        if (preindexedSamePathItem?.lost === false) {
          // If there is already indexed item with same path, and it is `lost: false`
          // then continue to the next file.
          continue;
        } else {
          processedCount += 1;
        }

        const fullFilePath = nodePath.join(galleryPath, relativeFilePath);
        const hash = await getFileHash(fullFilePath);
        const fileInfo = await getFileInfo(fullFilePath);
        if (preindexedSamePathItem?.lost === true) {
          // If there is already indexed item with same path, and it is `lost: true`
          if (preindexedSamePathItem.hash === hash) {
            // If the hash is same then update it's lost value to false
            const [updatedCount] = await Item.update(
              { lost: false, mtime: fileInfo.mtime },
              { where: { directory, filename, hash, lost: true } }
            );
            if (updatedCount >= 1) {
              // Updated item successfully
              yield {
                ...step,
                processedInfo: {
                  path: relativeFilePath,
                  result: "found-lost-item-and-updated",
                },
              };
              continue;
            } else {
              // Failed to update due to some unexpected situation.
              // (like the user modified this item while the indexing is in progress)
              // these situations should not be handled as an error.
              continue;
            }
          } else {
            // If the hash is different then notify it as a candidate
            yield {
              ...step,
              processedInfo: {
                path: relativeFilePath,
                result: "found-lost-item-candidates",
                lostItemCandidatePaths: [relativeFilePath],
              },
            };
            continue;
          }
        }
        const preindexedSameHashLostItemPathSet = hashToLostItemPathSetMap.get(hash);
        preindexedSameHashLostItemPathSet?.delete(relativeFilePath);
        if (preindexedSameHashLostItemPathSet?.has(relativeFilePath)) {
          // 후보
          yield {
            ...step,
            processedInfo: {
              path: relativeFilePath,
              result: "found-lost-item-candidates",
              lostItemCandidatePaths: [...preindexedSameHashLostItemPathSet.values()],
            },
          };
          continue;
        }
        const type: Models.Item["type"] = hasImageExtension ? "IMG" : "VID";
        const thumbnailFullPaths = buildThumbnailPathsForHash(galleryPath, hash);
        const newItem: Models.ItemCreationAttributes = {
          ...fileInfo,
          type,
          hash,
          directory,
          filename,
          width: 0,
          height: 0,
          duration: 0,
          time: fileInfo.mtime,
          thumbnailBase64: "",
          thumbnailPath: nodePath.relative(galleryPath, thumbnailFullPaths.image),
        };
        if (!nodeFs.existsSync(thumbnailFullPaths.directory)) {
          await nodeFs.promises.mkdir(thumbnailFullPaths.directory, { recursive: true });
        }
        if (type === "IMG") {
          const imageIndexingData = await processImageIndexing(
            fullFilePath,
            thumbnailFullPaths.image
          );
          // imageIndexingData.time = imageIndexingData.time || newItem.time;
          Object.assign(newItem, imageIndexingData);
        } else {
          const videoIndexingData = await processVideoIndexing(
            fullFilePath,
            thumbnailFullPaths.image
          );
          // videoIndexingData.time = videoIndexingData.time || newItem.time;
          Object.assign(newItem, videoIndexingData);
        }
        itemsToBulkCreate.push(newItem);
        if (itemsToBulkCreate.length >= bulkCount) {
          await Item.bulkCreate(itemsToBulkCreate);
          itemsToBulkCreate = [];
        }
        yield {
          ...step,
          processedInfo: {
            path: relativeFilePath,
            result: "item-added",
          },
        };
      } catch (error) {
        if (error.code === "ENOENT") {
          // If the file is disappeared while indexing it.
          yield {
            ...step,
            processedInfo: {
              path: relativeFilePath,
              result: "no-action",
            },
          };
        } else {
          // If some unexpected error is thrown.
          yield {
            ...step,
            processedInfo: {
              path: relativeFilePath,
              result: "error",
              error: error.toString(),
            },
          };
        }
      }
    }
    if (itemsToBulkCreate.length >= 1) {
      await Item.bulkCreate(itemsToBulkCreate);
    }
  }

  /** 데이터베이스 연결을 닫고 참조를 지웁니다. */
  async dispose() {
    await this.sequelize?.close();
    this.sequelize = null;
  }
}
