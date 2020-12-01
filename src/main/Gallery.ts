import path from "path";
import fs from "fs";
import { difference } from "lodash";
import { Sequelize } from "sequelize/types";
import { createSequelize, Models } from "./sequelize";
import { GalleryPathInfo } from "./ipc";
import { getAllChildFilePath, getFileInfo } from "./indexing";

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

type IndexingOptions = {
  /** 기존에 인덱싱된 모든 항목에 대해 파일의 해시 비교를 수행하여,
   * 파일이 변한 것을 확실하게 감지하지만 작업 속도가 늦어집니다.
   */
  compareHash?: boolean;
  /** 인덱싱되지 않은 파일을 인덱싱합니다. */
  findNew?: boolean;
};

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

  async startIndexing(options: IndexingOptions = {}) {
    const { compareHash, findNew } = options;
    const {
      path: galleryPath,
      models: { item: Item },
    } = this;

    // 데이터베이스에 존재하는 모든 파일 경로 수집
    const items = await Item.findAll({
      attributes: compareHash
        ? ["id", "path", "mtime", "size", "hash"]
        : ["id", "path", "mtime", "size"],
      raw: true,
    });

    // 원래 존재하는 것에 대해서 작업
    for (const {
      id: itemId,
      path: itemPath,
      mtime: itemMtime,
      size: itemSize,
      hash: itemHash,
    } of items) {
      try {
        const itemFullPath = path.join(galleryPath, itemPath);
        const { mtime: fileMtime, size: fileSize, hash: fileHash } = await getFileInfo(
          itemFullPath,
          { includeHash: compareHash }
        );
        const shouldUpdate =
          itemMtime !== fileMtime || itemSize !== fileSize || itemHash !== fileHash;
        if (shouldUpdate) {
          const mtime = fileMtime;
          const size = fileSize;
          const hash = fileHash || (await getFileInfo(itemFullPath, { includeHash: true })).hash;
          await Item.update({ mtime, size, hash }, { where: { id: itemId } });
        }
      } catch (e) {
        if (e.code === "ENOENT") {
          await Item.update({ lost: true }, { where: { id: itemId } });
        }
      }
    }

    // 새로 추가될 것에 대해 작업
    if (findNew) {
      const extensions = ["jpg", "jpeg", "gif", "png", "bmp", "webp", "webm", "mp4", "mov", "avi"];
      const allFilePaths = await getAllChildFilePath(galleryPath, {
        ignoreDirectories: [".darkgallery"],
        acceptingExtensions: extensions,
      });
      const allItemPaths = items.map(item => item.path);
      const newFilePaths = difference(allFilePaths, allItemPaths);
      const newItems: Models.ItemCreationAttributes[] = [];
      for (const filePath of newFilePaths) {
        const fullFilePath = path.join(galleryPath, filePath);
        const { mtime, size, hash } = await getFileInfo(fullFilePath, { includeHash: true });
        newItems.push({ mtime, size, hash, path: filePath });
      }
      await Item.bulkCreate(newItems);
    }
  }

  /** 데이터베이스 연결을 닫고 참조를 지웁니다. */
  async dispose() {
    await this.sequelize?.close();
    this.sequelize = null;
  }
}
