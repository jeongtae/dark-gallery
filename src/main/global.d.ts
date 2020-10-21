declare module "electron-reload" {
  import { WatchOptions } from "chokidar";
  type ReloadOptions = {
    /** Path pointing to electron executables */
    electron: string;
    /** String array with command line options passed to the executed Electron app. Only used when hard resetting. */
    argv: string[];
    /** Enables hard reset for every file change and not only the main file */
    forceHardReset: boolean;
  };
  function reload(paths: string, options: ReloadOptions | WatchOptions): void;
  namespace reload {
    const maxInterval: 12;
  }
  export = reload;
  //   export default namespace reload;
}

declare module "sex" {
  export default interface server {}
}
