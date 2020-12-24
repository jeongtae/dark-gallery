import { Writable, writable } from "svelte/store";
import { localStorageWritable } from "./localStorageStore";
import { galleryConfigWritable } from "./galleryConfigStore";
import type { GalleryConfigs } from "../ipc";
// import from "../ipc";

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
/** 앱 전역 설정 스토어 *(`localStorageWritable`)* */
export const globalSettingsStore = localStorageWritable<GlobalSettings>("global-settings", {});
globalSettingsStore.update(settings => ({ ...defaultGlobalSettings, ...settings }));

/** 현재 열린 갤러리의 경로 스토어 *(`localStorageWritable`)* */
export const galleryPathStore = writable<string>(null);

/** 현재 열린 갤러리의 설정 스토어 모음객체 *(`galleryConfigWritable`)* */
export const galleryConfigStores: Readonly<
  {
    [key in keyof GalleryConfigs]: Writable<GalleryConfigs[key]>;
  }
> = {
  title: galleryConfigWritable(galleryPathStore, "title"),
  createdAt: galleryConfigWritable(galleryPathStore, "createdAt"),
};

/** 최근 열어본 갤러리 정보 인터페이스 */
export interface RecentlyOpenedGalleryInfo {
  title: string;
  path: string;
}
/** 최근 열어본 갤러리 정보 스토어 *(`localStorageWritable`)* */
export const recentlyOpenedGalleryInfoListStore = localStorageWritable<RecentlyOpenedGalleryInfo[]>(
  "recent-gallery-info-list",
  []
);
/** `recentlyOpenedGalleryInfoListStore`에 갤러리 정보 하나를 푸시합니다. */
export const pushRecentlyOpenedGalleryInfo = (function () {
  let maxLength = defaultGlobalSettings.maxRecentGalleriesCount;
  globalSettingsStore.subscribe(settings => {
    maxLength = settings.maxRecentGalleriesCount;
  });
  return (info: RecentlyOpenedGalleryInfo) => {
    recentlyOpenedGalleryInfoListStore.update(list => {
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
