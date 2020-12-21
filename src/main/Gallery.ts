import path from "path";
import fs from "fs";
import { difference, union } from "lodash";
import { Sequelize } from "sequelize/types";
import { createSequelize, Models } from "./sequelize";
import { GalleryPathInfo, GalleryConfigs } from "./ipc";
import {
  getAllChildFilePath,
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

/** 갤러리 인덱싱 폴더의 절대경로를 얻습니다.
 * @param galleryPath 갤러리의 절대경로
 * @returns 인덱싱 폴더의 절대경로
 */
export function buildIndexDirectoryPath(galleryPath: string) {
  return path.join(galleryPath, ".darkgallery");
}

/** 갤러리 데이터베이스 파일의 절대경로를 얻습니다.
 * @param galleryPath 갤러리의 절대경로
 * @returns 데이터베이스 파일의 절대경로
 */
export function buildSqliteFilePath(galleryPath: string) {
  return path.join(galleryPath, ".darkgallery", "db.sqlite");
}

/** 주어진 파일 경로의 확장자가 이미지인지 확인합니다.
 * @param filePath 확인할 파일 경로
 * @returns 이미지 여부
 */
function checkPathIsImage(filePath: string) {
  const ext = path.extname(filePath).substring(1).toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext);
}

/** 주어진 파일 경로의 확장자가 비디오인지 확인합니다.
 * @param filePath 확인할 파일 경로
 * @returns 비디오 여부
 */
function checkPathIsVideo(filePath: string) {
  const ext = path.extname(filePath).substring(1).toLowerCase();
  return VIDEO_EXTENSIONS.includes(ext);
}

type ThumbnailPaths = {
  directory: string;
  image: string;
  video: string;
};
/** 갤러리 아이템 썸네일 파일의 절대경로 목록을 얻습니다.
 * @param galleryPath 갤러리의 절대경로
 * @param hash 아이템의 해시값
 * @returns 썸네일 파일의 절대경로를 포함하는 객체
 */
function buildThumbnailPathsForHash(galleryPath: string, hash: string): ThumbnailPaths {
  const indexPath = buildIndexDirectoryPath(galleryPath);
  const dirPath = path.join(indexPath, "thumbs", hash[0]);
  return {
    directory: dirPath,
    image: path.join(dirPath, hash + ".webp"),
    video: path.join(dirPath, hash + ".webm"),
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
    time,
    thumbnailBase64,
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
    time,
    thumbnailBase64,
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

/** 갤러리 폴더와 데이터베이스를 다루는 클래스 */
export default class Gallery implements Disposable {
  private sequelize: Sequelize = null;

  /** Sequelize 인스턴스가 생성되었는지 여부 (데이터베이스 연결 여부) */
  get isOpened(): boolean {
    return !!this.sequelize;
  }

  #models: Readonly<GalleryModels>;
  /** 갤러리 데이터베이스에 접근할 수 있는 모델의 목록입니다.
   * @throws 갤러리 인스턴스를 생성하면 처음 사용하기 전에 `open()` 메서드를 반드시 한 번 실행해야 합니다.
   *         그렇지 않고 이 프로퍼티에 접근하는 경우 에러가 발생합니다.
   */
  get models(): Readonly<GalleryModels> {
    if (this.sequelize === null) {
      throw new Error("The gallery must be opened before accessing its models.");
    }
    return this.#models;
  }

  /** 데이터베이스에 기록된 설정을 가져옵니다.
   * @param key 설정 키
   */
  async getConfig<K extends keyof GalleryConfigs>(key: K): Promise<GalleryConfigs[K]> {
    const { config } = this.#models;
    const row = await config.findByPk(key);
    if (!row) {
      return null;
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
    const { config } = this.#models;
    const existingRow = await config.findByPk(key);
    const jsonValue = JSON.stringify(value);
    if (existingRow) {
      await config.update({ value: jsonValue }, { where: { key } });
    } else {
      await config.create({ key, value: jsonValue });
    }
  }

  /** 주어진 경로를 갤러리의 관점에서 조사합니다.
   * @returns 조사 결과
   */
  static async checkGalleryPath(galleryPath: string): Promise<GalleryPathInfo> {
    const { R_OK, W_OK } = fs.constants;
    const result: GalleryPathInfo = {
      isAbsolute: path.isAbsolute(galleryPath),
      exists: false,
    };

    // 존재하는지 확인
    try {
      await fs.promises.access(galleryPath);
      result.exists = true;
    } catch {
      return result;
    }

    // 디렉터리인지 확인
    const galleryPathStat = await fs.promises.lstat(galleryPath);
    result.isDirectory = galleryPathStat.isDirectory();
    if (!result.isDirectory) {
      return result;
    }

    // 디렉터리의 권한 확인
    try {
      result.directoryHasReadPermission = false;
      await fs.promises.access(galleryPath, R_OK);
      result.directoryHasReadPermission = true;

      result.directoryHasWritePermission = false;
      await fs.promises.access(galleryPath, W_OK);
      result.directoryHasWritePermission = true;
    } catch {}

    // 다른 갤러리의 자식 디렉터리인지 확인
    if (result.isAbsolute) {
      const upper = (p: string) => path.join(p, "..");
      let upperLevelPath = galleryPath;
      while (upperLevelPath !== upper(upperLevelPath)) {
        upperLevelPath = upper(upperLevelPath);
        const sqlitePath = buildSqliteFilePath(upperLevelPath);
        try {
          await fs.promises.access(sqlitePath);
          result.isDecendantDirectoryOfGallery = true;
          break;
        } catch {}
      }
    }

    // DB 파일의 존재 및 권한 확인
    const sqlitePath = buildSqliteFilePath(galleryPath);
    try {
      await fs.promises.access(sqlitePath);
      result.isGallery = true;
      await fs.promises.access(sqlitePath, R_OK);
      result.sqliteFileHasReadPermission = true;
      await fs.promises.access(sqlitePath, W_OK);
      result.sqliteFileHasWritePermission = true;
    } catch {}

    return result;
  }

  /** 주어진 경로의 갤러리 인스턴스를 생성합니다. 사용하기 전에 `open()`메서드를 호출하여 데이터베이스 파일에 연결되어야합니다.
   * @param galleryPath 갤러리의 경로
   * @param isNew `true`인 경우, 데이터베이스를 새로 생성하겠다고 표시하는 것입니다.
   */
  constructor(readonly path: string, private readonly isNew: boolean = false) {}

  /** 갤러리 데이터베이스 파일을 열어서 연결합니다. */
  async open() {
    if (this.isOpened) {
      return;
    }
    const pathInfo = await Gallery.checkGalleryPath(this.path);
    if (this.isNew) {
      if (
        !pathInfo.exists ||
        pathInfo.isDirectory === false ||
        pathInfo.isGallery ||
        pathInfo.directoryHasWritePermission === false
      ) {
        throw new Error();
      }
      const indexPath = buildIndexDirectoryPath(this.path);
      await fs.promises.mkdir(indexPath, { recursive: true });
    } else {
      if (
        !pathInfo.exists ||
        pathInfo.isGallery === false ||
        pathInfo.sqliteFileHasWritePermission === false
      ) {
        throw new Error();
      }
    }

    const sqlitePath = buildSqliteFilePath(this.path);
    const sequelize = createSequelize(sqlitePath);
    const { item, tag, tagGroup, config } = sequelize.models as any;
    if (this.isNew) {
      await sequelize.sync();
      const title = path.basename(this.path);
      await this.setConfig("title", title);
      await this.setConfig("createdAt", new Date());
    }
    this.#models = {
      item,
      tag,
      tagGroup,
      config,
    };
    this.sequelize = sequelize;
  }

  /** 데이터베이스에 인덱싱된 아이템을 실제 파일 시스템에 존재하는 것과 비교하여 업데이트합니다.
   * 기본적으로 파일의 수정한 날짜, 바이트 단위의 파일 크기를 비교하여 차이를 감지합니다.
   * @param options 인덱싱 옵션입니다.
   */
  async indexExistingItems(options: IndexExistingItemsOptions = {}) {
    const {
      path: galleryPath,
      models: { item: Item },
    } = this;
    const { reporter = () => {}, compareHash = false } = options;
    const { join } = path;

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
        const fullPath = join(galleryPath, existingItem.path);
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
            fs.promises.unlink(path.join(galleryPath, existingItem.thumbnailPath));
          } catch {}
          try {
            fs.promises.unlink(path.join(galleryPath, existingItem.previewVideoPath));
          } catch {}

          // 데이터베이스 업데이트
          hash = hash || (await getFileHash(fullPath));
          const thumbnailPaths = buildThumbnailPathsForHash(galleryPath, hash);
          const updatingItem: Partial<Models.ItemAttributes> = {
            ...fileInfo,
            hash,
            time: fileInfo.mtime,
            thumbnailPath: path.relative(galleryPath, thumbnailPaths.image),
          };
          if (!fs.existsSync(thumbnailPaths.directory)) {
            await fs.promises.mkdir(thumbnailPaths.directory, { recursive: true });
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
   */
  async indexNewItems(options: IndexNewItemsOptions = {}) {
    const {
      path: galleryPath,
      models: { item: Item },
    } = this;
    const { reporter = () => {} } = options;

    // 새로운 파일 목록 얻기
    const allFilePaths = await getAllChildFilePath(galleryPath, {
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

        const fullPath = path.join(galleryPath, newFilePath);
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
          thumbnailPath: path.relative(galleryPath, thumbnailPaths.image),
        };
        if (!fs.existsSync(thumbnailPaths.directory)) {
          await fs.promises.mkdir(thumbnailPaths.directory, { recursive: true });
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
