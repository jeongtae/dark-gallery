import { writable } from "svelte/store";
import { storageWritable } from "./storage";

export const currentGalleryPathStore = writable<string>("test");

interface RecentGalleryInfo {
  title: string;
  path: string;
}
export const recentGalleryInfoListStore = storageWritable<RecentGalleryInfo[]>(
  "recent-gallery-info-list",
  []
);

enum ColorTheme {
  Dark,
  Light,
  Auto,
}
interface GlobalSettings {
  colorTheme?: ColorTheme;
  maxRecentGalleriesCount?: number;
}
export const defaultGlobalSettings: GlobalSettings = {
  colorTheme: ColorTheme.Dark,
  maxRecentGalleriesCount: 5,
};
export const globalSettingsStore = storageWritable<GlobalSettings>("global-settings", {});
globalSettingsStore.update(settings => ({ ...defaultGlobalSettings, ...settings }));
