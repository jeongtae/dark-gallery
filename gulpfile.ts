import { src, dest, watch } from "gulp";
import cleancss from "gulp-clean-css";
import htmlmin from "gulp-htmlmin";
import filter from "gulp-filter";
import typescript from "gulp-typescript";
import uglify from "gulp-uglify";
import sourcemaps from "gulp-sourcemaps";

const publicSource = "src/public/**/*";
export function buildPublic() {
  const htmlFilter = filter("**/*.html", { dot: true, restore: true });
  const cssFilter = filter("**/*.css", { dot: true, restore: true });
  return (
    src(publicSource)
      .pipe(htmlFilter)
      .pipe(
        htmlmin({
          caseSensitive: true,
          collapseWhitespace: true,
          removeComments: true,
        })
      )
      .pipe(htmlFilter.restore)
      .pipe(cssFilter)
      // .pipe(sourcemaps.init())
      .pipe(cleancss())
      // .pipe(sourcemaps.write("."))
      .pipe(cssFilter.restore)
      .pipe(dest("dist/public"))
  );
}
export function watchPublic() {
  watch(publicSource, buildPublic);
}

const mainTypeScripProject = typescript.createProject("src/main/tsconfig.json");
const mainSource = "src/main/**/*";
export function buildMain() {
  return src(mainSource + ".ts")
    .pipe(mainTypeScripProject())
    .pipe(uglify())
    .pipe(dest("dist/main"));
}
export function devMain() {
  return src(mainSource + ".ts")
    .pipe(sourcemaps.init())
    .pipe(mainTypeScripProject())
    .pipe(sourcemaps.write("."))
    .pipe(dest("dist/main"));
}
export function watchMain() {
  watch("src/main/**/*", devMain);
}
