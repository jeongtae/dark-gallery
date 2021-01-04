import "jest-extended";
import mockfs from "mock-fs";
import * as testee from "./indexing";

describe("testing getFileHash function", () => {
  const { getFileHash } = testee;
  beforeAll(() =>
    mockfs({
      "test.bin": Buffer.from([1, 2, 3, 4, 5]),
    })
  );
  afterAll(() => mockfs.restore());
  test("file's hash is calculating correctly", async () => {
    const hash = await getFileHash("./test.bin");
    expect(hash).toBe("11966ab9c099f8fabefac54c08d5be2bd8c903af");
  });
});

describe("testing countAllChildFiles function", () => {
  const { countAllChildFiles } = testee;
  beforeAll(() =>
    mockfs({
      "the-dir": {
        "foo-dir": {
          "foo-img.jpg": "",
          "foo-img.PNG": "",
          "foo-img.webp": "",
          "foo-vid.mp4": "",
          "foo-vid.webm": "",
          "foo-bin": "",
        },
        "bar-dir": {
          "image.jpg": "",
        },
        ".darkgallery": {
          "image.jpg": "",
        },
        "abc-def": "",
        jpg: "",
        "test.bin": "",
        "image.jpeg": "",
        "video.mov": "",
      },
      "not-this-dir": {
        "no.jpg": "",
      },
    })
  );
  afterAll(() => mockfs.restore());
  test("getting all descendant file paths count correctly with extension filter", async () => {
    const count = await countAllChildFiles("./the-dir", {
      acceptingExtensions: ["JPG", "MoV", "png", "webp", "webm"],
    });
    expect(count).toBe(
      [
        "foo-dir/foo-img.jpg",
        "foo-dir/foo-img.PNG",
        "foo-dir/foo-img.webp",
        // "foo-dir/foo-vid.mp4",
        "foo-dir/foo-vid.webm",
        // "foo-dir/foo-bin",
        "bar-dir/image.jpg",
        ".darkgallery/image.jpg",
        // "abc-def",
        // "jpg",
        // "test.bin",
        // "image.jpeg",
        "video.mov",
      ].length
    );
  });
  test("getting all descendant file paths count correctly with file name filter", async () => {
    const count = await countAllChildFiles("./the-dir", {
      ignoreFiles: ["img.webp", "foo-vid.webm"],
    });
    expect(count).toBe(
      [
        "foo-dir/foo-img.jpg",
        "foo-dir/foo-img.PNG",
        "foo-dir/foo-img.webp",
        "foo-dir/foo-vid.mp4",
        // "foo-dir/foo-vid.webm",
        "foo-dir/foo-bin",
        "bar-dir/image.jpg",
        ".darkgallery/image.jpg",
        "abc-def",
        "jpg",
        "test.bin",
        "image.jpeg",
        "video.mov",
      ].length
    );
  });
  test("getting all descendant file paths count correctly with directory name filter", async () => {
    const count = await countAllChildFiles("./the-dir", {
      ignoreDirectories: ["bar-dir", ".darkgallery"],
    });
    expect(count).toBe(
      [
        "foo-dir/foo-img.jpg",
        "foo-dir/foo-img.PNG",
        "foo-dir/foo-img.webp",
        "foo-dir/foo-vid.mp4",
        "foo-dir/foo-vid.webm",
        "foo-dir/foo-bin",
        // "bar-dir/image.jpg",
        // ".darkgallery/image.jpg",
        "abc-def",
        "jpg",
        "test.bin",
        "image.jpeg",
        "video.mov",
      ].length
    );
  });
  test("getting all descendant file paths count correctly with all options", async () => {
    const count = await countAllChildFiles("./the-dir", {
      acceptingExtensions: ["JPG", "MoV", "png", "webp", "webm"],
      ignoreFiles: ["img.webp", "foo-vid.webm"],
      ignoreDirectories: ["bar-dir", ".darkgallery"],
    });
    expect(count).toBe(
      [
        "foo-dir/foo-img.jpg",
        "foo-dir/foo-img.PNG",
        "foo-dir/foo-img.webp",
        // "foo-dir/foo-vid.mp4",
        // "foo-dir/foo-vid.webm",
        // "foo-dir/foo-bin",
        // "bar-dir/image.jpg",
        // ".darkgallery/image.jpg",
        // "abc-def",
        // "jpg",
        // "test.bin",
        // "image.jpeg",
        "video.mov",
      ].length
    );
  });
});

describe("testing generateAllChildFileRelativePaths function", () => {
  const { generateAllChildFileRelativePaths } = testee;
  beforeAll(() =>
    mockfs({
      "the-dir": {
        "foo-dir": {
          "foo-img.jpg": "",
          "foo-img.PNG": "",
          "foo-img.webp": "",
          "foo-vid.mp4": "",
          "foo-vid.webm": "",
          "foo-bin": "",
        },
        "bar-dir": {
          "image.jpg": "",
        },
        ".darkgallery": {
          "image.jpg": "",
        },
        "abc-def": "",
        jpg: "",
        "test.bin": "",
        "image.jpeg": "",
        "video.mov": "",
      },
      "not-this-dir": {
        "no.jpg": "",
      },
    })
  );
  afterAll(() => mockfs.restore());
  test("getting all descendant file paths with right order", async () => {
    const paths: string[] = [];
    for await (const path of generateAllChildFileRelativePaths("./the-dir")) {
      paths.push(path);
    }
    const filePaths = ["abc-def", "jpg", "test.bin", "image.jpeg", "video.mov"];
    expect(paths.slice(0, filePaths.length)).toIncludeSameMembers(filePaths);
    const dirPaths = [
      "foo-dir/foo-img.jpg",
      "foo-dir/foo-img.PNG",
      "foo-dir/foo-img.webp",
      "foo-dir/foo-vid.mp4",
      "foo-dir/foo-vid.webm",
      "foo-dir/foo-bin",
      "bar-dir/image.jpg",
      ".darkgallery/image.jpg",
    ];
    expect(paths.slice(filePaths.length)).toIncludeSameMembers(dirPaths);
  });
  test("getting all descendant file paths correctly with extension filter", async () => {
    const paths: string[] = [];
    for await (const path of generateAllChildFileRelativePaths("./the-dir", {
      acceptingExtensions: ["JPG", "MoV", "png", "webp", "webm"],
    })) {
      paths.push(path);
    }
    expect(paths).toIncludeSameMembers([
      "foo-dir/foo-img.jpg",
      "foo-dir/foo-img.PNG",
      "foo-dir/foo-img.webp",
      // "foo-dir/foo-vid.mp4",
      "foo-dir/foo-vid.webm",
      // "foo-dir/foo-bin",
      "bar-dir/image.jpg",
      ".darkgallery/image.jpg",
      // "abc-def",
      // "jpg",
      // "test.bin",
      // "image.jpeg",
      "video.mov",
    ]);
  });
  test("getting all descendant file paths correctly with file name filter", async () => {
    const paths: string[] = [];
    for await (const path of generateAllChildFileRelativePaths("./the-dir", {
      ignoreFiles: ["img.webp", "foo-vid.webm"],
    })) {
      paths.push(path);
    }
    expect(paths).toIncludeSameMembers([
      "foo-dir/foo-img.jpg",
      "foo-dir/foo-img.PNG",
      "foo-dir/foo-img.webp",
      "foo-dir/foo-vid.mp4",
      // "foo-dir/foo-vid.webm",
      "foo-dir/foo-bin",
      "bar-dir/image.jpg",
      ".darkgallery/image.jpg",
      "abc-def",
      "jpg",
      "test.bin",
      "image.jpeg",
      "video.mov",
    ]);
  });
  test("getting all descendant file paths correctly with directory name filter", async () => {
    const paths: string[] = [];
    for await (const path of generateAllChildFileRelativePaths("./the-dir", {
      ignoreDirectories: ["bar-dir", ".darkgallery"],
    })) {
      paths.push(path);
    }
    expect(paths).toIncludeSameMembers([
      "foo-dir/foo-img.jpg",
      "foo-dir/foo-img.PNG",
      "foo-dir/foo-img.webp",
      "foo-dir/foo-vid.mp4",
      "foo-dir/foo-vid.webm",
      "foo-dir/foo-bin",
      // "bar-dir/image.jpg",
      // ".darkgallery/image.jpg",
      "abc-def",
      "jpg",
      "test.bin",
      "image.jpeg",
      "video.mov",
    ]);
  });
  test("getting all descendant file paths correctly with all options", async () => {
    const paths: string[] = [];
    for await (const path of generateAllChildFileRelativePaths("./the-dir", {
      acceptingExtensions: ["JPG", "MoV", "png", "webp", "webm"],
      ignoreFiles: ["img.webp", "foo-vid.webm"],
      ignoreDirectories: ["bar-dir", ".darkgallery"],
    })) {
      paths.push(path);
    }
    expect(paths).toIncludeSameMembers([
      "foo-dir/foo-img.jpg",
      "foo-dir/foo-img.PNG",
      "foo-dir/foo-img.webp",
      // "foo-dir/foo-vid.mp4",
      // "foo-dir/foo-vid.webm",
      // "foo-dir/foo-bin",
      // "bar-dir/image.jpg",
      // ".darkgallery/image.jpg",
      // "abc-def",
      // "jpg",
      // "test.bin",
      // "image.jpeg",
      "video.mov",
    ]);
  });
});
