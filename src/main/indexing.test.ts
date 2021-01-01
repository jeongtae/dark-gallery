import "jest-extended";
import mockfs from "mock-fs";
import { getFileHash, getAllChildFilePaths } from "./indexing";

describe("testing getFileHash function", () => {
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

describe("testing getAllChildFilePaths function", () => {
  beforeAll(() =>
    mockfs({
      "the-dir": {
        jpg: "",
        "test.bin": "",
        "image.jpeg": "",
        "video.mov": "",
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
      },
      "not-this-dir": {
        "no.jpg": "",
      },
    })
  );
  afterAll(() => mockfs.restore());
  test("getting all descendant file paths correctly without any options", async () => {
    const paths = await getAllChildFilePaths("./the-dir", {});
    expect(paths).toIncludeSameMembers([
      "jpg",
      "test.bin",
      "image.jpeg",
      "video.mov",
      "foo-dir/foo-img.jpg",
      "foo-dir/foo-img.PNG",
      "foo-dir/foo-img.webp",
      "foo-dir/foo-vid.mp4",
      "foo-dir/foo-vid.webm",
      "foo-dir/foo-bin",
      "bar-dir/image.jpg",
      ".darkgallery/image.jpg",
    ]);
  });
  test("getting all descendant file paths correctly with extension filter", async () => {
    const paths = await getAllChildFilePaths("./the-dir", {
      acceptingExtensions: ["JPG", "MoV", "png", "webp", "webm"],
    });
    expect(paths).toIncludeSameMembers([
      // "jpg",
      // "test.bin",
      // "image.jpeg",
      "video.mov",
      "foo-dir/foo-img.jpg",
      "foo-dir/foo-img.PNG",
      "foo-dir/foo-img.webp",
      // "foo-dir/foo-vid.mp4",
      "foo-dir/foo-vid.webm",
      // "foo-dir/foo-bin",
      "bar-dir/image.jpg",
      ".darkgallery/image.jpg",
    ]);
  });
  test("getting all descendant file paths correctly with file name filter", async () => {
    const paths = await getAllChildFilePaths("./the-dir", {
      ignoreFiles: ["img.webp", "foo-vid.webm"],
    });
    expect(paths).toIncludeSameMembers([
      "jpg",
      "test.bin",
      "image.jpeg",
      "video.mov",
      "foo-dir/foo-img.jpg",
      "foo-dir/foo-img.PNG",
      "foo-dir/foo-img.webp",
      "foo-dir/foo-vid.mp4",
      // "foo-dir/foo-vid.webm",
      "foo-dir/foo-bin",
      "bar-dir/image.jpg",
      ".darkgallery/image.jpg",
    ]);
  });
  test("getting all descendant file paths correctly with directory name filter", async () => {
    const paths = await getAllChildFilePaths("./the-dir", {
      ignoreDirectories: ["bar-dir", ".darkgallery"],
    });
    expect(paths).toIncludeSameMembers([
      "jpg",
      "test.bin",
      "image.jpeg",
      "video.mov",
      "foo-dir/foo-img.jpg",
      "foo-dir/foo-img.PNG",
      "foo-dir/foo-img.webp",
      "foo-dir/foo-vid.mp4",
      "foo-dir/foo-vid.webm",
      "foo-dir/foo-bin",
      // "bar-dir/image.jpg",
      // ".darkgallery/image.jpg",
    ]);
  });
  test("getting all descendant file paths correctly with all options", async () => {
    const paths = await getAllChildFilePaths("./the-dir", {
      acceptingExtensions: ["JPG", "MoV", "png", "webp", "webm"],
      ignoreFiles: ["img.webp", "foo-vid.webm"],
      ignoreDirectories: ["bar-dir", ".darkgallery"],
    });
    expect(paths).toIncludeSameMembers([
      // "jpg",
      // "test.bin",
      // "image.jpeg",
      "video.mov",
      "foo-dir/foo-img.jpg",
      "foo-dir/foo-img.PNG",
      "foo-dir/foo-img.webp",
      // "foo-dir/foo-vid.mp4",
      // "foo-dir/foo-vid.webm",
      // "foo-dir/foo-bin",
      // "bar-dir/image.jpg",
      // ".darkgallery/image.jpg",
    ]);
  });
});
