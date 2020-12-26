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
export type IndexingProgress = {
  /** 인덱싱 단계
   * @example
   * "started" // 1. 인덱싱이 시작됨
   * "processing" // 2. 기존에 인덱싱된 항목에 대해 처리중
   * "ended" // 3. 인덱싱 작업 완수함
   * "aborted" // 3. 인덱싱 작업 중단됨
   */
  phase: "started" | "processing" | "ended" | "aborted";
  /** 지금껏 알아낸 검사할 총 항목 수 */
  totalCount: number;
  /** 기존에 인덱싱 된 항목에 대한 처리 완료 수 (성공 여부 관련 없이) */
  leftCount: number;
  /** 처리 중에 오류가 발생한 경로 목록 */
  errorList: string[];
  /** 새롭게 유실된 경로 목록 */
  newlyLostList: string[];
};
//#endregion

//#region IPC Events (Main -> Renderer)
export type Events = {
  clickMenu: (id: MenuItemId) => void;
  openGallery: (args: { path: string; title: string }) => void;
  reportBackgroundIndexingProgress: (progress: IndexingProgress) => void;
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
  startBackgroundIndexing: () => void;
  abortBackgroundIndexing: () => void;
  getAllConfig: () => GalleryConfigs;
  getConfig: <K extends keyof GalleryConfigs>(key: K) => GalleryConfigs[K];
  setConfig: <K extends keyof GalleryConfigs>(key: K, value: GalleryConfigs[K]) => void;
  getItems: () => RawItem[];
};
//#endregion
