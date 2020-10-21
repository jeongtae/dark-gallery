/// <reference types="electron" />

interface NodeRequire {
  (id: "electron"): typeof Electron;
  (id: "electron/main"): typeof Electron.Main;
  (id: "electron/renderer"): typeof Electron.Renderer;
  (id: "custom-electron-titlebar"): typeof import("custom-electron-titlebar");
  (id: "electron-is-dev"): typeof import("electron-is-dev");
}
