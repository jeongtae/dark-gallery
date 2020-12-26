import nodePath from "path";
import nodeFs from "fs";
import { promisify } from "util";
import rimraf from "rimraf";
import { difference, union, cloneDeep } from "lodash";
import type { PromiseValue } from "type-fest";
import { createSequelize, Models, Sequelize } from "./sequelize";
import { GalleryPathInfo, GalleryConfigs } from "./ipc";
import {
  getAllChildFilePaths,
  getFileHash,
  getFileInfo,
  getImageInfo,
  getVideoInfo,
  getResizedImageSize,
  writeResizedWebpImageFileOfImageFile,
  getResizedWebpImageBufferOfImageFile,
  writeResizedWebpImageFileOfVideoFile,
  writeResizedPreviewVideoFileOfVideoFile,
} from "./indexing";

const IMAGE_EXTENSIONS: readonly string[] = ["jpg", "jpeg", "gif", "png", "bmp", "webp"];
const VIDEO_EXTENSIONS: readonly string[] = ["webm", "mp4", "mov", "avi"];
const DEFAULT_CONFIGS: Readonly<GalleryConfigs> = { title: "Untitled", createdAt: new Date(0) };

/** 갤러리 인덱싱 폴더의 절대경로를 얻습니다.
 * @param galleryPath 갤러리의 절대경로
 * @returns 인덱싱 폴더의 절대경로
 */
function buildIndexDirectoryPath(galleryPath: string) {
  return nodePath.join(galleryPath, ".darkgallery");
}

/** 갤러리 데이터베이스 파일의 절대경로를 얻습니다.
 * @param galleryPath 갤러리의 절대경로
 * @returns 데이터베이스 파일의 절대경로
 */
function buildSqliteFilePath(galleryPath: string) {
  return nodePath.join(galleryPath, ".darkgallery", "db.sqlite");
}

/** 주어진 파일 경로의 확장자가 이미지인지 확인합니다.
 * @param filePath 확인할 파일 경로
 * @returns 이미지 여부
 */
function checkPathIsImage(filePath: string) {
  const ext = nodePath.extname(filePath).substring(1).toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext);
}

/** 주어진 파일 경로의 확장자가 비디오인지 확인합니다.
 * @param filePath 확인할 파일 경로
 * @returns 비디오 여부
 */
function checkPathIsVideo(filePath: string) {
  const ext = nodePath.extname(filePath).substring(1).toLowerCase();
  return VIDEO_EXTENSIONS.includes(ext);
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

interface IndexingOptions {
  /** 작업의 진행률 보고 콜백입니다.
   * @param done 현재까지 작업한 항목 수 (에러난 것 포함)
   * @param error 현재까지 작업하다가 실패한 항목 수
   * @param remaning 남은 항목 수
   */
  reporter?: (done: number, error: number, remaning: number) => void;
}

interface IndexExistingItemsOptions extends IndexingOptions {
  /** 기존에 인덱싱된 모든 항목에 대해 파일의 해시 비교까지 수행하여,
   * 파일이 변한 것을 확실하게 감지할 수 있게 되지만 작업 속도가 늦어집니다.
   * (선택적, 기본 false)
   */
  compareHash?: boolean;
}
interface IndexNewItemsOptions extends IndexingOptions {}

export interface IndexingStep {
  /** 작업할 전체 항목 수 */
  total: number;
  /** 남은 항목 수 */
  left: number;
  /** 지금 작업한 항목 정보 (처음엔 null) */
  processed?: {
    result: "done" | "keepLost" | "newlyLost" | "error";
    path: string;
    errorMessage?: string;
  };
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
    title: nodePath.basename(this.path) || DEFAULT_CONFIGS.title,
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
    const existingRow = await Config.findByPk(key);
    const jsonValue = JSON.stringify(value);
    if (existingRow) {
      await Config.update({ value: jsonValue }, { where: { key } });
    } else {
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
      const { title, createdAt } = this.defaultConfigs;
      await this.setConfig("title", title);
      await this.setConfig("createdAt", createdAt);
    }
  }

  /** 인덱싱을 한 파일씩 수행하는 제너레이터를 반환합니다.
   * 열거할 때, 처음 나오는 항목은 total과 left만 포함합니다.
   * @example
   * for (const { total, left, processed } of generateIndexingSequence()) {
   *   ...
   * }
   */
  async *generateIndexingSequence(options: { compareHash: boolean }): AsyncGenerator<IndexingStep> {
    const {
      path: galleryPath,
      models: { item: Item },
    } = this;
    const { compareHash = true } = options;

    // 기존에 인덱싱되어있던 모든 아이템 목록 얻기
    const existingItems = await Item.findAll({
      attributes: [
        "id",
        "path",
        "mtime",
        "size",
        "hash",
        "lost",
        "thumbnailPath",
        "previewVideoPath",
      ],
      raw: true,
    });

    // 인덱싱되지 않은 새로운 파일 목록 얻기
    const allFilePaths = await getAllChildFilePaths(galleryPath, {
      ignoreDirectories: [".darkgallery"],
      acceptingExtensions: [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS],
    });
    const allItemPaths = existingItems.map(item => item.path);
    const newFilePaths = difference(allFilePaths, allItemPaths);

    // 작업 시작 보고
    const total = existingItems.length + newFilePaths.length;
    let left = total;
    yield { total, left };

    // 기존 모든 아이템 순회
    for (const existingItem of existingItems) {
      left -= 1;

      const { id, path, type } = existingItem;
      const fullPath = nodePath.join(galleryPath, path);
      let fileInfo: PromiseValue<ReturnType<typeof getFileInfo>>;
      let fileHash: string;
      try {
        fileInfo = await getFileInfo(fullPath);
        fileHash = compareHash ? await getFileHash(fullPath) : null;
      } catch (error) {
        if (error.code === "ENOENT") {
          // 파일이 없음
          if (existingItem.lost) {
            // 원래 없음
            yield { total, left, processed: { path, result: "keepLost" } };
          } else {
            // 이번에 갑자기 없음
            await Item.update({ lost: true }, { where: { id } });
            yield { total, left, processed: { path, result: "newlyLost" } };
          }
        } else {
          // 예기치 못한 오류
          yield {
            total,
            left,
            processed: { path, result: "error", errorMessage: error.toString() },
          };
        }
        continue;
      }
      // 갱신 필요하면 수행
      const isMtimeOrSizeDifferent =
        existingItem.mtime !== fileInfo.mtime || existingItem.size !== fileInfo.size;
      const shouldBeUpdated =
        isMtimeOrSizeDifferent || (compareHash && existingItem.hash !== fileHash);
      if (shouldBeUpdated) {
        // 업데이트할 데이터 준비
        const thumbnailFullPaths = buildThumbnailPathsForHash(galleryPath, fileHash);
        const updatingItem: Partial<Models.ItemAttributes> = {
          ...fileInfo,
          hash: fileHash || (await getFileHash(fullPath)),
          time: fileInfo.mtime,
          thumbnailPath: nodePath.relative(galleryPath, thumbnailFullPaths.image),
          lost: false,
        };
        if (!nodeFs.existsSync(thumbnailFullPaths.directory)) {
          await nodeFs.promises.mkdir(thumbnailFullPaths.directory, { recursive: true });
        }
        // 새로운 썸네일 생성 및 메타데이터의 시간 할당
        try {
          switch (type) {
            case "IMG":
              const imageIndexingData = await processImageIndexing(
                fullPath,
                thumbnailFullPaths.image
              );
              // if (imageIndexingData.time) imageIndexingData.time = imageIndexingData.time;
              Object.assign(updatingItem, imageIndexingData);
              break;
            case "VID":
              const videoIndexingData = await processVideoIndexing(
                fullPath,
                thumbnailFullPaths.video
              );
              // videoIndexingData.time = videoIndexingData.time || updatingItem.time;
              Object.assign(updatingItem, videoIndexingData);
              break;
            default:
              throw new Error();
          }
        } catch (error) {
          yield {
            total,
            left,
            processed: { path, result: "error", errorMessage: error.toString() },
          };
          continue;
        }
        // DB에 반영
        await Item.update(updatingItem, { where: { id } });
        // 기존의 썸네일 파일은 삭제
        if (existingItem.thumbnailPath) {
          try {
            nodeFs.promises.unlink(nodePath.join(galleryPath, existingItem.thumbnailPath));
          } catch {}
        }
        if (existingItem.previewVideoPath) {
          try {
            nodeFs.promises.unlink(nodePath.join(galleryPath, existingItem.previewVideoPath));
          } catch {}
        }
        // 성공 보고
        yield { total, left, processed: { path, result: "done" } };
      }
    }

    // 새로운 파일 목록 순회
    for (const path of newFilePaths) {
      left -= 1;
      try {
        let type: Models.Item["type"];
        if (checkPathIsImage(path)) type = "IMG";
        else if (checkPathIsVideo(path)) type = "VID";
        else continue;

        const fullPath = nodePath.join(galleryPath, path);
        const fileInfo = await getFileInfo(fullPath);
        const hash = await getFileHash(fullPath);
        const thumbnailFullPaths = buildThumbnailPathsForHash(galleryPath, hash);
        const newItem: Models.ItemCreationAttributes = {
          ...fileInfo,
          hash,
          path,
          type,
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
        switch (type) {
          case "IMG":
            const imageIndexingData = await processImageIndexing(
              fullPath,
              thumbnailFullPaths.image
            );
            // imageIndexingData.time = imageIndexingData.time || newItem.time;
            Object.assign(newItem, imageIndexingData);
            break;
          case "VID":
            const videoIndexingData = await processVideoIndexing(
              fullPath,
              thumbnailFullPaths.image
            );
            // videoIndexingData.time = videoIndexingData.time || newItem.time;
            Object.assign(newItem, videoIndexingData);
            break;
          default:
            throw new Error();
        }
        await Item.create(newItem);
        yield { total, left, processed: { path, result: "done" } };
      } catch (error) {
        yield { total, left, processed: { path, result: "error", errorMessage: error.toString() } };
        continue;
      }
    }
  }

  /** 데이터베이스에 인덱싱된 아이템을 실제 파일 시스템에 존재하는 것과 비교하여 업데이트합니다.
   * 기본적으로 파일의 수정한 날짜, 바이트 단위의 파일 크기를 비교하여 차이를 감지합니다.
   * @param options 인덱싱 옵션입니다.
   * @deprecated Use `generateIndexingSequence` instead.
   */
  async indexExistingItems(options: IndexExistingItemsOptions = {}) {
    const {
      path: galleryPath,
      models: { item: Item },
    } = this;
    const { reporter = () => {}, compareHash = false } = options;

    // 데이터베이스에 존재하는 모든 아이템 목록 얻기
    const existingItems = await Item.findAll({
      attributes: ["id", "path", "mtime", "size", "hash"],
      raw: true,
    });

    // 모든 아이템 순회
    let remaning = existingItems.length;
    let errorPaths: string[] = [];
    let lostPaths: string[] = [];
    reporter(0, 0, remaning);
    for (const existingItem of existingItems) {
      try {
        const fullPath = nodePath.join(galleryPath, existingItem.path);
        const fileInfo = await getFileInfo(fullPath);
        let hash = compareHash ? await getFileHash(fullPath) : null;

        // 갱신 필요하면 수행
        const isMtimeOrSizeDifferent =
          existingItem.mtime !== fileInfo.mtime || existingItem.size !== fileInfo.size;
        const shouldBeUpdated =
          isMtimeOrSizeDifferent || (compareHash && existingItem.hash !== hash);
        if (shouldBeUpdated) {
          // 원래있는 썸네일 파일 삭제
          try {
            nodeFs.promises.unlink(nodePath.join(galleryPath, existingItem.thumbnailPath));
          } catch {}
          try {
            nodeFs.promises.unlink(nodePath.join(galleryPath, existingItem.previewVideoPath));
          } catch {}

          // 데이터베이스 업데이트
          hash = hash || (await getFileHash(fullPath));
          const thumbnailPaths = buildThumbnailPathsForHash(galleryPath, hash);
          const updatingItem: Partial<Models.ItemAttributes> = {
            ...fileInfo,
            hash,
            time: fileInfo.mtime,
            thumbnailPath: nodePath.relative(galleryPath, thumbnailPaths.image),
          };
          if (!nodeFs.existsSync(thumbnailPaths.directory)) {
            await nodeFs.promises.mkdir(thumbnailPaths.directory, { recursive: true });
          }
          switch (existingItem.type) {
            case "IMG":
              const imageIndexingData = await processImageIndexing(fullPath, thumbnailPaths.image);
              imageIndexingData.time = imageIndexingData.time || updatingItem.time;
              Object.assign(updatingItem, imageIndexingData);
              break;
            case "VID":
              const videoIndexingData = await processVideoIndexing(fullPath, thumbnailPaths.video);
              videoIndexingData.time = videoIndexingData.time || updatingItem.time;
              Object.assign(updatingItem, videoIndexingData);
              break;
            default:
              throw new Error();
          }
          await Item.update(updatingItem, { where: { id: existingItem.id } });
        }
      } catch (error) {
        if (error.code === "ENOENT") {
          // 유실
          await Item.update({ lost: true }, { where: { id: existingItem.id } });
          lostPaths.push(existingItem.path);
        } else {
          // 오류
          errorPaths.push(existingItem.path);
        }
      } finally {
        remaning--;
        reporter(existingItems.length - remaning, errorPaths.length, remaning);
      }
    }
  }

  /** 파일 시스템에서 데이터베이스에 인덱싱되지 않은 새로운 파일을 찾아 데이터베이스에 추가합니다.
   * @param options 인덱싱 옵션입니다.
   * @deprecated Use `generateIndexingSequence` instead.
   */
  async indexNewItems(options: IndexNewItemsOptions = {}) {
    const {
      path: galleryPath,
      models: { item: Item },
    } = this;
    const { reporter = () => {} } = options;

    // 새로운 파일 목록 얻기
    const allFilePaths = await getAllChildFilePaths(galleryPath, {
      ignoreDirectories: [".darkgallery"],
      acceptingExtensions: union(IMAGE_EXTENSIONS, VIDEO_EXTENSIONS),
    });
    const allItemPaths = (await Item.findAll({ attributes: ["path"], raw: true })).map(
      item => item.path
    );
    const newFilePaths = difference(allFilePaths, allItemPaths);

    // 새로운 파일 목록 순회
    let remaning = newFilePaths.length;
    let errorPaths: string[] = [];
    reporter(0, 0, remaning);
    const newItems: Models.ItemCreationAttributes[] = [];
    for (const newFilePath of newFilePaths) {
      try {
        let type: Models.Item["type"];
        if (checkPathIsImage(newFilePath)) type = "IMG";
        else if (checkPathIsVideo(newFilePath)) type = "VID";
        else continue;

        const fullPath = nodePath.join(galleryPath, newFilePath);
        const fileInfo = await getFileInfo(fullPath);
        const hash = await getFileHash(fullPath);
        const thumbnailPaths = buildThumbnailPathsForHash(galleryPath, hash);
        const newItem: Models.ItemCreationAttributes = {
          ...fileInfo,
          hash,
          path: newFilePath,
          type,
          width: 0,
          height: 0,
          duration: 0,
          time: fileInfo.mtime,
          thumbnailBase64: "",
          thumbnailPath: nodePath.relative(galleryPath, thumbnailPaths.image),
        };
        if (!nodeFs.existsSync(thumbnailPaths.directory)) {
          await nodeFs.promises.mkdir(thumbnailPaths.directory, { recursive: true });
        }
        switch (type) {
          case "IMG":
            const imageIndexingData = await processImageIndexing(fullPath, thumbnailPaths.image);
            imageIndexingData.time = imageIndexingData.time || newItem.time;
            Object.assign(newItem, imageIndexingData);
            break;
          case "VID":
            const videoIndexingData = await processVideoIndexing(fullPath, thumbnailPaths.image);
            videoIndexingData.time = videoIndexingData.time || newItem.time;
            Object.assign(newItem, videoIndexingData);
            break;
          default:
            throw new Error();
        }
        newItems.push(newItem);
      } catch (error) {
        // TODO: handle error
        console.error(error);
      } finally {
        remaning--;
        reporter(newFilePaths.length - remaning, errorPaths.length, remaning);
      }
    }

    // 데이터베이스에 일괄 삽입
    await Item.bulkCreate(newItems);
  }

  /** 데이터베이스 연결을 닫고 참조를 지웁니다. */
  async dispose() {
    await this.sequelize?.close();
    this.sequelize = null;
  }
}
