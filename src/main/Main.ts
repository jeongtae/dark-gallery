import path from "path";
import { throttle } from "lodash";
import { app, BrowserWindow, dialog, Menu, shell } from "electron";
import { IndexingProgress, MenuItemId } from "../common/ipc";
import { isSquirrelStartup, isDev, isMac, appPath } from "./environments";
import { ipc, IpcHandlers, sendEvent } from "./ipc";
import { getMenu, addMenuClickHandler, setMenuItemEnabled } from "./menu";
import { createWindow } from "./window";
import Gallery, { IndexingStep } from "./Gallery";

const DEV_GALLERY_PATH = path.join(app.getAppPath(), "dev-gallery");

/** 이 애플리케이션의 진입 클래스 */
export default class Main {
  private static initialized: boolean = false;

  /** WebContents ID별 열려있는 갤러리 모음객체 */
  private galleries: { [webContentsId: number]: Gallery } = {};

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
    for (const [key, handler] of Object.entries(this.ipcHandlers)) {
      ipc.handle(key as any, handler.bind(this));
    }
  }

  /** 새 윈도우를 생성합니다. */
  private createWindow() {
    const window = createWindow();
    const webContentsId = window.webContents.id;
    window.on("closed", async () => await this.onWindowClosed(webContentsId));
    window.webContents.on("did-finish-load", () => this.onWindowWebContentsDidFinishLoad(window));
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
          sendEvent(window.webContents, "clickMenu", "openPreference");
        } else {
          const newWindow = this.createWindow();
          newWindow.webContents.once("did-finish-load", () =>
            sendEvent(newWindow.webContents, "clickMenu", "openPreference")
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
        sendEvent(window.webContents, "clickMenu", id);
    }
  }
  //#endregion

  //#region 일렉트론 BrowserWindow의 이벤트 핸들러
  async onWindowClosed(webContentsId: number) {
    await this.galleries[webContentsId]?.dispose();
    delete this.galleries[webContentsId];
  }
  async onWindowWebContentsDidFinishLoad(window: BrowserWindow) {
    const gallery = this.galleries[window.webContents.id];
    if (gallery) {
      const { path } = gallery;
      sendEvent(window.webContents, "openGallery", path);
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
    if (BrowserWindow.getAllWindows().length === 0) {
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

  //#region IPC 이벤트 핸들러
  /** IPC 이벤트 핸들러 모음객체 */
  private ipcHandlers: IpcHandlers = {
    getDevGalleryPath: () => (isDev ? DEV_GALLERY_PATH : null),
    resetDevGallery: () => (isDev ? Gallery.resetGallery(DEV_GALLERY_PATH) : false),
    openDirectoryPickingDialog: async ({ sender }, { title, buttonLabel } = {}) => {
      const window = BrowserWindow.fromWebContents(sender);
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
    },
    getGalleryPathInfo: async (_, path) => await Gallery.getGalleryPathInfo(path),
    openGallery: async ({ sender }, path) => {
      const gallery = new Gallery(path);
      try {
        await gallery.open();
        await this.galleries[sender.id]?.dispose();
        this.galleries[sender.id] = gallery;
        return true;
      } catch {
        await gallery.dispose();
      }
      return false;
    },
    setMenuEnabled: async (_, id, enabled) => {
      // TODO: 윈도우 id별로 상태 저장하고, 윈도우 focus될 때 메뉴에 적용시키는 매커니즘이 필요하다.
      setMenuItemEnabled(id, enabled);
    },
    startIndexingForNewFiles(this: Main, { sender }) {
      (async () => {
        const gallery = this.galleries[sender.id];
        const generator = gallery.generateIndexingSequenceForNewFiles();
        for await (const step of generator) {
          console.log(step);
        }
        //
      })();
    },
    startGalleryIndexing: async ({ sender }, compareHash = false) => {
      const sendProgressReport = (progress: IndexingProgress) =>
        sendEvent(sender, "reportGalleryIndexingProgress", progress);
      const sendProgressReportThrottled = throttle(sendProgressReport, 500, { trailing: false });

      // 준비중 보고
      let newlyLostList: string[] = [];
      let errorList: string[] = [];
      await sendProgressReport({
        phase: "started",
        totalCount: 0,
        leftCount: 0,
        newlyLostList,
        errorList,
      });

      const gallery = this.galleries[sender.id];
      const generator = gallery.generateIndexingSequence({ compareHash });
      const indexingStepFirst = (await generator.next()).value as IndexingStep;

      // 시작보고
      await sendProgressReport({
        phase: "processing",
        totalCount: indexingStepFirst.total,
        leftCount: indexingStepFirst.total,
        newlyLostList,
        errorList,
      });

      // 본격 인덱싱하며 계속 중간보고
      for await (const step of generator) {
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
    },
    abortGalleryIndexing: async ({ sender }) => {
      // TODO: 구현하기
    },
    getItems: async ({ sender }) => {
      const {
        models: { item: Item },
      } = this.galleries[sender.id];
      return Item.findAll({ raw: true });
    },
    getAllGalleryConfigs: async ({ sender }) => {
      const gallery = this.galleries[sender.id];
      return (await gallery?.getAllConfigs()) ?? null;
    },
    getGalleryConfig: async ({ sender }, key) => {
      const gallery = this.galleries[sender.id];
      return (await gallery?.getConfig(key)) ?? null;
    },
    setGalleryConfig: async ({ sender }, key, value) => {
      const gallery = this.galleries[sender.id];
      await gallery?.setConfig(key, value);
    },
  };
  //#endregion
}
