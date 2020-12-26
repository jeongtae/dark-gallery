import path from "path";
import { throttle } from "lodash";
import { app, BrowserWindow, dialog, Menu, shell } from "electron";
import { IndexingProgress, MenuItemId } from "../common/ipc";
import { isSquirrelStartup, isDev, isMac, appPath } from "./environments";
import { ipc, IpcHandlers, sendEvent } from "./ipc";
import { getMenu, addMenuClickHandler, setMenuItemEnabled } from "./menu";
import { createWindow, getAllWindows, getWindow } from "./window";
import Gallery, { IndexingStep } from "./Gallery";

const DEV_GALLERY_PATH = path.join(app.getAppPath(), "dev-gallery");

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
    ipc.handle("getDevGalleryPath", this.onIpcGetDevGalleryPath.bind(this));
    ipc.handle("resetDevGallery", this.onIpcResetDevGallery.bind(this));
    ipc.handle("openDirectoryPickingDialog", this.onIpcOpenDirectoryPickingDialog.bind(this));
    ipc.handle("getGalleryPathInfo", this.onIpcGetGalleryPathInfo.bind(this));
    ipc.handle("openGallery", this.onIpcOpenGallery.bind(this));
    ipc.handle("setMenuEnabled", this.onIpcSetMenuEnabled.bind(this));
    ipc.handle("startGalleryIndexing", this.onIpcStartGalleryIndexing.bind(this));
    ipc.handle("abortGalleryIndexing", this.onIpcStartGalleryIndexing.bind(this));
    ipc.handle("getAllGalleryConfigs", this.onIpcGetAllGalleryConfigs.bind(this));
    ipc.handle("getGalleryConfig", this.onIpcGetGalleryConfig.bind(this));
    ipc.handle("setGalleryConfig", this.onIpcSetGalleryConfig.bind(this));
    ipc.handle("getItems", this.onIpcGetItems.bind(this));
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
      const title = await gallery.getConfig("title");
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
  onIpcGetDevGalleryPath: IpcHandlers["getDevGalleryPath"] = () => {
    return isDev ? DEV_GALLERY_PATH : null;
  };
  onIpcResetDevGallery: IpcHandlers["resetDevGallery"] = async () => {
    return isDev ? Gallery.resetGallery(DEV_GALLERY_PATH) : false;
  };
  onIpcOpenDirectoryPickingDialog: IpcHandlers["openDirectoryPickingDialog"] = async (
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
  onIpcGetGalleryPathInfo: IpcHandlers["getGalleryPathInfo"] = async (event, { path }) => {
    return await Gallery.getGalleryPathInfo(path);
  };
  onIpcOpenGallery: IpcHandlers["openGallery"] = async ({ frameId }, { path }) => {
    const gallery = new Gallery(path);
    try {
      await gallery.open();
      const title = await gallery.getConfig("title");
      await this.galleries[frameId]?.dispose();
      this.galleries[frameId] = gallery;
      return title;
    } catch {
      await gallery.dispose();
    }
    return null;
  };

  onIpcSetMenuEnabled: IpcHandlers["setMenuEnabled"] = (event, id, enabled) => {
    // TODO: 윈도우 id별로 상태 저장하고, 윈도우 focus될 때 메뉴에 적용시키는 매커니즘이 필요하다.
    setMenuItemEnabled(id, enabled);
  };
  onIpcStartGalleryIndexing: IpcHandlers["startGalleryIndexing"] = async ({ frameId }) => {
    const window = BrowserWindow.fromId(frameId);
    const sendProgressReport = (progress: IndexingProgress) =>
      sendEvent(window, "reportGalleryIndexingProgress", progress);
    const sendProgressReportThrottled = throttle(sendProgressReport, 1000, { trailing: false });

    // 시작보고
    const gallery = this.galleries[frameId];
    const generator = gallery.generateIndexingSequence({ compareHash: true });
    const indexingStepFirst = (await generator.next()).value as IndexingStep;
    let newlyLostList: string[] = [];
    let errorList: string[] = [];
    await sendProgressReport({
      phase: "started",
      totalCount: indexingStepFirst.total,
      leftCount: indexingStepFirst.total,
      newlyLostList,
      errorList,
    });

    // 본격 인덱싱하며 계속 중간보고
    for await (const step of generator) {
      console.log(step);
      const { result, path } = step.processed;
      switch (result) {
        case "newlyLost":
          newlyLostList.push(path);
          break;
        case "error":
          errorList.push(path);
          break;
      }
      await sendProgressReportThrottled({
        phase: "processing",
        totalCount: step.total,
        leftCount: step.left,
        newlyLostList,
        errorList,
      });
    }

    // 완료 보고
    await sendProgressReport({
      phase: "ended",
      totalCount: indexingStepFirst.total,
      leftCount: 0,
      errorList,
      newlyLostList,
    });
  };
  onIpcAbortGalleryIndexing: IpcHandlers["abortGalleryIndexing"] = async ({ frameId }) => {
    // TODO: 구현하기
  };
  onIpcGetItems: IpcHandlers["getItems"] = async ({ frameId }) => {
    const {
      models: { item: Item },
    } = this.galleries[frameId];
    return Item.findAll({ raw: true });
  };
  onIpcGetAllGalleryConfigs: IpcHandlers["getAllGalleryConfigs"] = async ({ frameId }) => {
    const gallery = this.galleries[frameId];
    return await gallery.getAllConfigs();
  };
  onIpcGetGalleryConfig: IpcHandlers["getGalleryConfig"] = async ({ frameId }, key) => {
    const gallery = this.galleries[frameId];
    return await gallery.getConfig(key);
  };
  onIpcSetGalleryConfig: IpcHandlers["setGalleryConfig"] = async ({ frameId }, key, value) => {
    const gallery = this.galleries[frameId];
    await gallery.setConfig(key, value);
  };
  //#endregion
}
