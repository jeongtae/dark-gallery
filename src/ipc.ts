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

export type TypedIpcMain = ElectronTypedIpc.TypedIpcMain<Events, Commands>;
export type TypedIpcRenderer = ElectronTypedIpc.TypedIpcRenderer<Events, Commands>;
