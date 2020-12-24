import { throttle } from "lodash";
import { writable } from "svelte/store";

function getLocalStorage(key: string): any {
  const json: string = window.localStorage.getItem(key);
  return json ? JSON.parse(json) : null;
}

function setLocalStorage(key: string, value: any): void {
  const json: string = JSON.stringify(value);
  window.localStorage.setItem(key, json);
}

function localStorageWritable<T>(storageKey: string, initialValue: T) {
  const thisStore = writable<T>(getLocalStorage(storageKey) ?? initialValue);
  const setLocalStorageThrottled = throttle(setLocalStorage, 1000);
  thisStore.subscribe(newValue => setLocalStorageThrottled(storageKey, newValue));
  return thisStore;
}

export { localStorageWritable };
