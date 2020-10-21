# Electron Svelte Template

A Electron project template using Svelte and TypeScript. This templated based on basic template of [electron-forge](https://www.electronforge.io/templates/typescript-template) and [Svelte](https://github.com/sveltejs/template).

## Primary Dependencies

- [Electron][electron]
- [Svelte][svelte]
- [TypeScript][typescript]
- [Sass][sass]
- [Electron Forge][ef]
- [gulp.js][gulpjs]
- [Rollup][rollupjs]
- [Prettier][prettier]

## Get Started

To create a new project based on this template using degit:

```bash
npx degit jeongtae/electron-svelte-template my-project-name
cd my-project-name
```

And install the dependencies with npm:

```bash
npm install -D
```

or yarn:

```bash
yarn install
```

Then start the watch script for development:

```bash
npm run start
```

To package the app, run package script:

```bash
npm run package
```

## Files and Directories

| Name             | Description                                                                      |
| ---------------- | -------------------------------------------------------------------------------- |
| .vscode/         | Some extension recommendations and some formatting settings                      |
| dist/            | Transpiled source codes here                                                     |
| out/             | Packaged app files here                                                          |
| src/             | Source codes for the app                                                         |
| src/main/        | Sorce codes for the main process of Electron (Runs on the built-in Node.js)      |
| src/public/      | Public files like HTML, CSS and so on                                            |
| src/svelte/      | Sorce codes for the renderer process of Electron (Runs on the built-in Chromium) |
| .prettier\*      | Configuration files for Prettier                                                 |
| forge.config.js  | Configuration file for Electron Forge for build the app                          |
| gulpfile.ts      | Configuration file for gulp.js for build the app                                 |
| rollup.config.js | Configuration file for rollup.js for build Svelte app                            |

[electron]: https://www.electronjs.org/
[svelte]: https://svelte.dev/
[typescript]: https://www.typescriptlang.org/
[sass]: https://sass-lang.com/
[ef]: https://www.electronforge.io/
[gulpjs]: https://gulpjs.com/
[rollupjs]: http://rollupjs.org/
[prettier]: https://prettier.io/
