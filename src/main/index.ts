import * as path from "path";
import { app } from "electron";
import Main from "./main";

if (require("electron-squirrel-startup")) {
  app.quit();
}

const isDev = require("electron-is-dev") as boolean;
if (isDev) {
  import("electron-reload").then(({ default: watch }) => {
    watch(path.join(__dirname, ".."), {
      electron: path.join(__dirname, "../../node_modules", ".bin", "electron"),
      awaitWriteFinish: true,
    });
  });
}

new Main(isDev).init();
