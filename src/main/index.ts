import * as path from "path";
import { app } from "electron";
import Main from "./main";
import { isSquirrelStartup, isDev } from "./environment";

if (isSquirrelStartup) {
  app.quit();
}

if (isDev) {
  import("electron-reload").then(({ default: watch }) => {
    watch(path.join(__dirname, ".."), {
      electron: path.join(__dirname, "../../node_modules", ".bin", "electron"),
      awaitWriteFinish: true,
    });
  });
}

Main.main();
