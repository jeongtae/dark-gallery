import { IpcMainEvent } from "electron";
import ElectronTypedIpc from "electron-typed-ipc";

// Main -> Renderer
type Events = {};

// Renderer -> Main
export interface PathStatus {
  isAbsolute: boolean;
  exists: boolean;
  isDirectory?: boolean;
  directoryHasReadPermission?: boolean;
  directoryHasWritePermission?: boolean;
  isDecendantOfGallery?: boolean;
  isGallery?: boolean;
  galleryHasReadPermission?: boolean;
  galleryHasWritePermission?: boolean;
}

type Commands = {
  pickDirectory: (args: { title?: string; buttonLabel?: string }) => string;
  getPathStatus: (args: { path: string }) => PathStatus;
};

export type CommandListeners = {
  [K in keyof Commands]: (
    event: IpcMainEvent,
    ...args: Parameters<Commands[K]>
  ) => ReturnType<Commands[K]>;
};

export type CommandHandlers = {
  [K in keyof CommandListeners]: (
    ...args: Parameters<CommandListeners[K]>
  ) => ReturnType<CommandListeners[K]> | Promise<ReturnType<CommandListeners[K]>>;
};

export type TypedIpcMain = ElectronTypedIpc.TypedIpcMain<Events, Commands>;
export type TypedIpcRenderer = ElectronTypedIpc.TypedIpcRenderer<Events, Commands>;
