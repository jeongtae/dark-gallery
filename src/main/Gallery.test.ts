import "jest-extended";
import fs from "fs";
import path from "path";
import mockfs from "mock-fs";
import type { DirectoryItems } from "mock-fs/lib/filesystem";
import { Op } from "sequelize";
import type { GalleryPathInfo } from "./ipc";
import Gallery from "./Gallery";
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
    const mockDirectoryItems: DirectoryItems = {
      "inf-testing-gallery": {
        ".darkgallery": {},
        "foo-bar": {
          "animal images": {
            "cat.gif": mockfs.file({
              content: "1024x768 1994-10-29 12:34:56",
              mtime: new Date("2021-01-01 11:59:59.678"),
            }),
            "dog.jpeg": "1920x1080",
            "jaguar.txt": "123x456",
          },
        },
        "Fruits HERE": {
          "apple.png": "3840x2160",
          "banana.webm": "1280x720 12s",
        },
        "apple-copy.png": "3840x2160",
        "foo.bar": "f",
        "baz.qux": "b",
      },
      "not-me.jpg": "2048x3096",
    };
    mockfs(mockDirectoryItems);
    const gallery = new Gallery("./inf-testing-gallery");
    await gallery.open();
    const Item = gallery.models.item;
    const bulkCreateSpy = jest.spyOn(Item, "bulkCreate");

    let i = 0;
    for await (const step of gallery.generateIndexingSequenceForNewFiles({ bulkCount: 3 })) {
      expect(step.totalCount).toBe(5);
      expect(step.processedCount).toBe(i);
      if (i > 0) {
        expect(step.processedInfo.result).toBe("item-added");
      } else {
        expect(step).not.toContainKey("processedInfo");
      }
      i += 1;
    }
    expect(bulkCreateSpy).toBeCalledTimes(2);

    const allItems = await Item.findAll();
    expect(allItems.length).toBe(5);

    // process item creation correctly (image with EXIF)
    const catItem = await Item.findOne({ where: { filename: "cat.gif" } });
    expect(catItem.directory).toBe(path.join("foo-bar", "animal images"));
    expect(catItem.getDataValue("directory")).toBe("foo-bar/animal images");
    expect(catItem.lost).toBe(false);
    expect(catItem.size).toBeGreaterThan(0);
    expect(catItem.timeMode).toBe("METAD");
    expect(catItem.time).toEqual(new Date("1994-10-29 12:34:56"));
    expect(catItem.mtime).toEqual(new Date("2021-01-01 12:00:00"));
    expect(catItem.type).toBe("IMG");
    expect(catItem.width).toBe(1024);
    expect(catItem.height).toBe(768);
    expect(catItem.duration).toBeNull();

    // process item creation correctly (image without EXIF)
    const dogItem = await Item.findOne({ where: { filename: "dog.jpeg" } });
    expect(dogItem.directory).toBe(path.join("foo-bar", "animal images"));
    expect(dogItem.getDataValue("directory")).toBe("foo-bar/animal images");
    expect(dogItem.timeMode).toBe("MTIME");
    expect(dogItem.lost).toBe(false);
    expect(dogItem.size).toBeGreaterThan(0);
    expect(dogItem.timeMode).toBe("MTIME");
    expect(dogItem.time).toEqual(dogItem.mtime);
    expect(dogItem.type).toBe("IMG");
    expect(dogItem.width).toBe(1920);
    expect(dogItem.height).toBe(1080);
    expect(dogItem.duration).toBeNull();

    // process lost item correctly (same hash)
    const appleItem = await Item.findOne({ where: { filename: "apple.png" } });
    appleItem.lost = true;
    await appleItem.save();
    bulkCreateSpy.mockClear();
    i = 0;
    for await (const step of gallery.generateIndexingSequenceForNewFiles()) {
      expect(step.totalCount).toBe(1);
      expect(step.processedCount).toBe(i);
      if (i > 0) {
        expect(step.processedInfo.result).toBe("found-lost-items-file-and-updated");
      }
      i += 1;
    }
    expect(i).toBe(2);
    expect(bulkCreateSpy).toBeCalledTimes(0);
    await appleItem.reload();
    expect(appleItem.lost).toBeFalse();
    expect(appleItem.width).toBe(3840);
    expect(appleItem.height).toBe(2160);
    expect(appleItem.duration).toBeNull();

    // process lost item correctly (different hash, same path)
    (mockDirectoryItems as any)["inf-testing-gallery"]["Fruits HERE"]["banana.webm"] = "480x272 8s";
    mockfs(mockDirectoryItems);
    const bananaItem = await Item.findOne({ where: { filename: "banana.webm" } });
    bananaItem.lost = true;
    await bananaItem.save();
    bulkCreateSpy.mockClear();
    i = 0;
    for await (const step of gallery.generateIndexingSequenceForNewFiles()) {
      expect(step.totalCount).toBe(1);
      expect(step.processedCount).toBe(i);
      if (i > 0) {
        expect(step.processedInfo.result).toBe("found-lost-item-candidate-file");
        expect(
          step.processedInfo.result === "found-lost-item-candidate-file" &&
            step.processedInfo.lostItemPaths
        ).toIncludeSameMembers(["Fruits HERE/banana.webm"]);
      }
      i += 1;
    }
    expect(i).toBe(2);
    expect(bulkCreateSpy).toBeCalledTimes(0);
    await bananaItem.reload();
    expect(bananaItem.lost).toBeTrue();
    expect(bananaItem.width).not.toBe(480);
    expect(bananaItem.height).not.toBe(272);
    expect(bananaItem.duration).not.toBe(8000);
    delete (mockDirectoryItems as any)["inf-testing-gallery"]["Fruits HERE"]["banana.webm"];

    // process lost item correctly (same hash, different path)
    delete (mockDirectoryItems as any)["inf-testing-gallery"]["Fruits HERE"]["apple.png"];
    delete (mockDirectoryItems as any)["inf-testing-gallery"]["apple-copy.png"];
    (mockDirectoryItems as any)["inf-testing-gallery"]["new-same-apple.png"] = "3840x2160";
    mockfs(mockDirectoryItems);
    expect(
      await Item.update(
        { lost: true },
        { where: { filename: { [Op.like]: "apple%" } }, sideEffects: false }
      )
    ).toIncludeSameMembers([2]);
    bulkCreateSpy.mockClear();
    i = 0;
    for await (const step of gallery.generateIndexingSequenceForNewFiles()) {
      expect(step.totalCount).toBe(1);
      expect(step.processedCount).toBe(i);
      if (i > 0) {
        expect(step.processedInfo.result).toBe("found-lost-item-candidate-file");
        expect(
          step.processedInfo.result === "found-lost-item-candidate-file" &&
            step.processedInfo.lostItemPaths
        ).toIncludeSameMembers(["Fruits HERE/apple.png", "apple-copy.png"]);
      }
      i += 1;
    }
    expect(i).toBe(2);
    expect(bulkCreateSpy).toBeCalledTimes(0);
    expect(await Item.findOne({ where: { filename: "new-same-apple.png" } })).toBeNull();
    delete (mockDirectoryItems as any)["inf-testing-gallery"]["new-same-apple.png"];

    await gallery.dispose();
  });
});
