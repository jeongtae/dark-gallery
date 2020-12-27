import { writable } from "svelte/store";
import { reloadAllGalleryConfigs } from "./gallery-configs";

export * from "./app-settings";
export * from "./gallery-configs";

/** 현재 열린 갤러리의 경로 */
export const currentGalleryPath = writable<string>(null);
currentGalleryPath.subscribe(galleryPath => galleryPath && reloadAllGalleryConfigs());
