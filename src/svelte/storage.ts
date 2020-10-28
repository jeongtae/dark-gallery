import { writable } from "svelte/store";

const storage = {
  get(key: string) {
    const value = localStorage.getItem(key);
    if (value) {
      return JSON.parse(value);
    } else {
      return null;
    }
  },
  set(key: string, value: any) {
    localStorage.setItem(key, JSON.stringify(value));
  },
};

function storageWritable<T>(storageKey: string, initialValue: T) {
  const store = writable<T>(storage.get(storageKey) ?? initialValue);
  store.subscribe(value => storage.set(storageKey, value));
  return store;
}

export { storage as default, storageWritable };
