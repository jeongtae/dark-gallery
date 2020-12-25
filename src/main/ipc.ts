import { BrowserWindow, ipcMain, IpcMainEvent } from "electron";
import type { TypedIpcMain } from "electron-typed-ipc";
import type { Events, Commands } from "../common/ipc";

export type { IndexingProgress, GalleryPathInfo } from "../common/ipc";

/** 타이핑 적용된 ipcMain 객체 */
export const ipc = ipcMain as TypedIpcMain<Events, Commands>;

/** Renderer에게 이벤트를 보냅니다. */
export function sendEvent<E extends keyof Events>(
  window: BrowserWindow,
  event: E,
  ...args: Parameters<Events[E]>
) {
  window.webContents.send(event, ...args);
}

declare type OptionalPromise<T> = T | Promise<T>;
export type IpcHandlers = {
  [C in keyof Commands]: (
    event: IpcMainEvent,
    ...args: Parameters<Commands[C]>
  ) => OptionalPromise<ReturnType<Commands[C]>>;
};
