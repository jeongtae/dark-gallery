import path from "path";
import { BrowserWindow } from "electron";
import oc from "open-color";
import { isDev } from "./environments";

export function createWindow(): BrowserWindow {
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
    window.webContents.once("devtools-opened", () => window.webContents.focus());
  }

  return window;
}

export function getWindow(frameId: number): BrowserWindow {
  return BrowserWindow.fromId(frameId);
}

export const { getAllWindows } = BrowserWindow;
