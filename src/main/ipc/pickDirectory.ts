import { BrowserWindow, dialog } from "electron";
import type { CommandHandlers } from "../../ipc";

const command: CommandHandlers["pickDirectory"] = async ({ frameId }, { title, buttonLabel }) => {
  const window = BrowserWindow.fromId(frameId);
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

export default command;
