import { app } from "electron";

const isSquirrelStartup: boolean = require("electron-squirrel-startup");
const isDev: boolean = require("electron-is-dev");
const isMac: boolean = process.platform === "darwin";
const appName: string = app.name;

export { isSquirrelStartup, isDev, isMac, appName };
