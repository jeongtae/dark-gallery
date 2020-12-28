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
   * "started" // 1. 인덱싱할 목록 준비 중
   * "processing" // 2. 인덱싱할 목록의 각 항목에 대해 처리중
   * "ended" // 3. 인덱싱 작업 완수함
   * "aborting" // 3. 인덱싱 작업 중단 중
   * "aborted" // 3. 인덱싱 작업 중단됨
   */
  phase: "started" | "processing" | "ended" | "aborting" | "aborted";
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
  openGallery: (path: string, title: string) => void;
  reportGalleryIndexingProgress: (progress: IndexingProgress) => void;
};
//#endregion

//#region IPC Commands (Renderer -> Main)
export type Commands = {
  /** 개발용 갤러리의 절대경로를 얻습니다.
   * @returns 개발용 갤러리의 절대경로
   */
  getDevGalleryPath: () => string;
  /** 개발용 갤러리의 인덱싱 폴더를 삭제하여 리셋합니다.
   * @returns 성공 여부
   */
  resetDevGallery: () => boolean;
  /** 디렉터리를 선택하는 네이티브 모달 창을 열고 결과를 얻습니다.
   * @param options.title 모달 창의 타이틀바 문자열
   * @param options.buttonLabel 모달 창의 선택버튼 문자열
   * @returns 선택한 디렉터리 절대경로 또는 null
   */
  openDirectoryPickingDialog: (options: { title?: string; buttonLabel?: string }) => string;
  /** 지정한 디렉터리 경로를 갤러리 관점에서 조사합니다.
   * @param path 조사할 디렉터리의 절대경로
   * @returns 경로 정보 객체
   */
  getGalleryPathInfo: (path: string) => GalleryPathInfo;
  /** 주어진 경로를 갤러리로 취급하고 엽니다. 갤러리가 아닌 폴더라도 열리며, 인덱싱 파일이 생성됩니다.
   * @param path 열 갤러리 디렉터리의 절대경로
   * @returns 열린 갤러리의 제목
   */
  openGallery: (path: string) => string;
  /** 앱 메뉴의 활성화 상태를 변경합니다.
   * @param id 상태를 변경할 메뉴의 ID
   * @param enabled 활성화 상태
   */
  setMenuEnabled: (id: MenuItemId, enabled: boolean) => void;
  /** 갤러리를 인덱싱하는 백그라운드 작업을 시작할 것을 요청합니다.
   * 작업 상태는 `reportGalleryIndexingProgress` 이벤트로 계속 보고됩니다.
   */
  startGalleryIndexing: (compareHash?: boolean) => void;
  /** 갤러리를 인덱싱하는 백그라운드 작업을 중단할 것을 요청합니다.
   * 중단되면 `reportGalleryIndexingProgress` 이벤트로 보고됩니다.
   */
  abortGalleryIndexing: () => void;
  /** 갤러리의 모든 설정을 가져옵니다.
   * @returns 갤러리 설정 모음객체
   */
  getAllGalleryConfigs: () => GalleryConfigs;
  /** 갤러리의 설정을 가져옵니다.
   * @param key 설정 키
   * @returns 설정값
   */
  getGalleryConfig: <K extends keyof GalleryConfigs>(key: K) => GalleryConfigs[K];
  /** 갤러리의 설정을 변경합니다.
   * @param key 설정 키
   * @param value 설정 값
   */
  setGalleryConfig: <K extends keyof GalleryConfigs>(key: K, value: GalleryConfigs[K]) => void;
  getItems: () => RawItem[];
};
//#endregion
