import { throttle } from "lodash";
import { writable } from "svelte/store";

const getLocalStorage: (key: string) => string = localStorage.getItem.bind(localStorage);
const setLocalStorage: (key: string, value: string) => void = throttle(
  localStorage.setItem.bind(localStorage),
  500
);

const storage = {
  get(key: string) {
    const value = getLocalStorage(key);
    if (value) {
      return JSON.parse(value);
    } else {
      return null;
    }
  },
  set(key: string, value: any) {
    setLocalStorage(key, JSON.stringify(value));
  },
};

function storageWritable<T>(storageKey: string, initialValue: T) {
  const store = writable<T>(storage.get(storageKey) ?? initialValue);
  store.subscribe(value => storage.set(storageKey, value));
  return store;
}

export { storage as default, storageWritable };
