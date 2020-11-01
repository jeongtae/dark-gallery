import * as path from "path";
import fs from "fs";
import { app, BrowserWindow, ipcMain, dialog } from "electron";
import oc from "open-color";
import type * as Ipc from "../ipc";

const ipc = ipcMain as Ipc.TypedIpcMain;

export default class Main {
  private mainWindow: BrowserWindow;

  constructor(readonly isDev: boolean) {}

  public start() {
    app.once("ready", () => this.createMainWindow());
    app.on("window-all-closed", () => this.handleWindowAllClosed());
    app.on("activate", () => this.handleActivate());

    ipc.handle("pickDirectory", async (event, { title, buttonLabel } = {}) => {
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
        return null;
      }
    });

    ipc.handle("getPathStatus", async (event, { path: givenPath } = {}) => {
      const isAbsolute = path.isAbsolute(givenPath);
      try {
        await fs.promises.access(givenPath);
      } catch {
        return { isAbsolute, exists: false };
      }

      const pathStat = await fs.promises.lstat(givenPath);
      if (!pathStat.isDirectory()) {
        return { isAbsolute, exists: true, isDirectory: false };
      }

      const result: Ipc.PathStatus = {
        isAbsolute,
        exists: true,
        isDirectory: true,
        directoryHasReadPermission: false,
        directoryHasWritePermission: false,
      };
      const { R_OK, W_OK } = fs.constants;

      try {
        await fs.promises.access(givenPath, R_OK);
        result.directoryHasReadPermission = true;
        await fs.promises.access(givenPath, W_OK);
        result.directoryHasWritePermission = true;
      } catch {}

      if (isAbsolute) {
        const upper = (p: string) => path.join(p, "..");
        let upperLevelPath = givenPath;
        while (upperLevelPath !== upper(upperLevelPath)) {
          upperLevelPath = upper(upperLevelPath);
          const sqlitePath = path.join(upperLevelPath, `.darkgallery${path.sep}db.sqlite`);
          try {
            await fs.promises.access(sqlitePath);
            result.isDecendantOfGallery = true;
            break;
          } catch {}
        }
      }

      const sqlitePath = path.join(givenPath, `.darkgallery${path.sep}db.sqlite`);
      try {
        await fs.promises.access(sqlitePath);
        result.isGallery = true;
        await fs.promises.access(sqlitePath, R_OK);
        result.galleryHasReadPermission = true;
        await fs.promises.access(sqlitePath, W_OK);
        result.galleryHasWritePermission = true;
      } catch {}

      return result;
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
