import { app } from "electron";
import is from "electron-is";

const isSquirrelStartup: boolean = require("electron-squirrel-startup");
const isDev: boolean = is.dev();
const isMac: boolean = is.macOS();
const appName: string = app.name;
const appPath: string = app.getAppPath();

export { isSquirrelStartup, isDev, isMac, appName, appPath };
