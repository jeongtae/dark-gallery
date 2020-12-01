import type { RawItem } from "./sequelize";

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

export type MenuItemId = "newWindow" | "openPreference" | "closeWindow" | "closeTab" | "help";

/** Main -> Renderer */
export type Events = {
  clickMenu: (id: MenuItemId) => void;
  openGallery: (args: { path: string; title: string }) => void;
};

/** Renderer -> Main */
export type Commands = {
  pickDirectory: (args: { title?: string; buttonLabel?: string }) => string;
  checkGalleryPath: (args: { path: string }) => GalleryPathInfo;
  createAndOpenGallery: (args: { path: string }) => string;
  getDevGalleryPath: () => string;
  openGallery: (args: { path: string }) => string;
  resetDevGallery: () => boolean;
  setMenuEnabled: (id: MenuItemId, enabled: boolean) => void;
  startIndexing: () => void;
  getItems: () => RawItem[];
};
