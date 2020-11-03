import * as path from "path";
import { app, BrowserWindow } from "electron";
import oc from "open-color";
import { addIpcHandlers } from "./ipc";

export default class Main {
  readonly isMac: boolean;
  constructor(readonly isDev: boolean) {
    this.isMac = process.platform === "darwin";
  }

  public init() {
    this.initAppEventHandlers();
    this.initIpcHandlers();
  }

  private initAppEventHandlers() {
    app.once("ready", () => this.createWindow());
    app.on("window-all-closed", () => this.handleWindowAllClosed());
    app.on("activate", () => this.handleActivate());
  }

  private initIpcHandlers() {
    addIpcHandlers();
  }

  private createWindow() {
    const window = new BrowserWindow({
      minWidth: 820,
      minHeight: 600,
      width: 960,
      height: 640,
      backgroundColor: oc.gray[9],
      frame: false,
      titleBarStyle: "hidden",
      webPreferences: {
        devTools: this.isDev,
        nodeIntegration: true,
        enableRemoteModule: true,
      },
    });
    window.loadFile(path.join(__dirname, "../public/index.html"));
    if (this.isDev) {
      window.webContents.openDevTools();
    }
  }

  private handleWindowAllClosed() {
    if (!this.isMac) {
      app.quit();
    }
  }

  private handleActivate() {
    if (BrowserWindow.getAllWindows().length === 0) {
      this.createWindow();
    }
  }
}
