import { Writable, writable } from "svelte/store";
import { localStorageWritable } from "./localStorageStore";
import { galleryConfigWritable } from "./galleryConfigStore";
import type { GalleryConfigs } from "../ipc";

function camelToKebab(text: string) {
  return text.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, "$1-$2").toLowerCase();
}

/** 색상 테마 열거형 */
enum ColorTheme {
  Dark,
  Light,
  Auto,
}

/** 앱 설정 인터페이스 */
interface AppSettings {
  colorTheme: ColorTheme;
  maxRecentlyOpenedGalleriesCount: number;
}

/** 앱 설정 기본값 객체 */
const defaultAppSettings: Readonly<AppSettings> = {
  colorTheme: ColorTheme.Dark,
  maxRecentlyOpenedGalleriesCount: 5,
};

/** 앱 설정 스토어 모음객체 *(`localStorageWritable`)* */
const appSettingStores: Readonly<
  { [key in keyof AppSettings]: Writable<AppSettings[key]> }
> = {} as any;
for (const key of Object.keys(defaultAppSettings)) {
  const localStorageKey = camelToKebab(key);
  const initialValue = defaultAppSettings[key];
  appSettingStores[key] = localStorageWritable(localStorageKey, initialValue);
}
export { appSettingStores };

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
  let maxLength = defaultAppSettings.maxRecentlyOpenedGalleriesCount;
  appSettingStores.maxRecentlyOpenedGalleriesCount.subscribe(newMaxLength => {
    maxLength = newMaxLength;
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
