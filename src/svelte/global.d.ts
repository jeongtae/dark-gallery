/// <reference types="node" />
/// <reference types="electron" />

interface NodeRequire {
  (id: "electron"): typeof Electron;
  (id: "electron/main"): typeof Electron.Main;
  (id: "electron/renderer"): typeof Electron.Renderer;
}
