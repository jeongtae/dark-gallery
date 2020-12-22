import { writable } from "svelte/store";
import { storageWritable } from "./storage";

/** 색상 테마 열거형 */
enum ColorTheme {
  Dark,
  Light,
  Auto,
}
/** 앱 전역 설정 인터페이스 */
interface GlobalSettings {
  colorTheme?: ColorTheme;
  maxRecentGalleriesCount?: number;
}
/** 앱 전역 설정 기본값 객체 */
export const defaultGlobalSettings: Readonly<GlobalSettings> = {
  colorTheme: ColorTheme.Dark,
  maxRecentGalleriesCount: 5,
};
/** 앱 전역 설정 스토어 *(`storageWritable`)* */
export const globalSettingsStore = storageWritable<GlobalSettings>("global-settings", {});
globalSettingsStore.update(settings => ({ ...defaultGlobalSettings, ...settings }));

/** 갤러리 정보 인터페이스 */
export interface GalleryInfo {
  title: string;
  path: string;
}
/** 현재 열린 갤러리 정보 스토어 *(`writable`)* */
export const currentGalleryInfoStore = writable<GalleryInfo>(null);
/** 최근 열어본 갤러리 정보 스토어 *(`storageWritable`)* */
export const recentGalleryInfoListStore = storageWritable<GalleryInfo[]>(
  "recent-gallery-info-list",
  []
);

/** `recentGalleryInfoListStore`에 갤러리 정보 하나를 푸시합니다. */
export const pushRecentGalleryInfo = (function () {
  let maxLength = defaultGlobalSettings.maxRecentGalleriesCount;
  globalSettingsStore.subscribe(settings => {
    maxLength = settings.maxRecentGalleriesCount;
  });
  return (info: GalleryInfo) => {
    recentGalleryInfoListStore.update(list => {
      const idx = list.findIndex(v => v.path === info.path);
      if (idx >= 0) {
        list.splice(idx, 1);
      }
      list.splice(0, 0, info);
      if (list.length > maxLength) {
        list.splice(maxLength, list.length - maxLength);
      }
      return list;
    });
  };
})();
