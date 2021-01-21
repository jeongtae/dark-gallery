import { path as nodePath } from "../node";
import { writable, readable } from "svelte/store";
// import type { IndexingProgress } from "../ipc";
import { appColorThemeDefault, appColorTheme } from "./app-settings";
import { reloadAllGalleryConfigs } from "./gallery-configs";

export * from "./app-settings";
export * from "./gallery-configs";

/** 현재 열린 갤러리의 경로 */
export const currentGalleryPath = writable<string>(null);
currentGalleryPath.subscribe(galleryPath => galleryPath && reloadAllGalleryConfigs());

/** 현재 열린 갤러리의 썸네일 경로 */
export const currentGalleryThumbnailPath = readable<string>(null, set => {
  const unsubscribe = currentGalleryPath.subscribe(galleryPath => {
    if (galleryPath) {
      set(nodePath.join(galleryPath, ".darkgallery", "thumbs"));
    } else {
      set(null);
    }
  });
  return unsubscribe;
});

/** 갤러리 제목의 폴백 */
export const galleryTitleFallback = readable<string>(null, set => {
  const unsubscribe = currentGalleryPath.subscribe(galleryPath => {
    set(nodePath.basename(galleryPath ?? ""));
  });
  return unsubscribe;
});

/** 앱 색상 테마의 계산된 결과 (자동으로 설정한 것도 대응)  */
export const appColorThemeCalculated = readable<"dark" | "light">(appColorThemeDefault, set => {
  let isAutoMode = false;
  const darkModeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  function setToMediaQueryResult() {
    if (isAutoMode) {
      set(darkModeMediaQuery.matches ? "dark" : "light");
    }
  }
  darkModeMediaQuery.addEventListener("change", setToMediaQueryResult);
  const unsubscribe = appColorTheme.subscribe(colorTheme => {
    switch (colorTheme) {
      case "dark":
        isAutoMode = false;
        set("dark");
        break;
      case "light":
        isAutoMode = false;
        set("light");
        break;
      default:
        isAutoMode = true;
        setToMediaQueryResult();
    }
  });
  return () => {
    darkModeMediaQuery.removeEventListener("change", setToMediaQueryResult);
    unsubscribe();
  };
});

/** 마지막으로 보고된 인덱싱 진행 상태 */
export const lastReportedIndexingProgress = writable<any>(null);
