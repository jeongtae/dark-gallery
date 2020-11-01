import { ipcMain } from "electron";
import type { CommandHandlers } from "../../ipc";

import pickDirectory from "./pickDirectory";
import getPathStatus from "./getPathStatus";

const commandHandlers: CommandHandlers = {
  pickDirectory,
  getPathStatus,
};

export function addIpcHandlers() {
  for (const [key, handler] of Object.entries(commandHandlers)) {
    ipcMain.handle(key, handler);
  }
}
