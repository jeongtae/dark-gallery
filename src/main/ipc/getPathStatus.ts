import fs from "fs";
import * as path from "path";
import type { CommandHandlers, PathStatus } from "../../ipc";

const command: CommandHandlers["getPathStatus"] = async (event, { path: givenPath }) => {
  const isAbsolute = path.isAbsolute(givenPath);
  try {
    await fs.promises.access(givenPath);
  } catch {
    return { isAbsolute, exists: false };
  }

  const pathStat = await fs.promises.lstat(givenPath);
  if (!pathStat.isDirectory()) {
    return { isAbsolute, exists: true, isDirectory: false };
  }

  const result: PathStatus = {
    isAbsolute,
    exists: true,
    isDirectory: true,
    directoryHasReadPermission: false,
    directoryHasWritePermission: false,
  };
  const { R_OK, W_OK } = fs.constants;

  try {
    await fs.promises.access(givenPath, R_OK);
    result.directoryHasReadPermission = true;
    await fs.promises.access(givenPath, W_OK);
    result.directoryHasWritePermission = true;
  } catch {}

  if (isAbsolute) {
    const upper = (p: string) => path.join(p, "..");
    let upperLevelPath = givenPath;
    while (upperLevelPath !== upper(upperLevelPath)) {
      upperLevelPath = upper(upperLevelPath);
      const sqlitePath = path.join(upperLevelPath, `.darkgallery${path.sep}db.sqlite`);
      try {
        await fs.promises.access(sqlitePath);
        result.isDecendantOfGallery = true;
        break;
      } catch {}
    }
  }

  const sqlitePath = path.join(givenPath, `.darkgallery${path.sep}db.sqlite`);
  try {
    await fs.promises.access(sqlitePath);
    result.isGallery = true;
    await fs.promises.access(sqlitePath, R_OK);
    result.galleryHasReadPermission = true;
    await fs.promises.access(sqlitePath, W_OK);
    result.galleryHasWritePermission = true;
  } catch {}

  return result;
};

export default command;
