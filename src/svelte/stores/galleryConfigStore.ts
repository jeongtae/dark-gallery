import { throttle } from "lodash";
import { writable, Readable, readable } from "svelte/store";
import ipc, { GalleryConfigs } from "../ipc";

async function getGalleryConfig<K extends keyof GalleryConfigs>(
  key: K
): Promise<GalleryConfigs[K]> {
  const value = await ipc.invoke("getConfig", key);
  return value as GalleryConfigs[K];
}

async function setGalleryConfig<K extends WritableKeysOf<GalleryConfigs>>(
  key: K,
  value: GalleryConfigs[K]
) {
  await ipc.invoke("setConfig", key, value);
}

export function galleryConfigReadable<K extends keyof GalleryConfigs>(
  galleryPathStore: Readable<string>,
  key: K,
  initialValue: GalleryConfigs[K] = null
) {
  let setStore: (value: GalleryConfigs[K]) => void = null;
  const thisStore = readable<GalleryConfigs[K]>(initialValue, set => {
    setStore = set;
    return () => {
      setStore = null;
    };
  });
  galleryPathStore.subscribe(async newGalleryPath => {
    if (setStore) setStore(initialValue);
    if (newGalleryPath) {
      const configValue = await getGalleryConfig(key);
      if (setStore) setStore(configValue);
    }
  });
  return thisStore;
}

export function galleryConfigWritable<K extends keyof GalleryConfigs>(
  galleryPathStore: Readable<string>,
  key: K,
  initialValue: GalleryConfigs[K] = null
) {
  let galleryPath: string = null;
  const setGalleryConfigThrottled = throttle<
    (
      requestedGalleryPath: string,
      ...args: Parameters<typeof setGalleryConfig>
    ) => ReturnType<typeof setGalleryConfig>
  >((requestedGalleryPath, key, value) => {
    if (galleryPath !== null && galleryPath === requestedGalleryPath) {
      return setGalleryConfig(key, value);
    } else {
      return Promise.resolve();
    }
  }, 1000);
  const thisStore = writable<GalleryConfigs[K]>(initialValue);
  galleryPathStore.subscribe(async newGalleryPath => {
    galleryPath = newGalleryPath;
    thisStore.set(initialValue);
    if (newGalleryPath) {
      const configValue = await getGalleryConfig(key);
      thisStore.set(configValue);
    }
  });
  thisStore.subscribe(newValue => {
    setGalleryConfigThrottled(galleryPath, key, newValue);
  });
  return thisStore;
}
