import { app } from "electron";
import is from "electron-is";

const isSquirrelStartup: boolean = require("electron-squirrel-startup");
const isDev: boolean = is.dev();
const isMac: boolean = is.macOS();
const appName: string = app.name;

export { isSquirrelStartup, isDev, isMac, appName };
