/**
 * @fileoverview 갤러리 데이터베이스에 저장되는 스토어 모음입니다.
 * 스토어 모음의 구성은 IPC에 기술된 `GalleryConfigs`에 의존합니다.
 * 모든 스토어의 타입은 동일합니다. (`GalleryConfigWritable<T>`)
 * 스토어에 변경을 가하면 현재 열린 갤러리 데이터베이스에 주기적으로 반영됩니다.
 * 연속적으로 변경을 가하면서 마지막 변경 직후에 앱을 종료하거나 갤러리를 변경하면,
 *   변경사항이 갤러리 데이터베이스에 반영되지 않을 수 있습니다.
 * 데이터베이스에 반영하지 않고 스토어 값을 변경하려면, `set` 대신 `setWithoutReflection` 메서드를 호출하세요.
 * 데이터베이스에 반영되는 것을 중단하고 싶다면 `disableSetterReflection` 메서드를 호출하세요.
 * 현재 열린 갤러리가 변경되어 스토어 값의 재설정이 필요하면 `reloadAllGalleryConfigs` 함수를 호출하세요.
 */
import type { PascalCase, CamelCase } from "type-fest";
import { throttle } from "lodash";
import { writable, Writable } from "svelte/store";
import { ipc, GalleryConfigs } from "../ipc";

/** 현재 갤러리의 데이터베이스에서 모든 설정을 가져옵니다.
 * @returns 설정 모음객체
 */
async function getAllGalleryConfigs(): Promise<GalleryConfigs> {
  return await ipc.invoke("getAllGalleryConfigs");
}

// /** 현재 갤러리의 데이터베이스에서 설정을 가져옵니다.
//  * @param key 설정 키
//  * @returns 설정 값
//  */
// async function getGalleryConfig<K extends keyof GalleryConfigs>(
//   key: K
// ): Promise<GalleryConfigs[K]> {
//   const value = await ipc.invoke("getGalleryConfig", key);
//   return value as GalleryConfigs[K];
// }

/** 현재 갤러리의 데이터베이스에 설정을 저장합니다.
 * @param key 설정 키
 * @param value 설정 값
 */
async function setGalleryConfig<K extends keyof GalleryConfigs>(
  key: K,
  value: GalleryConfigs[K]
): Promise<void> {
  await ipc.invoke("setGalleryConfig", key, value);
}

export interface GalleryConfigWritable<T> extends Writable<T> {
  /** 스토어의 값을 변경하고, 설정에 따라 갤러리의 데이터베이스에 반영합니다. (기본: 반영함) */
  set(value: T): void;
  /** 스토어의 값을 변경하기만 하고, 갤러리의 데이터베이스에 반영하지는 않습니다. */
  setWithoutReflection(value: T): void;
  /** set 메서드가 값을 데이터베이스에 반영하도록 합니다. */
  enableSetterReflection(): void;
  /** set 메서드가 값을 데이터베이스에 반영되지 않게 합니다. */
  disableSetterReflection(): void;
}
/** 내용이 갤러리의 데이터베이스에 반영(reflects)되는 `GalleryConfigWritable` 스토어를 생성합니다.
 * 스토어의 초기값은 `null`입니다.
 * @param configKey 갤러리 데이터베이스에 사용될 설정 키 값
 * @returns 스토어
 */
function galleryConfigWritable<K extends keyof GalleryConfigs>(
  configKey: K
): GalleryConfigWritable<GalleryConfigs[K]> {
  const setGalleryConfigThrottled = throttle(
    (value: GalleryConfigs[K]) => setGalleryConfig(configKey, value),
    1000
  );
  const store = writable<any>(null);
  let isReflectionEnabled = true;
  return {
    ...store,
    set(value) {
      store.set(value);
      if (isReflectionEnabled) {
        setGalleryConfigThrottled(value);
      }
    },
    setWithoutReflection(value) {
      store.set(value);
    },
    enableSetterReflection() {
      isReflectionEnabled = true;
    },
    disableSetterReflection() {
      isReflectionEnabled = false;
      setGalleryConfigThrottled.cancel();
    },
  };
}

/** 문자열 앞에 gallery 접두어 붙이기 */
type PrefixAdded<String extends string> = `gallery${PascalCase<String>}`;

/** 문자열 앞의 gallery 접두어 없애기 */
type PrefixRemoved<String extends string> = String extends `gallery${infer Removed}`
  ? CamelCase<Removed>
  : String;

const galleryStores: {
  [key in PrefixAdded<keyof GalleryConfigs>]: GalleryConfigWritable<
    GalleryConfigs[PrefixRemoved<key>]
  >;
} = {
  galleryTitle: galleryConfigWritable("title"),
  galleryCreatedAt: galleryConfigWritable("createdAt"),
};
export const { galleryCreatedAt, galleryTitle } = galleryStores;

export async function reloadAllGalleryConfigs() {
  Object.values(galleryStores).forEach(store => {
    store.disableSetterReflection();
    store.set(null);
  });
  const allConfigs = await getAllGalleryConfigs();
  if (allConfigs) {
    for (const key of Object.keys(allConfigs)) {
      const configValue = allConfigs[key];
      const prefixedStoreName = `gallery${key[0].toUpperCase()}${key.substr(1)}`;
      const store = galleryStores[prefixedStoreName] as GalleryConfigWritable<any>;
      store.set(configValue);
      store.enableSetterReflection();
    }
  }
}
