import path from "path";
import { promisify } from "util";
import { promises as fs } from "fs";
import { app } from "electron";
import type { CommandHandlers } from "../../ipc";
import rimraf from "rimraf";
const rimrafPromise = promisify(rimraf);

const command: CommandHandlers["resetDevGallery"] = async ({ frameId }) => {
  try {
    const indexPath = path.join(app.getAppPath(), "dev-gallery/.darkgallery");
    await fs.access(indexPath);
    await rimrafPromise(indexPath);
    return true;
  } catch {
    return false;
  }
};

export default command;
