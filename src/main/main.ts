import * as path from "path";
import { BrowserWindow, Menu, app, ipcMain } from "electron";
import oc from "open-color";
import * as AppIpc from "./ipc";
import * as AppMenu from "./menu";
import { isDev, isMac } from "./environment";
import { disposeSequelize } from "./sequelize";

export default abstract class Main {
  private static isStarted: boolean = false;

  public static main() {
    if (this.isStarted) {
      return;
    }
    this.isStarted = true;

    // Electron app
    app.once("ready", () => this.createWindow());
    app.on("window-all-closed", () => this.handleWindowAllClosed());
    app.on("activate", () => this.handleActivate());

    // Menu
    AppMenu.addEventListener("click-new-window", () => this.createWindow());
    AppMenu.addEventListener("click-preference", () => this.handleClickPreference());
    Menu.setApplicationMenu(AppMenu.menu);

    // Ipc
    for (const [key, handler] of Object.entries(AppIpc.commandHandlers)) {
      ipcMain.handle(key, handler);
    }
  }

  private static createWindow() {
    const window = new BrowserWindow({
      minWidth: 820,
      minHeight: 600,
      width: 960,
      height: 640,
      backgroundColor: oc.gray[9],
      frame: false,
      titleBarStyle: "hidden",
      webPreferences: {
        devTools: isDev,
        nodeIntegration: true,
        enableRemoteModule: true,
      },
    });
    window.loadFile(path.join(__dirname, "../public/index.html"));
    if (isDev) {
      window.webContents.openDevTools();
    }
    window.on("closed", () => disposeSequelize(window.id));
    return window;
  }

  private static handleWindowAllClosed() {
    if (!isMac) {
      app.quit();
    }
  }

  private static handleActivate() {
    if (BrowserWindow.getAllWindows().length === 0) {
      this.createWindow();
    }
  }

  private static handleClickPreference() {
    const allWindows = BrowserWindow.getAllWindows();
    if (allWindows.length) {
      let window = BrowserWindow.getFocusedWindow() ?? allWindows[0];
      window.focus();
      AppIpc.sendEvent(window, "openPreference");
    } else {
      const newWindow = this.createWindow();
      newWindow.webContents.once("did-finish-load", () =>
        AppIpc.sendEvent(newWindow, "openPreference")
      );
    }
  }
}
