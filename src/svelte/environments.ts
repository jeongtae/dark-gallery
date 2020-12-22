import { productName, description } from "../../package.json";

const is = require("electron-is");
const isDev: boolean = is.dev();
const isMac: boolean = is.macOS();

export { isDev, isMac, productName as appName, description as appDescription };
