import type { CommandHandlers } from "../../ipc";
import { createSequelize, disposeSequelize, initKeyValueStoreWithTitle } from "../sequelize";
import { promises as fs } from "fs";
import path from "path";

const command: CommandHandlers["makeGallery"] = async ({ frameId }, { path: galleryPath }) => {
  try {
    const indexPath = path.join(galleryPath, ".darkgallery");
    await fs.mkdir(indexPath);

    const sqlitePath = path.join(indexPath, "db.sqlite");

    const sequelize = createSequelize(frameId, sqlitePath);
    await sequelize.sync();

    const galleryTitle = path.basename(galleryPath);

    await initKeyValueStoreWithTitle(sequelize, galleryTitle);

    await disposeSequelize(frameId);

    return true;
  } catch {
    return false;
  }
};

export default command;
