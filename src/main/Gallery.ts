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

export interface IndexingOptionsForPreexistences {
  /** Fetching count of SELECT query at once (Default: 1000) */
  fetchCount: number;
}

export interface IndexingStepForPreexistences {
  /** Total count of files to process */
  totalCount: number;
  /** Processed count of files */
  processedCount: number;
  /** Detail of processed file at this time */
  processedInfo?: {
    path: string;
  } & (
    | {
        result:
          | "no-big-change"
          | "item-lost"
          | "found-lost-items-file-and-updated"
          | "found-lost-items-candidate-file"
          | "item-updated";
      }
    | { result: "error"; error: string }
  );
}

export interface IndexingOptionsForNewFiles {
  /** Bulk count of INSERT query (Default: 100) */
  bulkCount: number;
}

export interface IndexingStepForNewFiles {
  /** Total count of files to process */
  totalCount: number;
  /** Processed count of files */
  processedCount: number;
  /** Detail of processed file at this time */
  processedInfo?: {
    path: string;
  } & (
    | { result: "item-added" | "found-lost-items-file-and-updated" }
    | { result: "found-lost-item-candidate-file"; lostItemPaths: string[] }
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
  /** Returns a generator that updates already indexed items one by one.
   * @yields
   * First yield object has `totalCount` and `processedCount` only.
   * After it, the generator yields an object containing `processedInfo` for each indexing item
   * @example
   * for await (const step of generateIndexingSequenceForPreexistences()) {
   *   if (step.processedInfo === undefined) {
   *     // This step is the first one that contains `totalCount` and `processedCount` only.
   *   }
   *   if (step.processedInfo?.result === "no-big-change") {
   *     // The item has been passed through with no changes or it was updated mtime only.
   *   }
   *   if (step.processedInfo?.result === "item-lost") {
   *     // The corresponding file to the item has been lost on the actual file system.
   *   }
   *   if (step.processedInfo?.result === "found-lost-items-file-and-updated") {
   *     // The item's lost file has been discovered so it updated the attribute `lost` to false.
   *   }
   *   if (step.processedInfo?.result === "found-lost-items-candidate-file") {
   *     // The item's lost file has been discovered however the hash is different.
   *     // These items may not be the same as the previously existing file.
   *     // Therefore it needs the user's verification.
   *   }
   *   if (step.processedInfo?.result === "item-updated") {
   *     // The corresponding file to the item has been changed so the item has been updated.
   *   }
   *   if (step.processedInfo?.result === "error") {
   *     // An error has been thrown.
   *     const message = step.processedInfo.error;
   *   }
   * }
   */
  async *generateIndexingSequenceForPreexistences(
    options?: IndexingOptionsForPreexistences
  ): AsyncGenerator<IndexingStepForPreexistences> {
    const {
      path: galleryPath,
      models: { item: Item },
    } = this;
    const { fetchCount = 1000 } = options ?? {};

    const step: IndexingStepForPreexistences = {
      totalCount: await Item.count(),
      processedCount: 0,
    };

    yield { ...step };

    let lastProcessedItemId = 0;
    let lastFetchedItemsCount = 0;
    do {
      const fetchedItems = await Item.findAll({
        attributes: [
          "id",
          "type",
          "directory",
          "filename",
          "mtime",
          "timeMode",
          "size",
          "hash",
          "lost",
          "thumbnailPath",
          "previewVideoPath",
        ],
        order: Sequelize.col("id"),
        where: {
          id: { [Op.gt]: lastProcessedItemId },
        },
        limit: fetchCount,
        raw: true,
      });
      lastProcessedItemId = fetchedItems[fetchedItems.length - 1]?.id;
      lastFetchedItemsCount = fetchedItems.length;
      for (const item of fetchedItems) {
        step.processedCount += 1;
        const relativeFilePath = nodePath.join(item.directory, item.filename);
        try {
          const fullFilePath = nodePath.join(galleryPath, relativeFilePath);
          try {
            // Check the file is exists or not.
            await nodeFs.promises.access(fullFilePath);
          } catch (error) {
            if (error.code === "ENOENT") {
              // If the file does not exists.
              if (item.lost) {
                // If the item is `lost: true`
                yield {
                  ...step,
                  processedInfo: {
                    path: relativeFilePath,
                    result: "no-big-change",
                  },
                };
                continue;
              } else {
                // If the item is `lost: false` then update it to `lost: true`
                await Item.update({ lost: true }, { where: { id: item.id }, sideEffects: false });
                yield {
                  ...step,
                  processedInfo: {
                    path: relativeFilePath,
                    result: "item-lost",
                  },
                };
                continue;
              }
            } else {
              throw error;
            }
          }
          const fileHash = await getFileHash(fullFilePath);
          if (item.lost && item.hash === fileHash) {
            // If the item is `lost: true` and the file is exists with same hash
            // Then update it to `lost: false`
            const fileInfo = await getFileInfo(fullFilePath);
            const [updatedCount] = await Item.update(
              {
                lost: false,
                mtime: fileInfo.mtime,
                ...(item.timeMode === "MTIME" && { time: fileInfo.mtime }),
              },
              { where: { id: item.id, lost: true }, sideEffects: false }
            );
            if (updatedCount === 0) {
              // Failed to update due to some unexpected situation.
              // (like the user modified this item while the indexing is in progress)
              // these situations should not be handled as an error.
              // It just ignores this item instead.
              yield {
                ...step,
                processedInfo: {
                  path: relativeFilePath,
                  result: "no-big-change",
                },
              };
              continue;
            } else {
              // Updated item successfully
              yield {
                ...step,
                processedInfo: {
                  path: relativeFilePath,
                  result: "found-lost-items-file-and-updated",
                },
              };
              continue;
            }
          }

          if (item.lost && item.hash !== fileHash) {
            // If the item is `lost: true` and the file is exists but different hash
            yield {
              ...step,
              processedInfo: {
                path: relativeFilePath,
                result: "found-lost-items-candidate-file",
              },
            };
            continue;
          }
          const fileInfo = await getFileInfo(fullFilePath);
          const isMtimeOrSizeDifferent =
            item.mtime !== fileInfo.mtime || item.size !== fileInfo.size;
          if (!isMtimeOrSizeDifferent) {
            // If the items mtile and size are both same
            // then it does not need any update.
            yield {
              ...step,
              processedInfo: {
                path: relativeFilePath,
                result: "no-big-change",
              },
            };
            continue;
          }
          const shouldBeUpdated = item.size !== fileInfo.size || item.hash !== fileHash;
          if (!shouldBeUpdated) {
            // If the items size and hash are both same but the mtime is different
            // Then update the mtime only.
            await Item.update(
              {
                mtime: fileInfo.mtime,
                ...(item.timeMode === "MTIME" && { time: fileInfo.mtime }),
              },
              { where: { id: item.id }, sideEffects: false }
            );
            yield {
              ...step,
              processedInfo: {
                path: relativeFilePath,
                result: "no-big-change",
              },
            };
            continue;
          }
          let width: number, height: number;
          let duration: number = null;
          let time = fileInfo.mtime;
          let timeMode: Models.Item["timeMode"] = "MTIME";
          if (item.type === "IMG") {
            const imageInfo = await getImageInfo(fullFilePath);
            width = imageInfo.width;
            height = imageInfo.height;
            if (imageInfo.taggedTime instanceof Date) {
              timeMode = "METAD";
              time = imageInfo.taggedTime;
            }
          } else if (item.type === "VID") {
            const videoInfo = await getVideoInfo(fullFilePath);
            width = videoInfo.width;
            height = videoInfo.height;
            duration = videoInfo.duration;
            if (videoInfo.taggedTime instanceof Date) {
              timeMode = "METAD";
              time = videoInfo.taggedTime;
            }
          } else {
            // This code will never be executed
            throw new Error("Unexpected media type.");
          }

          await Item.update(
            {
              hash: fileHash,
              size: fileInfo.size,
              width,
              height,
              duration,
              mtime: fileInfo.mtime,
              time,
              timeMode,
              thumbnailBase64: null,
              thumbnailPath: null,
              previewVideoPath: null,
            },
            { where: { id: item.id }, sideEffects: false }
          );
          yield {
            ...step,
            processedInfo: {
              path: relativeFilePath,
              result: "item-updated",
            },
          };
        } catch (error) {
          yield {
            ...step,
            processedInfo: {
              path: relativeFilePath,
              result: "error",
              error: isDev ? error.stack : error.toString(),
            },
          };
        }
      }
    } while (lastFetchedItemsCount > 0);
  }

  /** Returns a generator that finds new files those not indexed before and indexes them one by one.
   * @yields
   * First yield object has `totalCount` and `processedCount` only.
   * After it, the generator yields an object containing `processedInfo` for each indexing item
   * @example
   * for await (const step of generateIndexingSequenceForNewFiles()) {
   *   // The processed count does not always increase by one.
   *   if (step.processedInfo === undefined) {
   *     // This step is the first one that contains `totalCount` and `processedCount` only.
   *   }
   *   if (step.processedInfo?.result === "item-added") {
   *      // The file has been indexd newly.
   *   }
   *   if (step.processedInfo?.result === "found-lost-items-file-and-updated") {
   *     // Some item's lost file has been discovered
   *     // so the item's attribute `lost` has been updated to false.
   *   }
   *   if (step.processedInfo?.result === "found-lost-item-candidate-file") {
   *     // There are at least one lost items that have the same hash with the file hash.
   *     // But these items have different path so the generator can't assert the file is lost one.
   *     // Therefore the file must be verified by the user.
   *     const lostItemPaths = step.processedInfo.lostItemPaths
   *   }
   *   if (step.processedInfo?.result === "error") {
   *     // An error has been thrown.
   *     const message = step.processedInfo.error;
   *   }
   * }
   */
  async *generateIndexingSequenceForNewFiles(
    options?: IndexingOptionsForNewFiles
  ): AsyncGenerator<IndexingStepForNewFiles> {
    const {
      path: galleryPath,
      models: { item: Item },
    } = this;
    const { bulkCount = 100 } = options ?? {};

    const imageExtensions = (await this.getConfig("imageExtensions")).map(ext => ext.toLowerCase());
    const videoExtensions = (await this.getConfig("videoExtensions")).map(ext => ext.toLowerCase());
    const childFilesFilter: PathFilteringOptions = {
      ignoreDirectories: [INDEXING_DIRNAME],
      acceptingExtensions: union(imageExtensions, videoExtensions),
    };

    const allChildFilesCount = await countAllChildFiles(galleryPath, childFilesFilter);
    const allNonLostItemsCount = await Item.count({ where: { lost: false } });
    const step: IndexingStepForNewFiles = {
      totalCount: allChildFilesCount - allNonLostItemsCount,
      processedCount: 0,
    };

    yield { ...step };

    /** Key: *hash*, Value: *already indexed lost item's path* */
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
      map: null as Map<string, Pick<Models.Item, "lost" | "hash" | "timeMode">>,
    };

    let itemsToBulkCreate: Models.ItemCreationAttributes[] = [];

    const generator = generateAllChildFileRelativePaths(galleryPath, childFilesFilter);
    for await (const relativeFilePath of generator) {
      try {
        const extension = nodePath.extname(relativeFilePath).toLowerCase().slice(1);
        const hasImageExtension = imageExtensions.includes(extension);
        const hasVideoExtension = !hasImageExtension && videoExtensions.includes(extension);
        if (!hasImageExtension && !hasVideoExtension) {
          // This code will never be executed thanks to the generator's reliable integrity.
          throw new Error("Unexpected file extension.");
        }

        const directory = nodePath.join(relativeFilePath, "..");
        if (filenameToItemMapPerDirectory.directory !== directory) {
          // Fetch already indexed items in the same directory of the file
          const map: typeof filenameToItemMapPerDirectory["map"] = new Map();
          (
            await Item.findAll({
              attributes: ["filename", "lost", "hash", "timeMode"],
              where: { directory, lost: true },
              raw: true,
            })
          ).forEach(({ filename, ...attrs }) => map.set(filename, { ...attrs }));
          filenameToItemMapPerDirectory.directory = directory;
          filenameToItemMapPerDirectory.map = map;
        }

        const filename = nodePath.basename(relativeFilePath);
        const preindexedSamePathItem = filenameToItemMapPerDirectory.map.get(filename) ?? null;
        if (preindexedSamePathItem?.lost === false) {
          // If there is already indexed item with same path, and it is `lost: false`
          // then continue to the next file.
          continue;
        } else {
          step.processedCount += 1;
        }

        const fullFilePath = nodePath.join(galleryPath, relativeFilePath);
        const hash = await getFileHash(fullFilePath);
        const fileInfo = await getFileInfo(fullFilePath);
        if (preindexedSamePathItem?.lost === true) {
          // If there is already indexed item with same path, and it is `lost: true`
          if (preindexedSamePathItem.hash === hash) {
            // If the hash is same then update it's lost value to false
            const [updatedCount] = await Item.update(
              {
                lost: false,
                mtime: fileInfo.mtime,
                ...(preindexedSamePathItem.timeMode === "MTIME" && { time: fileInfo.mtime }),
              },
              {
                where: { directory, filename, hash, lost: true },
                sideEffects: false,
              }
            );
            if (updatedCount === 0) {
              // Failed to update due to some unexpected situation.
              // (like the user modified this item while the indexing is in progress)
              // these situations should not be handled as an error.
              continue;
            } else {
              // Updated item successfully
              yield {
                ...step,
                processedInfo: {
                  path: relativeFilePath,
                  result: "found-lost-items-file-and-updated",
                },
              };
              continue;
            }
          } else {
            // If the hash is different then notify it as a candidate.
            yield {
              ...step,
              processedInfo: {
                path: relativeFilePath,
                result: "found-lost-item-candidate-file",
                lostItemPaths: [relativeFilePath],
              },
            };
            continue;
          }
        }
        const preindexedSameHashLostItemPathSet = hashToLostItemPathSetMap.get(hash);
        preindexedSameHashLostItemPathSet?.delete(relativeFilePath);
        if (preindexedSameHashLostItemPathSet?.has(relativeFilePath)) {
          // If there are already indexed items with same hash but different path, and it is `lost: false`
          // then notify them as a candidates.
          yield {
            ...step,
            processedInfo: {
              path: relativeFilePath,
              result: "found-lost-item-candidate-file",
              lostItemPaths: [...preindexedSameHashLostItemPathSet.values()],
            },
          };
          continue;
        }
        let type: Models.Item["type"];
        let width: number, height: number;
        let duration: number = null;
        let time = fileInfo.mtime;
        let timeMode: Models.Item["timeMode"] = "MTIME";
        if (hasImageExtension) {
          type = "IMG";
          const imageInfo = await getImageInfo(fullFilePath);
          width = imageInfo.width;
          height = imageInfo.height;
          if (imageInfo.taggedTime instanceof Date) {
            timeMode = "METAD";
            time = imageInfo.taggedTime;
          }
        } else if (hasVideoExtension) {
          type = "VID";
          const videoInfo = await getVideoInfo(fullFilePath);
          width = videoInfo.width;
          height = videoInfo.height;
          duration = videoInfo.duration;
          if (videoInfo.taggedTime instanceof Date) {
            timeMode = "METAD";
            time = videoInfo.taggedTime;
          }
        } else {
          // This code will never be executed thanks to the generator's reliable integrity.
          throw new Error("Unexpected media type.");
        }

        itemsToBulkCreate.push({
          type,
          hash,
          size: fileInfo.size,
          directory,
          filename,
          width,
          height,
          duration,
          mtime: fileInfo.mtime,
          time,
          timeMode,
        });
        if (itemsToBulkCreate.length >= bulkCount) {
          try {
            await Item.bulkCreate(itemsToBulkCreate);
          } finally {
            itemsToBulkCreate = [];
          }
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
              result: "error",
              error: "File is not exists",
            },
          };
        } else {
          // If some unexpected error is thrown.
          yield {
            ...step,
            processedInfo: {
              path: relativeFilePath,
              result: "error",
              error: isDev ? error.stack : error.toString(),
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
