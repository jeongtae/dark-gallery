/**
 * @typedef {import("electron-packager").Options} PackagerConfig
 * @typedef {import("electron-rebuild/lib/src/rebuild").RebuildOptions} RebuildConfig
 * @typedef {import("@electron-forge/shared-types").ForgeConfig} ForgeConfig
 */

/**
 * This object maps directly to the options sent to `electron-packager`
 * during the package step of Electron Forge's build process.
 * @type {PackagerConfig}
 * @see https://electron.github.io/electron-packager/master/interfaces/electronpackager.options.html
 */
const packagerConfig = {
  ignore: [
    "^/src",
    "^/.git",
    "^/.prettier",
    "^/tsconfig",
    "^/(yarn|package-lock)",
    "^/\\w+.config.js",
    "^/gulpfile",
  ],
  // icon: "",
};

/**
 * This object maps directly to the options sent to `electron-rebuild`
 * during both the package and start step of Electron Forge's build process.
 * @type {RebuildConfig}
 * @see https://github.com/electron/electron-rebuild#how-can-i-integrate-this-into-grunt--gulp--whatever
 */
const rebuildConfig = {};

/**
 * @type {ForgeConfig}
 * @see https://www.electronforge.io/configuration
 */
const forgeConfig = {
  packagerConfig,
  rebuildConfig,
  hooks: {
    prePackage() {
      // ICON
    },
  },
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: { name: "electron_ts_svelte" },
    },
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"],
    },
    {
      name: "@electron-forge/maker-deb",
      config: {},
    },
    {
      name: "@electron-forge/maker-rpm",
      config: {},
    },
  ],
};

module.exports = forgeConfig;
