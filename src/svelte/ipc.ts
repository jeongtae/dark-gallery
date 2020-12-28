const { ipcRenderer } = require("electron");
import type { TypedIpcRenderer } from "electron-typed-ipc";
import type { Commands, Events, GalleryConfigs } from "../common/ipc";

export type { GalleryConfigs, IndexingProgress } from "../common/ipc";

/** 타이핑 적용된 ipcRenderer 객체 */
export const ipc = ipcRenderer as TypedIpcRenderer<Events, Commands>;

/** 현재 갤러리의 데이터베이스에서 모든 설정을 가져옵니다.
 * @returns 설정 모음객체
 */
export async function getAllGalleryConfigs(): Promise<GalleryConfigs> {
  return await ipc.invoke("getAllGalleryConfigs");
}

/** 현재 갤러리의 데이터베이스에서 설정을 가져옵니다.
 * @param key 설정 키
 * @returns 설정 값
 */
export async function getGalleryConfig<K extends keyof GalleryConfigs>(
  key: K
): Promise<GalleryConfigs[K]> {
  const value = await ipc.invoke("getGalleryConfig", key);
  return value as GalleryConfigs[K];
}

/** 현재 갤러리의 데이터베이스에 설정을 저장합니다.
 * @param key 설정 키
 * @param value 설정 값
 */
export async function setGalleryConfig<K extends keyof GalleryConfigs>(
  key: K,
  value: GalleryConfigs[K]
): Promise<void> {
  await ipc.invoke("setGalleryConfig", key, value);
}
