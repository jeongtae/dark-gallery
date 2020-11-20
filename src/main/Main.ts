import path from "path";
import fs from "fs";
import { promisify } from "util";
import { app, dialog } from "electron";
import { isSquirrelStartup, isDev, isMac, appPath } from "./environments";
import { ipc, IpcHandlers } from "./ipc";
import { createWindow, getAllWindows, getWindow } from "./window";
import Gallery, { buildIndexDirectoryPath, buildSqliteFilePath } from "./Gallery";
import rimraf from "rimraf";
const rimrafPromise = promisify(rimraf);

/** 이 애플리케이션의 진입 클래스 */
export default class Main {
  private static initialized: boolean = false;

  galleries: { [frameId: number]: Gallery } = {};

  constructor(readonly argv?: string[]) {
    // 단일 인스턴스만 허용
    if (Main.initialized) throw new Error("class 'Main' is already initialized.");
    Main.initialized = true;

    // Electron Squirrel Startup 처리
    if (isSquirrelStartup) {
      app.quit();
    }

    // Electron Reload 처리
    if (isDev) {
      import("electron-reload").then(({ default: watch }) => {
        watch(path.join(appPath, "dist"), {
          electron: path.join(appPath, "node_modules", ".bin", "electron"),
          awaitWriteFinish: true,
        });
      });
    }

    // 일렉트론 app 이벤트 핸들러 등록
    app.once("ready", this.onAppReady.bind(this));
    app.on("window-all-closed", this.onAppWindowAllClosed.bind(this));
    app.on("activate", this.onAppActivate.bind(this));
    app.on("quit", this.onAppQuit.bind(this));

    // 일렉트론 ipcMain 이벤트 핸들러 등록
    ipc.handle("pickDirectory", this.onIpcPickDirectory.bind(this));
    ipc.handle("checkGalleryPath", this.onIpcCheckGalleryPath.bind(this));
    ipc.handle("createAndOpenGallery", this.onIpcCreateAndOpenGallery.bind(this));
    ipc.handle("openGallery", this.onIpcOpenGallery.bind(this));
    ipc.handle("getDevGalleryPath", this.onIpcGetDevGalleryPath.bind(this));
  }

  /** 새 윈도우 생성 */
  createWindow() {
    const window = createWindow();
    const { id } = window;
    window.on("closed", () => this.onWindowClosed(id));
    window.menuBarVisible = true;
  }

  //#region 일렉트론 BrowserWindow의 이벤트 핸들러
  async onWindowClosed(frameId: number) {
    await this.galleries[frameId]?.dispose();
    delete this.galleries[frameId];
  }
  //#endregion

  //#region 일렉트론 app의 이벤트 핸들러
  /** 일렉트론 `app`의 `ready` 이벤트 핸들러 */
  onAppReady() {
    this.createWindow();
  }
  /** 일렉트론 `app`의 `window-all-closed` 이벤트 핸들러 */
  onAppWindowAllClosed() {
    if (!isMac) {
      app.quit();
    }
  }
  /** 일렉트론 `app`의 `activate` 이벤트 핸들러 */
  onAppActivate() {
    if (getAllWindows().length === 0) {
      this.createWindow();
    }
  }
  /** 일렉트론 `app`의 `quit` 이벤트 핸들러 */
  onAppQuit() {}
  //#endregion

  //#region ipc 이벤트 핸들러
  onIpcPickDirectory: IpcHandlers["pickDirectory"] = async (
    { frameId },
    { title, buttonLabel }
  ) => {
    const window = getWindow(frameId);
    const result = await dialog.showOpenDialog(window, {
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
  };
  onIpcCheckGalleryPath: IpcHandlers["checkGalleryPath"] = async (event, { path }) => {
    return await Gallery.checkGalleryPath(path);
  };
  onIpcCreateAndOpenGallery: IpcHandlers["createAndOpenGallery"] = async (
    { frameId },
    { path }
  ) => {
    const gallery = new Gallery(path, true);
    try {
      await gallery.open();
      const title = await gallery.getTitle();
      this.galleries[frameId] = gallery;
      return title;
    } catch {
      await gallery.dispose();
      return null;
    }
  };
  onIpcOpenGallery: IpcHandlers["openGallery"] = async ({ frameId }, { path }) => {
    const isDevGallery = !path;
    let isNew = false;
    if (isDevGallery) {
      if (!isDev) {
        return null;
      }
      path = this.onIpcGetDevGalleryPath(null) as string;
      try {
        const sqlitePath = buildSqliteFilePath(path);
        await fs.promises.access(sqlitePath);
      } catch {
        const indexPath = buildIndexDirectoryPath(path);
        await fs.promises.mkdir(indexPath, { recursive: true });
        isNew = true;
      }
    }
    const gallery = new Gallery(path, isNew);
    try {
      await gallery.open();
      const title = await gallery.getTitle();
      await this.galleries[frameId]?.dispose();
      this.galleries[frameId] = gallery;
      return title;
    } catch {
      await gallery.dispose();
      return null;
    }
  };
  onIpcGetDevGalleryPath: IpcHandlers["getDevGalleryPath"] = () => {
    return path.join(app.getAppPath(), "dev-gallery");
  };
  onIpcResetGallery: IpcHandlers["resetDevGallery"] = async () => {
    if (!isDev) {
      return false;
    }
    try {
      const galleryPath = path.join(app.getAppPath(), "dev-gallery");
      const indexPath = buildIndexDirectoryPath(galleryPath);
      await fs.promises.access(indexPath);
      await rimrafPromise(indexPath);
      return true;
    } catch {
      return false;
    }
  };
  //#endregion
}
