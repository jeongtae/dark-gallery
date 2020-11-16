import path from "path";
import { promises as fs } from "fs";
import { app } from "electron";
import type { CommandHandlers } from "../../ipc";
import { createSequelize, KeyValueStoreCtor, initKeyValueStoreWithTitle } from "../sequelize";

const command: CommandHandlers["openDevGallery"] = async ({ frameId }) => {
  try {
    const indexPath = path.join(app.getAppPath(), "dev-gallery/.darkgallery");
    try {
      await fs.access(indexPath);
    } catch {
      await fs.mkdir(indexPath);
    }
    const sqlitePath = path.join(indexPath, "db.sqlite");

    const sequelize = createSequelize(frameId, sqlitePath);

    await sequelize.sync();

    const title = await initKeyValueStoreWithTitle(sequelize, "Dev. Gallery");

    return title;
  } catch {
    return null;
  }
};

export default command;
