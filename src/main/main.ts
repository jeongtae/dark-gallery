import * as path from "path";
import { app, BrowserWindow, ipcMain, dialog } from "electron";
import oc from "open-color";

export default class Main {
  private mainWindow: BrowserWindow;

  constructor(readonly isDev: boolean) {}

  public start() {
    app.once("ready", () => this.createMainWindow());
    app.on("window-all-closed", () => this.handleWindowAllClosed());
    app.on("activate", () => this.handleActivate());

    ipcMain.handle("pickDirectory", async (event, { title, buttonLabel }) => {
      const result = await dialog.showOpenDialog(this.mainWindow, {
        properties: ["openDirectory"],
        title,
        message: title,
        buttonLabel,
        securityScopedBookmarks: true,
      });
      if (result.filePaths.length) {
        return result.filePaths[0].normalize();
      } else {
        return "";
      }
    });
  }

  private createMainWindow() {
    this.mainWindow = new BrowserWindow({
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
    this.mainWindow.loadFile(path.join(__dirname, "../public/index.html"));
    if (this.isDev) {
      this.mainWindow.webContents.openDevTools();
    }
  }

  private handleWindowAllClosed() {
    if (process.platform !== "darwin") {
      app.quit();
    }
  }

  private handleActivate() {
    if (BrowserWindow.getAllWindows().length === 0) {
      this.createMainWindow();
    }
  }
}
