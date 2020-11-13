import type { CommandHandlers } from "../../ipc";
import { sequelizes, createSequelize } from "./sequelize";
import { promises as fs } from "fs";
import path from "path";

const command: CommandHandlers["openGallery"] = async ({ frameId }, { galleryPath }) => {
  try {
    const indexPath = path.join(galleryPath, ".darkgallery");
    const sqlitePath = path.join(indexPath, "db.sqlite");

    const sequelize = createSequelize(sqlitePath);
    sequelizes[frameId] = sequelize;

    const galleryTitle = path.basename(galleryPath);
    return galleryTitle;
  } catch {
    return null;
  }
};

export default command;
