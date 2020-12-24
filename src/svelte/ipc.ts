const { ipcRenderer } = require("electron");
import type { TypedIpcRenderer } from "electron-typed-ipc";
import type { Commands, Events, GalleryConfigs } from "../common/ipc";

const ipc = ipcRenderer as TypedIpcRenderer<Events, Commands>;

export default ipc;

export type { GalleryConfigs };
