import { BrowserWindow } from "electron";
import type { CommandHandlers, Events } from "../../ipc";

import pickDirectory from "./pickDirectory";
import getPathStatus from "./getPathStatus";

export const commandHandlers: CommandHandlers = {
  pickDirectory,
  getPathStatus,
};

export function sendEvent<E extends keyof Events>(
  window: BrowserWindow,
  event: E,
  ...args: Parameters<Events[E]>
) {
  window.webContents.send(event, ...args);
}
