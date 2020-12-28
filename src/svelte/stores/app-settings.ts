import { localStorageWritable } from "./local-storage";

/** Convert `camelCase` to `kebab-case` */
function camelToKebab(text: string) {
  return text.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, "$1-$2").toLowerCase();
}

//#region Color Theme 스토어

/** 앱 색상 테마 */
export enum ColorTheme {
  Dark,
  Light,
  Auto,
}

export const colorThemeDefault = ColorTheme.Dark;

/** 앱 색상 테마 */
export const appColorTheme = localStorageWritable(camelToKebab("colorTheme"), colorThemeDefault);

//#endregion

//#region Max Recent Gallery Info List Length 스토어

export const maxRecentGalleryInfoListLengthDefault = 5;

/** 최근 연 갤러리 정보를 기억할 최대 개수 */
export const appMaxRecentGalleryInfoListLength = localStorageWritable(
  camelToKebab("maxRecentGalleryInfoListLength"),
  maxRecentGalleryInfoListLengthDefault
);

//#endregion

//#region Recent Gallery Info List 스토어

/** 최근 연 갤러리에 대한 간략한 정보 */
export interface RecentGalleryInfo {
  path: string;
  title: string;
  description: string;
}

/** 최근 연 갤러리 정보 리스트 (FIFO) */
export const appRecentGalleryInfoList = (function () {
  const store = localStorageWritable(
    camelToKebab("recentGalleryInfoList"),
    [] as RecentGalleryInfo[]
  );
  let maxLength = maxRecentGalleryInfoListLengthDefault;
  appMaxRecentGalleryInfoListLength.subscribe(newMaxLength => {
    maxLength = newMaxLength;
  });
  return {
    ...store,
    /** 스토어에 갤러리 정보 하나를 푸시합니다. */
    push(info) {
      store.update(list => {
        const idx = list.findIndex(li => li.path === info.path);
        if (idx >= 0) {
          list.splice(idx, 1);
        }
        list.splice(0, 0, info);
        if (list.length > maxLength) {
          list.splice(maxLength, list.length - maxLength);
        }
        return list;
      });
    },
  } as typeof store & { push(info: RecentGalleryInfo): void };
})();

//#endregion
