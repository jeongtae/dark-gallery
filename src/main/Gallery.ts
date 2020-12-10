import path from "path";
import fs from "fs";
import { difference, union } from "lodash";
import { Sequelize } from "sequelize/types";
import { createSequelize, Models } from "./sequelize";
import { GalleryPathInfo } from "./ipc";
import {
  getAllChildFilePath,
  getFileHash,
  getFileInfo,
  getImageInfo,
  getVideoInfo,
} from "./indexing";

const IMAGE_EXTENSIONS: readonly string[] = ["jpg", "jpeg", "gif", "png", "bmp", "webp"];
const VIDEO_EXTENSIONS: readonly string[] = ["webm", "mp4", "mov", "avi"];

export function buildIndexDirectoryPath(galleryPath: string) {
  return path.join(galleryPath, ".darkgallery");
}
export function buildSqliteFilePath(galleryPath: string) {
  return path.join(galleryPath, ".darkgallery", "db.sqlite");
}

interface GalleryModels {
  item: Models.ItemCtor;
  tag: Models.TagCtor;
  tagGroup: Models.TagGroupCtor;
  keyValueStore: Models.KeyValueStoreCtor;
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
   * @throws 새로 생성한 데이터베이스인 경우, `sync()` 메서드를 반드시 한 번 실행해야 합니다.
   *         그렇지 않고 이 프로퍼티에 접근하는 경우 에러가 발생합니다.
   */
  get models(): Readonly<GalleryModels> {
    if (this.sequelize === null) {
      throw new Error("The gallery must be opened before accessing its models.");
    }
    return this.#models;
  }

  async getTitle() {
    const row = await this.#models.keyValueStore.findByPk("title");
    return row.value;
  }
  async setTitle(value: string) {
    await this.#models.keyValueStore.update({ value: value }, { where: { key: "title" } });
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

  static pathIsImage(filePath: string): boolean {
    const ext = path.extname(filePath).substring(1).toLowerCase();
    return IMAGE_EXTENSIONS.includes(ext);
  }
  static pathIsVideo(filePath: string): boolean {
    const ext = path.extname(filePath).substring(1).toLowerCase();
    return VIDEO_EXTENSIONS.includes(ext);
  }

  /** 주어진 경로의 갤러리 인스턴스를 생성합니다. 사용하기 전에 `open()`메서드를 호출하여 데이터베이스 파일을 연결해야합니다.
   * @param galleryPath 갤러리의 경로
   * @param isNew `true`인 경우, 데이터베이스를 새로 생성하겠다고 표시하는 것입니다.
   */
  constructor(readonly path: string, private readonly isNew: boolean = false) {}

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
    const { item, tag, tagGroup, keyValueStore } = sequelize.models as any;
    if (this.isNew) {
      await sequelize.sync();
      const title = path.basename(this.path);
      await (keyValueStore as Models.KeyValueStoreCtor).create({ key: "title", value: title });
    }
    this.#models = {
      item,
      tag,
      tagGroup,
      keyValueStore,
    };
    this.sequelize = sequelize;
  }

  async indexExistingItems(options: IndexExistingItemsOptions = {}) {
    const {
      path: galleryPath,
      models: { item: Item },
    } = this;
    const { reporter = () => {}, compareHash = false } = options;
    const { join } = path;

    // 데이터베이스에 존재하는 모든 아이템 목록 얻기
    const items = await Item.findAll({
      attributes: ["id", "path", "mtime", "size", "hash"],
      raw: true,
    });

    // 모든 아이템 순회
    let remaning = items.length;
    let errorPaths: string[] = [];
    let lostPaths: string[] = [];
    reporter(0, 0, remaning);
    for (const item of items) {
      try {
        const itemFullPath = join(galleryPath, item.path);
        const { mtime: itemMtime, size: itemSize, hash: itemHash } = item;
        const { mtime: fileMtime, size: fileSize } = await getFileInfo(itemFullPath);
        let fileHash = compareHash ? await getFileHash(itemFullPath) : null;

        // 갱신 필요하면 수행
        const isMtimeOrSizeDifferent = itemMtime !== fileMtime || itemSize !== fileSize;
        const shouldBeUpdated = isMtimeOrSizeDifferent || (compareHash && itemHash !== fileHash);
        if (shouldBeUpdated) {
          // 원래있는 썸네일 파일 삭제
          // const oldThumbPaths = buildThumbnailPathsForHash(galleryPath, itemHash);
          // oldThumbPaths.image remove!!

          // 썸네일 생성

          // 데이터베이스 업데이트
          if (!fileHash) fileHash = await getFileHash(itemFullPath);
          let time: Date = fileMtime;
          let width: number;
          let height: number;
          let duration = null;
          switch (item.type) {
            case "IMG":
              const imageInfo = await getImageInfo(itemFullPath);
              time = imageInfo.taggedTime || time;
              width = imageInfo.width;
              height = imageInfo.height;
              break;
            case "VID":
              const videoInfo = await getVideoInfo(itemFullPath);
              time = videoInfo.taggedTime || time;
              width = videoInfo.width;
              height = videoInfo.height;
              duration = videoInfo.duration;
              break;
          }
          await Item.update(
            { mtime: fileMtime, size: fileSize, hash: fileHash, time, width, height, duration },
            { where: { id: item.id } }
          );
        }
      } catch (error) {
        if (error.code === "ENOENT") {
          // 유실
          await Item.update({ lost: true }, { where: { id: item.id } });
          lostPaths.push(item.path);
        } else {
          // 오류
          errorPaths.push(item.path);
        }
      } finally {
        remaning--;
        reporter(items.length - remaning, errorPaths.length, remaning);
      }
    }
  }

  async indexNewItems(options: IndexNewItemsOptions = {}) {
    const {
      path: galleryPath,
      models: { item: Item },
    } = this;
    const { reporter = () => {} } = options;
    const { join } = path;

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
    for (const path of newFilePaths) {
      try {
        let type: Models.Item["type"];
        if (Gallery.pathIsImage(path)) type = "IMG";
        else if (Gallery.pathIsVideo(path)) type = "VID";
        else continue;

        const fullFilePath = join(galleryPath, path);
        const { mtime, size } = await getFileInfo(fullFilePath);
        const hash = await getFileHash(fullFilePath);
        let width: number;
        let height: number;
        let duration: number;
        let time = mtime;
        switch (type) {
          case "IMG":
            const imageInfo = await getImageInfo(fullFilePath);
            time = imageInfo.taggedTime || time;
            width = imageInfo.width;
            height = imageInfo.height;
            break;
          case "VID":
            const videoInfo = await getVideoInfo(fullFilePath);
            time = videoInfo.taggedTime || time;
            width = videoInfo.width;
            height = videoInfo.height;
            duration = videoInfo.duration;
            break;
        }
        newItems.push({
          type,
          mtime,
          size,
          hash,
          time,
          path,
          width,
          height,
          duration,
        });
      } catch (error) {
        // TODO: handle error
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
