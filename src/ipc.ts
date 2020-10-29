import ElectronTypedIpc from "electron-typed-ipc";

// Main -> Renderer
type Events = {};

// Renderer -> Main
type Commands = {
  pickDirectory: (args: { title?: string; buttonLabel?: string }) => string;
};

export type TypedIpcMain = ElectronTypedIpc.TypedIpcMain<Events, Commands>;
export type TypedIpcRenderer = ElectronTypedIpc.TypedIpcRenderer<Events, Commands>;
