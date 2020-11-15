import type { CommandHandlers } from "../../ipc";
import { createSequelize, SettingCtor } from "../sequelize";
import path from "path";

const command: CommandHandlers["openGallery"] = async ({ frameId }, { path: galleryPath }) => {
  try {
    const indexPath = path.join(galleryPath, ".darkgallery");
    const sqlitePath = path.join(indexPath, "db.sqlite");

    const sequelize = createSequelize(frameId, sqlitePath);

    const Setting = sequelize.models.setting as SettingCtor;
    const setting = await Setting.findOne();
    const galleryTitle = setting.title;

    return galleryTitle;
  } catch {
    return null;
  }
};

export default command;
