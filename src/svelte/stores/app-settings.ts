/**
 * @fileoverview 로컬 스토리지에 저장되는 스토어 모음입니다.
 * 스토어에 변경을 가하면 로컬 스토리지에 주기적으로 반영됩니다.
 * 연속적으로 변경을 가하면서 마지막 변경 직후에 앱을 종료하면,
 *   변경사항이 로컬 스토리지에 반영되지 않을 수 있습니다.
 */
import { throttle } from "lodash";
import { writable } from "svelte/store";

/** `LocalStorage`에서 값을 가져옵니다. */
function getLocalStorage(key: string): any {
  const json: string = window.localStorage.getItem(key);
  return json ? JSON.parse(json) : null;
}

/** `LocalStorage`에 값을 설정합니다. */
function setLocalStorage(key: string, value: any): void {
  const json: string = JSON.stringify(value);
  window.localStorage.setItem(key, json);
}

/** 내용이 `LocalStorage`에 저장되는 `Writable` 스토어를 생성합니다.
 * @param storageKey `LocalStorage` 키 값
 * @param initialValue 초기 값
 * @returns 스토어
 */
function localStorageWritable<T>(storageKey: string, initialValue: T) {
  const thisStore = writable<T>(getLocalStorage(storageKey) ?? initialValue);
  const setLocalStorageThrottled = throttle(setLocalStorage, 1000);
  thisStore.subscribe(newValue => setLocalStorageThrottled(storageKey, newValue));
  return thisStore;
}

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
  title: string;
  path: string;
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
