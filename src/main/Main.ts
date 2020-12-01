import path from "path";
import fs from "fs";
import { promisify } from "util";
import rimraf from "rimraf";
import { difference } from "lodash";
import { app, BrowserWindow, dialog, Menu, shell } from "electron";
import { MenuItemId } from "../common/ipc";
import { isSquirrelStartup, isDev, isMac, appPath } from "./environments";
import { ipc, IpcHandlers, sendEvent } from "./ipc";
import { getMenu, addMenuClickHandler, setMenuItemEnabled } from "./menu";
import { createWindow, getAllWindows, getWindow } from "./window";
import Gallery, { buildIndexDirectoryPath, buildSqliteFilePath } from "./Gallery";
import type { Models } from "./sequelize";
import { getAllChildFilePath, getFileInfo } from "./indexing";

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

    // 메뉴 및 그 이벤트 핸들러 등록
    Menu.setApplicationMenu(getMenu());
    addMenuClickHandler(this.onMenuClick.bind(this));

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
    ipc.handle("resetDevGallery", this.onIpcResetDevGallery.bind(this));
    ipc.handle("setMenuEnabled", this.onIpcSetMenuEnabled.bind(this));
    ipc.handle("startIndexing", this.onIpcStartIndexing.bind(this));
  }

  /** 새 윈도우 생성 */
  createWindow() {
    const window = createWindow();
    const { id } = window;
    window.on("closed", async () => await this.onWindowClosed(id));
    window.webContents.on("did-finish-load", () => this.onWindowDidFinishLoad(window));
    return window;
  }

  //#region 메뉴의 이벤트 핸들러
  async onMenuClick(id: MenuItemId, window: BrowserWindow) {
    switch (id) {
      case "openPreference": {
        const allWindows = BrowserWindow.getAllWindows();
        if (allWindows.length) {
          const window = BrowserWindow.getFocusedWindow() ?? allWindows[0];
          window.focus();
          sendEvent(window, "clickMenu", "openPreference");
        } else {
          const newWindow = this.createWindow();
          newWindow.webContents.once("did-finish-load", () =>
            sendEvent(newWindow, "clickMenu", "openPreference")
          );
        }
        break;
      }
      case "closeWindow": {
        BrowserWindow.getFocusedWindow()?.close();
        break;
      }
      case "newWindow": {
        this.createWindow();
        break;
      }
      case "help": {
        await shell.openExternal("https://blog.jeongtae.com");
        break;
      }
      default:
        sendEvent(window, "clickMenu", id);
    }
  }
  //#endregion

  //#region 일렉트론 BrowserWindow의 이벤트 핸들러
  async onWindowClosed(windowId: number) {
    await this.galleries[windowId]?.dispose();
    delete this.galleries[windowId];
  }
  async onWindowDidFinishLoad(window: BrowserWindow) {
    const gallery = this.galleries[window.id];
    if (gallery) {
      const title = await gallery.getTitle();
      const { path } = gallery;
      sendEvent(window, "openGallery", { path, title });
    }
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
  async onAppQuit() {
    for (const gallery of Object.values(this.galleries)) {
      await gallery.dispose();
    }
  }
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
  onIpcResetDevGallery: IpcHandlers["resetDevGallery"] = async () => {
    if (!isDev) {
      return false;
    }
    try {
      const galleryPath = path.join(app.getAppPath(), "dev-gallery");
      const indexPath = buildIndexDirectoryPath(galleryPath);
      await fs.promises.access(indexPath);
      await promisify(rimraf)(indexPath);
      return true;
    } catch {
      return false;
    }
  };
  onIpcSetMenuEnabled: IpcHandlers["setMenuEnabled"] = (event, id, enabled) => {
    setMenuItemEnabled(id, enabled);
  };
  onIpcStartIndexing: IpcHandlers["startIndexing"] = async (
    { frameId },
    { compareHash, findNew }
  ) => {
    // 물리적으로 존재하는 모든 파일 경로 수집
    const {
      path: galleryPath,
      models: { item: Item },
    } = this.galleries[frameId];

    // 데이터베이스에 존재하는 모든 파일 경로 수집
    const items = await Item.findAll({
      attributes: compareHash
        ? ["id", "path", "mtime", "size", "hash"]
        : ["id", "path", "mtime", "size"],
      raw: true,
    });

    // 원래 존재하는 것에 대해서 작업
    for (const {
      id: itemId,
      path: itemPath,
      mtime: itemMtime,
      size: itemSize,
      hash: itemHash,
    } of items) {
      try {
        const itemFullPath = path.join(galleryPath, itemPath);
        const { mtime: fileMtime, size: fileSize, hash: fileHash } = await getFileInfo(
          itemFullPath,
          { includeHash: compareHash }
        );
        const shouldUpdate =
          itemMtime !== fileMtime || itemSize !== fileSize || itemHash !== fileHash;
        if (shouldUpdate) {
          const mtime = fileMtime;
          const size = fileSize;
          const hash = fileHash || (await getFileInfo(itemFullPath, { includeHash: true })).hash;
          await Item.update({ mtime, size, hash }, { where: { id: itemId } });
        }
      } catch (e) {
        if (e.code === "ENOENT") {
          await Item.update({ lost: true }, { where: { id: itemId } });
        }
      }
    }

    // 새로 추가될 것에 대해 작업
    if (findNew) {
      const extensions = ["jpg", "jpeg", "gif", "png", "bmp", "webp", "webm", "mp4", "mov", "avi"];
      const allFilePaths = await getAllChildFilePath(galleryPath, {
        ignoreDirectories: [".darkgallery"],
        acceptingExtensions: extensions,
      });
      const allItemPaths = items.map(item => item.path);
      const newFilePaths = difference(allFilePaths, allItemPaths);
      const newItems: Models.ItemCreationAttributes[] = [];
      for (const filePath of newFilePaths) {
        const fullFilePath = path.join(galleryPath, filePath);
        const { mtime, size, hash } = await getFileInfo(fullFilePath, { includeHash: true });
        newItems.push({ mtime, size, hash, path: filePath });
      }
      await Item.bulkCreate(newItems);
    }
  };
  //#endregion
}
