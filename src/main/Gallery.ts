import path from "path";
import fs from "fs";
import { Sequelize } from "sequelize/types";
import { createSequelize, Models } from "./sequelize";
import { GalleryPathInfo } from "./ipc";

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

  /** 데이터베이스 연결을 닫고 참조를 지웁니다. */
  async dispose() {
    await this.sequelize?.close();
    this.sequelize = null;
  }
}
