import type { RawItem } from "./sequelize";

//#region Electron Types
export type MenuItemId = "newWindow" | "openPreference" | "closeWindow" | "closeTab" | "help";
//#endregion

//#region Gallery Types
export interface GalleryPathInfo {
  /** 경로가 존재합니다. */
  exists: boolean;
  /** 절대 경로입니다. */
  isAbsolute: boolean;
  /** 경로가 디렉터리입니다. */
  isDirectory?: boolean;
  /** 갤러리 디렉터리입니다. */
  isGallery?: boolean;
  /** 다른 갤러리의 자손 디렉터리입니다. */
  isDecendantDirectoryOfGallery?: boolean;
  /** 이 경로에 읽기 권한이 있습니다. */
  directoryHasReadPermission?: boolean;
  /** 이 경로에 쓰기 권한이 있습니다. */
  directoryHasWritePermission?: boolean;
  /** 갤러리 데이터베이스 파일에 읽기 권한이 있습니다. */
  sqliteFileHasReadPermission?: boolean;
  /** 갤러리 데이터베이스 파일에 쓰기 권한이 있습니다. */
  sqliteFileHasWritePermission?: boolean;
}
export type GalleryConfigs = {
  /** 갤러리의 제목 */
  title: string;
  /** 갤러리 생성일시 */
  createdAt: Date;
};
//#endregion

//#region IPC Events (Main -> Renderer)
export type Events = {
  clickMenu: (id: MenuItemId) => void;
  openGallery: (args: { path: string; title: string }) => void;
};
//#endregion

//#region IPC Commands (Renderer -> Main)
export type Commands = {
  pickDirectory: (args: { title?: string; buttonLabel?: string }) => string;
  checkGalleryPath: (args: { path: string }) => GalleryPathInfo;
  getDevGalleryPath: () => string;
  openGallery: (args: { path: string }) => string;
  resetDevGallery: () => boolean;
  setMenuEnabled: (id: MenuItemId, enabled: boolean) => void;
  startIndexing: () => void;
  getAllConfig: () => GalleryConfigs;
  getConfig: <K extends keyof GalleryConfigs>(key: K) => GalleryConfigs[K];
  setConfig: <K extends keyof GalleryConfigs>(key: K, value: GalleryConfigs[K]) => void;
  getItems: () => RawItem[];
};
//#endregion
