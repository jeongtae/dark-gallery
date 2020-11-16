import { BrowserWindow } from "electron";
import type { CommandHandlers, Events } from "../../ipc";

import pickDirectory from "./pickDirectory";
import getPathStatus from "./getPathStatus";
import makeGallery from "./makeGallery";
import openGallery from "./openGallery";
import openDevGallery from "./openDevGallery";
import resetDevGallery from "./resetDevGallery";

export const commandHandlers: CommandHandlers = {
  pickDirectory,
  getPathStatus,
  makeGallery,
  openGallery,
  openDevGallery,
  resetDevGallery,
};

export function sendEvent<E extends keyof Events>(
  window: BrowserWindow,
  event: E,
  ...args: Parameters<Events[E]>
) {
  window.webContents.send(event, ...args);
}
