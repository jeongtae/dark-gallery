import json from "@rollup/plugin-json";
import svelte from "rollup-plugin-svelte";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import { terser } from "rollup-plugin-terser";
import sveltePreprocess from "svelte-preprocess";

const production = !process.env.ROLLUP_WATCH;

export default {
  input: "src/svelte/index.ts",
  output: {
    sourcemap: !production,
    format: "esm",
    name: "app",
    dir: "dist/svelte",
    chunkFileNames: "[name].mjs",
  },
  plugins: [
    json(),
    svelte({
      dev: !production,
      css: css => {
        css.write("style.css", !production);
      },
      preprocess: sveltePreprocess({
        typescript: { tsconfigFile: "src/svelte/tsconfig.json" },
      }),
    }),

    // If you have external dependencies installed from
    // npm, you'll most likely need these plugins. In
    // some cases you'll need additional configuration -
    // consult the documentation for details:
    // https://github.com/rollup/plugins/tree/master/packages/commonjs
    resolve({
      browser: true,
      dedupe: module => module === "svelte" || module.startsWith("svelte/"),
    }),
    commonjs(),
    production && terser(),
  ],
  watch: {
    clearScreen: false,
  },
};
