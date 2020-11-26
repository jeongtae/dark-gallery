import { BrowserWindow, ipcMain, IpcMainEvent } from "electron";
import type { TypedIpcMain, TypedWebContents } from "electron-typed-ipc";
import type { Events, Commands, GalleryPathInfo } from "../common/ipc";

declare type OptionalPromise<T> = T | Promise<T>;

export const ipc = ipcMain as TypedIpcMain<Events, Commands>;

export function sendEvent<E extends keyof Events>(
  window: BrowserWindow,
  event: E,
  ...args: Parameters<Events[E]>
) {
  window.webContents.send(event, ...args);
}

export type IpcHandlers = {
  [C in keyof Commands]: (
    event: IpcMainEvent,
    ...args: Parameters<Commands[C]>
  ) => OptionalPromise<ReturnType<Commands[C]>>;
};

export type { GalleryPathInfo };
