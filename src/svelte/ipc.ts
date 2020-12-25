const { ipcRenderer } = require("electron");
import type { TypedIpcRenderer } from "electron-typed-ipc";
import type { Commands, Events } from "../common/ipc";

export type { GalleryConfigs } from "../common/ipc";

/** 타이핑 적용된 ipcRenderer 객체 */
export const ipc = ipcRenderer as TypedIpcRenderer<Events, Commands>;
