import "jest-extended";
import fs from "fs";
import path from "path";
import mockfs from "mock-fs";
import type { GalleryPathInfo } from "./ipc";
import Gallery, { IndexingStepForNewFiles } from "./Gallery";
import type { ImageInfo, VideoInfo } from "./indexing";

jest.mock("./environments", () => ({ isDev: true }));

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
    const [date] = content.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/g) ?? [];
    return {
      width: parseInt(width),
      height: parseInt(height),
      ...(date && { taggedTime: new Date(date) }),
    };
  },
  async getVideoInfo(path: string): Promise<VideoInfo> {
    const content = fs.readFileSync(path, "utf-8");
    const [_, width, height] = [...content.matchAll(/(\d+)x(\d+)/g)][0];
    const [date] = content.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/g) ?? [];
    const [duration] = content.match(/\d+s/g);
    return {
      width: parseInt(width),
      height: parseInt(height),
      duration: parseFloat(duration) * 1000,
      codec: "h264",
      ...(date && { taggedTime: new Date(date) }),
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

  test("index new files", async () => {
    const catFileMtime = new Date("2021-01-01 01:23:45");
    const catFile = mockfs.file({
      content: "1024x768 1994-10-29 12:34:56",
      mtime: catFileMtime,
    });
    mockfs({
      "inf-testing-gallery": {
        ".darkgallery": {},
        "foo-bar": {
          "animal images": {
            "cat.gif": catFile,
            "dog.jpeg": "1920x1080",
            "jaguar.txt": "123x456",
          },
        },
        "Fruits HERE": {
          "apple.png": "3840x2160",
          "banana.webp": "1280x1024",
          "citrus.webm": "1920x1080 10s",
          "dragon-fruit.jpg": "1024x768",
        },
        "foo.bar": "f",
        "baz.qux": "b",
      },
      "not-me.jpg": "2048x3096",
    });
    const gallery = new Gallery("./inf-testing-gallery");
    await gallery.open();
    const Item = gallery.models.item;
    const bulkCreateSpy = jest.spyOn(Item, "bulkCreate");
    const gen = gallery.generateIndexingSequenceForNewFiles({ bulkCount: 2 });
    let i = 0;
    for await (const step of gen) {
      expect(step.totalCount).toBe(6);
      expect(step.processedCount).toBe(i);
      if (i > 0) {
        expect(step.processedInfo.result).toBe("item-added");
      } else {
        expect(step).not.toContainKey("processedInfo");
      }
      i += 1;
    }
    expect(bulkCreateSpy).toBeCalledTimes(3);

    const allItems = await Item.findAll();
    expect(allItems.length).toBe(6);

    const catItem = await Item.findOne({ where: { filename: "cat.gif" } });
    expect(catItem.directory).toBe(path.join("foo-bar", "animal images"));
    expect(catItem.getDataValue("directory")).toBe("foo-bar/animal images");
    expect(catItem.lost).toBe(false);
    expect(catItem.size).toBeGreaterThan(0);
    expect(catItem.timeMode).toBe("METAD");
    expect(catItem.time).toEqual(new Date("1994-10-29 12:34:56"));
    expect(catItem.mtime).toEqual(catFileMtime);
    expect(catItem.type).toBe("IMG");
    expect(catItem.width).toBe(1024);
    expect(catItem.height).toBe(768);
    expect(catItem.duration).toBeNull();

    await gallery.dispose();
  });
});
