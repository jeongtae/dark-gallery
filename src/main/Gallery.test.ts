import "jest-extended";
import fs from "fs";
import path from "path";
import mockfs from "mock-fs";
import type { GalleryPathInfo } from "./ipc";
import Gallery, { IndexingStepForNewFiles } from "./Gallery";
import type { ImageInfo, VideoInfo } from "./indexing";

jest.mock("./environments", () => ({ isDev: false }));

jest.mock("./Gallery", () => {
  const exports = jest.requireActual("./Gallery");
  exports.default.getGalleryPathInfo = jest.fn().mockResolvedValue({
    exists: true,
    isAbsolute: true,
    isDirectory: true,
    directoryHasReadPermission: true,
    directoryHasWritePermission: true,
  } as GalleryPathInfo);
  return exports;
});

jest.mock("./indexing", () => ({
  ...jest.requireActual("./indexing"),
  async getImageInfo(path: string): Promise<ImageInfo> {
    const content = fs.readFileSync(path, "utf-8");
    const [_, width, height] = [...content.matchAll(/(\d+)x(\d+)/g)][0];
    const [date] = content.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/g);
    return {
      width: parseInt(width),
      height: parseInt(height),
      ...(date.length && { taggedTime: new Date(date) }),
    };
  },
  async getVideoInfo(path: string): Promise<VideoInfo> {
    const content = fs.readFileSync(path, "utf-8");
    const [_, width, height] = [...content.matchAll(/(\d+)x(\d+)/g)][0];
    const [date] = content.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/g);
    const [duration] = content.match(/\d+s/g);
    return {
      width: parseInt(width),
      height: parseInt(height),
      duration: parseFloat(duration) * 1000,
      codec: "h264",
      ...(date.length && { taggedTime: new Date(date) }),
    };
  },
}));

describe("testing gallery indexing", () => {
  beforeAll(() => {
    mockfs({
      node_modules: mockfs.load(path.resolve(process.cwd(), "node_modules"), { lazy: true }),
      "test-gallery": { ".darkgallery": {} },
    });
  });
  afterAll(() => {
    mockfs.restore();
  });

  test("set a config and get it", async () => {
    const gallery = new Gallery("./test-gallery");
    await gallery.open();
    await gallery.setConfig("description", "foo");
    const jsonValue = await (
      await gallery.models.config.findOne({
        where: { key: "description" },
      })
    ).value;
    expect(JSON.parse(jsonValue)).toBe("foo");
    expect(await gallery.getConfig("description")).toBe("foo");
    await gallery.dispose();
  });

  test("get default config without setting it", async () => {
    const gallery = new Gallery("./test-gallery");
    await gallery.open();
    expect(await gallery.getConfig("imageExtensions")).toIncludeAnyMembers(["jpg", "webp"]);
    expect(await gallery.getConfig("videoExtensions")).toIncludeAnyMembers(["mp4", "webm"]);
    await gallery.dispose();
  });

  test("creating and close gallery", async () => {
    const gallery = new Gallery("./test-gallery");
    await gallery.open();
    await gallery.dispose();
  });

  test("index", async () => {
    mockfs({
      "index-testing-gallery": {
        ".darkgallery": {},
        "animal images": {
          "cat.gif": "1024x768",
          "dog.jpeg": "1920x1080",
        },
        "Fruits HERE": {
          "apple.png": "3840x2160",
          "banana.webp": "1280x1024",
          "citrus.webm": "1920x1080",
          "dragon-fruit.jpg": "1024x768",
        },
        "foo.bar": "f",
        "baz.qux": "b",
      },
      "not-me.jpg": "2048x3096",
    });
    const gallery = new Gallery("./index-testing-gallery");
    await gallery.open();
    const gen = gallery.generateIndexingSequenceForNewFiles(3);
    let step: IndexingStepForNewFiles;
    step = (await gen.next()).value;
    expect(step.totalCount).toBe(6);
    await gallery.dispose();
  });
});
