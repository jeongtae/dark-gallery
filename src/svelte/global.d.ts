/// <reference types="electron" />

interface NodeRequire {
  (id: "electron"): typeof Electron;
  (id: "electron/common"): typeof Electron.Common;
  (id: "electron/main"): typeof Electron.Main;
  (id: "electron/renderer"): typeof Electron.Renderer;
  (id: "custom-electron-titlebar"): typeof import("custom-electron-titlebar");
  (id: "electron-is"): typeof import("electron-is");
  (id: "path"): typeof import("path");
}
