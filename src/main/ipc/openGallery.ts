import type { CommandHandlers } from "../../ipc";
import { createSequelize, KeyValueStoreCtor } from "../sequelize";
import path from "path";

const command: CommandHandlers["openGallery"] = async ({ frameId }, { path: galleryPath }) => {
  try {
    const indexPath = path.join(galleryPath, ".darkgallery");
    const sqlitePath = path.join(indexPath, "db.sqlite");

    const sequelize = createSequelize(frameId, sqlitePath);

    const KeyValueStore = sequelize.models.keyValueStore as KeyValueStoreCtor;
    const { value: galleryTitle } = await KeyValueStore.findByPk("title");

    return galleryTitle;
  } catch {
    return null;
  }
};

export default command;
