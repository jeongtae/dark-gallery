import { path as nodePath } from "../node";
import { writable, readable } from "svelte/store";
import type { IndexingProgress } from "../ipc";
import { reloadAllGalleryConfigs } from "./gallery-configs";

export * from "./app-settings";
export * from "./gallery-configs";

/** 현재 열린 갤러리의 경로 */
export const currentGalleryPath = writable<string>(null);
currentGalleryPath.subscribe(galleryPath => galleryPath && reloadAllGalleryConfigs());

/** 갤러리 제목의 폴백 */
export const galleryTitleFallback = readable<string>(null, set => {
  const unsubscribe = currentGalleryPath.subscribe(galleryPath => {
    set(nodePath.basename(galleryPath ?? ""));
  });
  return unsubscribe;
});

/** 마지막으로 보고된 인덱싱 진행 상태 */
export const lastReportedIndexingProgress = writable<IndexingProgress>(null);
