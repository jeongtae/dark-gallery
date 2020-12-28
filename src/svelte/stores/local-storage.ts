import { DebouncedFunc, throttle } from "lodash";
import { Writable, writable } from "svelte/store";

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

// 외부에서의 로컬 스토리지의 변경을 감지
const localStorageStores: {
  [storageKey: string]: LocalStorageWritable<any>;
} = {};
window.addEventListener("storage", ({ key, newValue }) => {
  const store = localStorageStores[key];
  if (store) {
    const parsedObject = JSON.parse(newValue);
    store.cancelPendingReflection();
    store.setWithoutReflection(parsedObject);
  }
});

interface LocalStorageWritable<T> extends Writable<T> {
  setWithoutReflection(value: T): void;
  cancelPendingReflection(): void;
}
/** 내용이 `LocalStorage`에 저장되는 `Writable` 스토어를 생성합니다.
 * @param storageKey `LocalStorage` 키 값
 * @param initialValue 초기 값
 * @returns 스토어
 */
export function localStorageWritable<T>(
  storageKey: string,
  initialValue: T
): LocalStorageWritable<T> {
  if (storageKey in localStorageStores) {
    throw new Error(
      "There is another writable store that has already created with the given storage key."
    );
  }
  const setLocalStorageThrottled = throttle(setLocalStorage, 1000);
  const writableStore = writable<T>(getLocalStorage(storageKey) ?? initialValue);
  const localStorageStore: LocalStorageWritable<T> = {
    ...writableStore,
    set(value) {
      writableStore.set(value);
      setLocalStorageThrottled(storageKey, value);
    },
    update(updater) {
      writableStore.update(value => {
        const newValue = updater(value);
        setLocalStorageThrottled(storageKey, value);
        return newValue;
      });
    },
    setWithoutReflection(value) {
      writableStore.set(value);
    },
    cancelPendingReflection() {
      setLocalStorageThrottled.cancel();
    },
  };
  localStorageStores[storageKey] = localStorageStore;
  return localStorageStore;
}
