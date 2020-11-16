const { ipcRenderer } = require("electron");
import type * as Ipc from "../ipc";

const ipc = ipcRenderer as Ipc.TypedIpcRenderer;

export default ipc;
