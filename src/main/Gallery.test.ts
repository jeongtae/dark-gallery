import "jest-extended";
import fs from "fs";
import path from "path";
import mockfs from "mock-fs";
import type MockFile from "mock-fs/lib/file";
import type { GalleryPathInfo } from "./ipc";
import Gallery, { INDEXING_DIRNAME, DEFAULT_CONFIGS } from "./Gallery";
import type { ImageInfo, VideoInfo } from "./indexing";
import { Models } from "./sequelize";

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
    const [date] = content.match(/\d{4}-\d{1,2}-\d{1,2} \d{1,2}:\d{1,2}:\d{1,2}/g) ?? [];
    return {
      width: parseInt(width),
      height: parseInt(height),
      ...(date && { taggedTime: new Date(date) }),
    };
  },
  async getVideoInfo(path: string): Promise<VideoInfo> {
    const content = fs.readFileSync(path, "utf-8");
    const [_, width, height] = [...content.matchAll(/(\d+)x(\d+)/g)][0];
    const [date] = content.match(/\d{4}-\d{1,2}-\d{1,2} \d{1,2}:\d{1,2}:\d{1,2}/g) ?? [];
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

beforeAll(async () => {
  // Resolve the modules that using lazy require
  mockfs({
    node_modules: mockfs.load(path.resolve(process.cwd(), "node_modules"), { lazy: true }),
    [INDEXING_DIRNAME]: {},
  });
  const gallery = new Gallery(".");
  await gallery.open();
  await gallery.dispose();
});

afterAll(() => mockfs.restore());

interface FileInfo {
  type: Models.Item["type"];
  mtime: Date;
  taggedTime?: Date;
  content?: string;
  width: number;
  height: number;
  duration?: number;
}
function createMockFileFactory(info: FileInfo): () => MockFile {
  let content = `${info.width}x${info.height}`;
  if (info.duration) {
    content += ` ${info.duration / 1000}s`;
  }
  if (info.taggedTime) {
    const year = info.taggedTime.getFullYear();
    const month = info.taggedTime.getMonth() + 1;
    const date = info.taggedTime.getDate();
    const hours = info.taggedTime.getHours();
    const minutes = info.taggedTime.getMinutes();
    const seconds = info.taggedTime.getSeconds();
    content += ` ${year}-${month}-${date} ${hours}:${minutes}:${seconds}`;
  }
  if (info.content) {
    content += " " + info.content;
  }
  return mockfs.file({
    content,
    mtime: info.mtime,
  });
}

describe("testing gallery config", () => {
  const mockGalleryPath = path.join("test-dir", "test-gal");
  beforeAll(() => {
    mockfs({ "test-dir": { "test-gal": { [INDEXING_DIRNAME]: {} } } });
  });

  test("set a config and get it", async () => {
    const gallery = new Gallery(mockGalleryPath);
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
    const gallery = new Gallery(mockGalleryPath);
    await gallery.open();
    const getConfigSpy = jest.spyOn(gallery, "getConfig");

    for (const [key, defaultValue] of Object.entries(DEFAULT_CONFIGS)) {
      if (key === "createdAt") continue;
      const valueJson = JSON.stringify(await gallery.getConfig(key as any));
      const defaultValueJson = JSON.stringify(defaultValue);
      expect(valueJson).toBe(defaultValueJson);
    }

    const createdAt = await gallery.getConfig("createdAt");
    const fiveSecondsAgo = new Date(Date.now() - 5000);
    expect(createdAt.getTime()).toBeGreaterThan(fiveSecondsAgo.getTime());

    expect(getConfigSpy).toBeCalledTimes(Object.keys(DEFAULT_CONFIGS).length);

    await gallery.dispose();
  });
});

describe("testing gallery indexing for new files", () => {
  test("bulkCount option works correctly", async () => {
    mockfs({
      "test-gal": {
        [INDEXING_DIRNAME]: {},
        "foo.gif": "1024x768",
        "bar.jpeg": "1024x768",
        "baz.png": "1024x768",
        "qux.webm": "1024x768 10s",
      },
    });

    const gallery = new Gallery("test-gal");
    await gallery.open();
    const Item = gallery.models.item;
    const bulkCreateSpy = jest.spyOn(Item, "bulkCreate");

    for await (const _ of gallery.generateIndexingSequenceForNewFiles({ bulkCount: 5 })) {
    }
    expect(bulkCreateSpy).toBeCalledTimes(1);
    bulkCreateSpy.mockClear();
    expect(await Item.count()).toBe(4);
    await Item.destroy({ where: {} });

    for await (const _ of gallery.generateIndexingSequenceForNewFiles({ bulkCount: 4 })) {
    }
    expect(bulkCreateSpy).toBeCalledTimes(1);
    bulkCreateSpy.mockClear();
    expect(await Item.count()).toBe(4);
    await Item.destroy({ where: {} });

    for await (const _ of gallery.generateIndexingSequenceForNewFiles({ bulkCount: 3 })) {
    }
    expect(bulkCreateSpy).toBeCalledTimes(2);
    bulkCreateSpy.mockClear();
    expect(await Item.count()).toBe(4);
    await Item.destroy({ where: {} });

    for await (const _ of gallery.generateIndexingSequenceForNewFiles({ bulkCount: 2 })) {
    }
    expect(bulkCreateSpy).toBeCalledTimes(2);
    bulkCreateSpy.mockClear();
    expect(await Item.count()).toBe(4);
    await Item.destroy({ where: {} });

    for await (const _ of gallery.generateIndexingSequenceForNewFiles({ bulkCount: 1 })) {
    }
    expect(bulkCreateSpy).toBeCalledTimes(4);
    bulkCreateSpy.mockClear();
    expect(await Item.count()).toBe(4);
    await Item.destroy({ where: {} });

    await gallery.dispose();
  });

  test("indexing works correctly on complicated structure", async () => {
    const mockFilesInfo: { [posixPath: string]: FileInfo } = {
      "foo-bar/animal images/cat.gif": {
        type: "IMG",
        mtime: new Date("2021-01-01 12:34:56.789"),
        taggedTime: new Date("1994-10-29 12:34:56"),
        width: 1024,
        height: 768,
      },
      "foo-bar/animal images/dog.jpeg": {
        type: "IMG",
        mtime: new Date("2021-01-02 12:34:56"),
        width: 1920,
        height: 1080,
      },
      "Fruits HERE/apple.png": {
        type: "IMG",
        mtime: new Date("2021-01-03 12:34:56"),
        width: 640,
        height: 480,
      },
      "Fruits HERE/banana.webm": {
        type: "VID",
        mtime: new Date("2021-01-04 12:34:56"),
        width: 1280,
        height: 720,
        duration: 12000,
      },
      "apple-copy.png": {
        type: "IMG",
        mtime: new Date("2021-01-03 12:34:56"),
        width: 640,
        height: 480,
      },
    };
    const mockDirectoryStructure: any = {
      "test-gal": { [INDEXING_DIRNAME]: {} },
      "test-gal/foo-bar/animal images/jaguar.txt": "just a text",
      "test-gal/foo.bar": "just a binary",
      "test-gal/baz.qux": "just a binary",
      "not-me.jpg": "2048x3096",
    };
    for (const [relativePath, info] of Object.entries(mockFilesInfo)) {
      mockDirectoryStructure["test-gal/" + relativePath] = createMockFileFactory(info);
    }
    mockfs(mockDirectoryStructure);

    const gallery = new Gallery("test-gal");
    await gallery.open();

    let i = 0;
    for await (const step of gallery.generateIndexingSequenceForNewFiles()) {
      expect(step.totalCount).toBe(Object.keys(mockFilesInfo).length);
      expect(step.processedCount).toBe(i);
      if (i > 0) {
        expect(step.processedInfo.result).toBe("item-added");
      } else {
        expect(step).not.toContainKey("processedInfo");
      }
      i += 1;
    }
    expect(i).toBe(1 + Object.keys(mockFilesInfo).length);

    const Item = gallery.models.item;
    const allItems = await Item.findAll();
    expect(allItems.length).toBe(5);
    for (const item of allItems) {
      const posixDirectory = item.directory.replace(path.sep, "/");
      const relativePosixPath = path.posix.join(posixDirectory, item.filename);
      const fileInfo = mockFilesInfo[relativePosixPath];
      const roundedMtime = new Date(Math.round(fileInfo.mtime.getTime() / 1000) * 1000);
      expect(fileInfo).not.toBeUndefined();
      expect(item.getDataValue("directory")).toBe(posixDirectory);
      expect(item.lost).toBe(false);
      expect(item.size).toBeGreaterThan(0);
      expect(item.mtime.getTime()).toBe(roundedMtime.getTime());
      expect(item.timeMode).toBe(fileInfo.taggedTime ? "METAD" : "MTIME");
      expect(item.time.getTime()).toBe(fileInfo.taggedTime?.getTime() || roundedMtime.getTime());
      expect(item.type).toBe(fileInfo.type);
      expect(item.width).toBe(fileInfo.width);
      expect(item.height).toBe(fileInfo.height);
      expect(item.duration).toBe(fileInfo.duration || null);
    }

    await gallery.dispose();
  });

  test("indexing lost item (same path, same hash)", async () => {
    mockfs({
      "test-gal": {
        [INDEXING_DIRNAME]: {},
        "foo-dir": {
          "bar-dir": {
            "foo.jpg": "1920x1080",
          },
        },
      },
    });

    const gallery = new Gallery("test-gal");
    await gallery.open();

    for await (const step of gallery.generateIndexingSequenceForNewFiles()) {
      expect(step.totalCount).toBe(1);
    }

    const Item = gallery.models.item;
    await Item.update({ lost: true }, { where: { filename: "foo.jpg" } });
    expect((await Item.findOne({ where: { filename: "foo.jpg" } })).lost).toBeTrue();

    const updateSpy = jest.spyOn(Item, "update");
    let i = 0;
    for await (const step of gallery.generateIndexingSequenceForNewFiles()) {
      expect(step.totalCount).toBe(1);
      expect(step.processedCount).toBe(i);
      if (i > 0) {
        expect(step.processedInfo.result).toBe("found-lost-items-file-and-updated");
      }
      i += 1;
    }
    expect(i).toBe(1 + 1);
    expect(updateSpy).toBeCalledTimes(1);
    expect((await Item.findOne({ where: { filename: "foo.jpg" } })).lost).toBeFalse();

    await gallery.dispose();
  });

  test("indexing lost item (same path, different hash)", async () => {
    const mockDirectoryStructure = {
      "test-gal": {
        [INDEXING_DIRNAME]: {},
        "foo-dir": {
          "bar-dir": {
            "foo.jpg": "1920x1080",
          },
        },
      },
    };
    mockfs(mockDirectoryStructure);

    const gallery = new Gallery("test-gal");
    await gallery.open();

    for await (const step of gallery.generateIndexingSequenceForNewFiles()) {
      expect(step.totalCount).toBe(1);
    }

    const Item = gallery.models.item;
    await Item.update({ lost: true }, { where: { filename: "foo.jpg" } });
    expect((await Item.findOne({ where: { filename: "foo.jpg" } })).lost).toBeTrue();

    mockDirectoryStructure["test-gal"]["foo-dir"]["bar-dir"]["foo.jpg"] = "320x240";
    mockfs(mockDirectoryStructure);

    const updateSpy = jest.spyOn(Item, "update");
    let i = 0;
    for await (const step of gallery.generateIndexingSequenceForNewFiles()) {
      expect(step.totalCount).toBe(1);
      expect(step.processedCount).toBe(i);
      if (i > 0) {
        expect(step.processedInfo.result).toBe("found-lost-item-candidate-file");
        expect(
          step.processedInfo.result === "found-lost-item-candidate-file" &&
            step.processedInfo.lostItemPaths
        ).toContain(path.join("foo-dir", "bar-dir", "foo.jpg"));
      }
      i += 1;
    }
    expect(i).toBe(1 + 1);
    expect(updateSpy).not.toBeCalled();

    await gallery.dispose();
  });

  test("indexing lost item (different path, same hash)", async () => {
    const mockDirectoryStructure = {
      "test-gal": {
        [INDEXING_DIRNAME]: {},
        "foo.jpg": "1920x1080 Foo",
        "bar.jpg": "1920x1080 Foo",
      },
    };
    mockfs(mockDirectoryStructure);
    expect(mockDirectoryStructure["test-gal"]["foo.jpg"]).toBe(
      mockDirectoryStructure["test-gal"]["bar.jpg"]
    );

    const gallery = new Gallery("test-gal");
    await gallery.open();

    for await (const step of gallery.generateIndexingSequenceForNewFiles()) {
      expect(step.totalCount).toBe(2);
    }

    const Item = gallery.models.item;
    await Item.update({ lost: true }, { where: { filename: "foo.jpg" } });
    expect((await Item.findOne({ where: { filename: "foo.jpg" } })).lost).toBeTrue();
    await Item.update({ lost: true }, { where: { filename: "bar.jpg" } });
    expect((await Item.findOne({ where: { filename: "bar.jpg" } })).lost).toBeTrue();

    (mockDirectoryStructure as any)["test-gal"]["QUX.jpg"] =
      mockDirectoryStructure["test-gal"]["foo.jpg"];
    delete mockDirectoryStructure["test-gal"]["foo.jpg"];
    delete mockDirectoryStructure["test-gal"]["bar.jpg"];
    mockfs(mockDirectoryStructure);

    const updateSpy = jest.spyOn(Item, "update");
    let i = 0;
    for await (const step of gallery.generateIndexingSequenceForNewFiles()) {
      expect(step.totalCount).toBe(1);
      expect(step.processedCount).toBe(i);
      if (i > 0) {
        expect(step.processedInfo.result).toBe("found-lost-item-candidate-file");
        expect(
          step.processedInfo.result === "found-lost-item-candidate-file" &&
            step.processedInfo.lostItemPaths
        ).toIncludeSameMembers(["foo.jpg", "bar.jpg"]);
      }
      i += 1;
    }
    expect(i).toBe(1 + 1);
    expect(updateSpy).not.toBeCalled();

    await gallery.dispose();
  });
});

describe("testing gallery indexing for existing items", () => {
  test("fetchCount options works correctly", async () => {
    mockfs({
      "test-gal": {
        [INDEXING_DIRNAME]: {},
        "foo.gif": "1024x768",
        "bar.jpeg": "1024x768",
        "baz.png": "1024x768",
        "qux.webm": "1024x768 10s",
      },
    });

    const gallery = new Gallery("test-gal");
    await gallery.open();
    for await (const _ of gallery.generateIndexingSequenceForNewFiles()) {
    }

    const Item = gallery.models.item;
    const findAllSpy = jest.spyOn(Item, "findAll");

    for await (const _ of gallery.generateIndexingSequenceForPreexistences({ fetchCount: 5 })) {
    }
    expect(findAllSpy).toBeCalledTimes(1 + 1);
    findAllSpy.mockClear();

    for await (const _ of gallery.generateIndexingSequenceForPreexistences({ fetchCount: 4 })) {
    }
    expect(findAllSpy).toBeCalledTimes(1 + 1);
    findAllSpy.mockClear();

    for await (const _ of gallery.generateIndexingSequenceForPreexistences({ fetchCount: 3 })) {
    }
    expect(findAllSpy).toBeCalledTimes(2 + 1);
    findAllSpy.mockClear();

    for await (const _ of gallery.generateIndexingSequenceForPreexistences({ fetchCount: 2 })) {
    }
    expect(findAllSpy).toBeCalledTimes(2 + 1);
    findAllSpy.mockClear();

    for await (const _ of gallery.generateIndexingSequenceForPreexistences({ fetchCount: 1 })) {
    }
    expect(findAllSpy).toBeCalledTimes(4 + 1);
    findAllSpy.mockClear();

    await gallery.dispose();
  });

  test("with no changes", async () => {
    mockfs({
      "test-gal": {
        [INDEXING_DIRNAME]: {},
        "foo.gif": "1024x768",
        "bar.jpeg": "1024x768",
        "baz.png": "1024x768",
        "qux.webm": "1024x768 10s",
      },
    });

    const gallery = new Gallery("test-gal");
    await gallery.open();
    for await (const _ of gallery.generateIndexingSequenceForNewFiles()) {
    }

    const Item = gallery.models.item;
    const updateSpy = jest.spyOn(Item, "update");

    let i = 0;
    for await (const step of gallery.generateIndexingSequenceForPreexistences()) {
      expect(step.totalCount).toBe(4);
      expect(step.processedCount).toBe(i);
      if (i > 0) {
        expect(step.processedInfo?.result).toBe("no-big-change");
      }
      i++;
    }
    expect(updateSpy).toBeCalledTimes(0);

    await gallery.dispose();
  });

  test("file's content is changed", async () => {
    const mockFilesInfo = {
      "foo-bar/baz-qux/foo.jpg": {
        type: "IMG",
        mtime: new Date("2021-01-01 12:34:56"),
        taggedTime: new Date("1994-10-29 12:34:56"),
        width: 1024,
        height: 768,
      } as FileInfo,
      "foo-bar/baz-qux/bar.mp4": {
        type: "IMG",
        mtime: new Date("2021-01-02 12:34:56"),
        taggedTime: new Date("1994-10-29 12:34:56"),
        width: 1280,
        height: 720,
        duration: 10000,
      } as FileInfo,
      "foo-bar/baz-qux/baz.webp": {
        type: "IMG",
        mtime: new Date("2021-01-03 12:34:56"),
        taggedTime: new Date("1994-10-29 12:34:56"),
        width: 1024,
        height: 768,
      } as FileInfo,
      "foo-bar/baz-qux/qux.webm": {
        type: "IMG",
        mtime: new Date("2021-01-04 12:34:56"),
        taggedTime: new Date("1994-10-29 12:34:56"),
        width: 1280,
        height: 720,
        duration: 10000,
      } as FileInfo,
    };
    const mockFilesCount = Object.keys(mockFilesInfo).length;
    const updateMockfs = () => {
      const mockDirectoryStructure: any = {
        "test-gal": { [INDEXING_DIRNAME]: {} },
      };
      for (const [relativePath, info] of Object.entries(mockFilesInfo)) {
        mockDirectoryStructure["test-gal/" + relativePath] = createMockFileFactory(info);
      }
      mockfs(mockDirectoryStructure);
    };
    updateMockfs();

    const gallery = new Gallery("test-gal");
    await gallery.open();
    for await (const _ of gallery.generateIndexingSequenceForNewFiles()) {
    }

    const Item = gallery.models.item;
    const updateSpy = jest.spyOn(Item, "update");

    mockFilesInfo["foo-bar/baz-qux/foo.jpg"].taggedTime = new Date("2010-10-29 12:34:56");
    updateMockfs();
    let i = 0;
    for await (const step of gallery.generateIndexingSequenceForPreexistences()) {
      expect(step.totalCount).toBe(mockFilesCount);
      expect(step.processedCount).toBe(i);
      if (i > 0) {
        expect(step.processedInfo.result).toBe("no-big-change");
      }
      i += 1;
    }
    expect(i).toBe(1 + mockFilesCount);
    expect(updateSpy).toBeCalledTimes(0);
    updateSpy.mockClear();

    mockFilesInfo["foo-bar/baz-qux/foo.jpg"].content = "CHANGING FILE'S SIZE AND HASH";
    updateMockfs();
    i = 0;
    for await (const step of gallery.generateIndexingSequenceForPreexistences()) {
      expect(step.totalCount).toBe(mockFilesCount);
      expect(step.processedCount).toBe(i);
      if (i > 0) {
        if (step.processedInfo.path.includes("foo.jpg")) {
          expect(step.processedInfo.result).toBe("item-updated");
        } else {
          expect(step.processedInfo.result).toBe("no-big-change");
        }
      }
      i += 1;
    }
    expect(i).toBe(1 + mockFilesCount);
    expect(updateSpy).toBeCalledTimes(1);
    updateSpy.mockClear();

    mockFilesInfo["foo-bar/baz-qux/bar.mp4"].width = 3840;
    mockFilesInfo["foo-bar/baz-qux/bar.mp4"].height = 2160;
    mockFilesInfo["foo-bar/baz-qux/bar.mp4"].duration = 20000;
    updateMockfs();
    i = 0;
    for await (const step of gallery.generateIndexingSequenceForPreexistences()) {
      expect(step.totalCount).toBe(mockFilesCount);
      expect(step.processedCount).toBe(i);
      if (i > 0) {
        if (step.processedInfo.path.includes("bar.mp4")) {
          expect(step.processedInfo.result).toBe("item-updated");
        } else {
          expect(step.processedInfo.result).toBe("no-big-change");
        }
      }
      i += 1;
    }
    expect(i).toBe(1 + mockFilesCount);
    expect(updateSpy).toBeCalledTimes(1);
    updateSpy.mockClear();

    const barItem = await Item.findOne({ where: { filename: "bar.mp4" } });
    expect(barItem.width).toBe(3840);
    expect(barItem.height).toBe(2160);
    expect(barItem.duration).toBe(20000);

    await gallery.dispose();
  });

  test("file's mtime is changed only", async () => {
    const fooFile: FileInfo = {
      type: "IMG",
      mtime: new Date("1997-01-01 12:34:56"),
      taggedTime: new Date("1994-10-29 12:34:56"),
      width: 1024,
      height: 768,
    };
    mockfs({
      "test-gal": {
        [INDEXING_DIRNAME]: {},
        "foo.jpg": createMockFileFactory(fooFile),
      },
    });

    const gallery = new Gallery("test-gal");
    await gallery.open();
    for await (const _ of gallery.generateIndexingSequenceForNewFiles()) {
    }

    const Item = gallery.models.item;
    const updateSpy = jest.spyOn(Item, "update");

    const newMtime = new Date("2021-01-01- 12:34:56");
    fooFile.mtime = newMtime;
    mockfs({
      "test-gal": {
        [INDEXING_DIRNAME]: {},
        "foo.jpg": createMockFileFactory(fooFile),
      },
    });

    let i = 0;
    for await (const step of gallery.generateIndexingSequenceForPreexistences()) {
      expect(step.totalCount).toBe(1);
      expect(step.processedCount).toBe(i);
      if (i > 0) {
        expect(step.processedInfo?.result).toBe("no-big-change");
      }
      i++;
    }
    expect(updateSpy).toBeCalledTimes(1);
    expect((await Item.findOne()).mtime.getTime()).toBe(newMtime.getTime());

    await gallery.dispose();
  });

  test("file is lost", async () => {
    const mockDirectoryStructure = {
      "test-gal": {
        [INDEXING_DIRNAME]: {},
        "foo.gif": "1024x768",
        "bar.jpeg": "1024x768",
        "baz.png": "1024x768",
        "qux.webm": "1024x768 10s",
      },
    };
    mockfs(mockDirectoryStructure);

    const gallery = new Gallery("test-gal");
    await gallery.open();
    for await (const _ of gallery.generateIndexingSequenceForNewFiles()) {
    }

    const Item = gallery.models.item;
    const updateSpy = jest.spyOn(Item, "update");

    delete mockDirectoryStructure["test-gal"]["foo.gif"];
    delete mockDirectoryStructure["test-gal"]["qux.webm"];
    mockfs(mockDirectoryStructure);

    let i = 0;
    for await (const step of gallery.generateIndexingSequenceForPreexistences()) {
      expect(step.totalCount).toBe(4);
      expect(step.processedCount).toBe(i);
      if (i > 0) {
        if (["foo.gif", "qux.webm"].includes(step.processedInfo.path)) {
          expect(step.processedInfo?.result).toBe("item-lost");
        } else {
          expect(step.processedInfo?.result).toBe("no-big-change");
        }
      }
      i++;
    }
    expect(updateSpy).toBeCalledTimes(2);
    expect((await Item.findOne({ where: { filename: "foo.gif" } })).lost).toBeTrue();
    expect((await Item.findOne({ where: { filename: "qux.webm" } })).lost).toBeTrue();

    await gallery.dispose();
  });

  test("discovering lost item with same hash", async () => {
    const mockDirectoryStructure = {
      "test-gal": {
        [INDEXING_DIRNAME]: {},
        "foo.gif": "1024x768",
        "bar.jpeg": "1024x768",
        "baz.png": "1024x768",
        "qux.webm": "1024x768 10s",
      },
    };
    mockfs(mockDirectoryStructure);

    const gallery = new Gallery("test-gal");
    await gallery.open();
    for await (const _ of gallery.generateIndexingSequenceForNewFiles()) {
    }

    const Item = gallery.models.item;
    await Item.update({ lost: true }, { where: { filename: ["foo.gif", "qux.webm"] } });

    const updateSpy = jest.spyOn(Item, "update");
    let i = 0;
    for await (const step of gallery.generateIndexingSequenceForPreexistences()) {
      expect(step.totalCount).toBe(4);
      expect(step.processedCount).toBe(i);
      if (i > 0) {
        if (["foo.gif", "qux.webm"].includes(step.processedInfo.path)) {
          expect(step.processedInfo?.result).toBe("found-lost-items-file-and-updated");
        } else {
          expect(step.processedInfo?.result).toBe("no-big-change");
        }
      }
      i++;
    }
    expect(updateSpy).toBeCalledTimes(2);
    expect((await Item.findOne({ where: { filename: "foo.gif" } })).lost).toBeFalse();
    expect((await Item.findOne({ where: { filename: "qux.webm" } })).lost).toBeFalse();

    await gallery.dispose();
  });

  test("discovering lost item but different hash", async () => {
    // TODO: implement
    const mockDirectoryStructure = {
      "test-gal": {
        [INDEXING_DIRNAME]: {},
        "foo.gif": "1024x768",
        "bar.jpeg": "1024x768",
        "baz.png": "1024x768",
        "qux.webm": "1024x768 10s",
      },
    };
    mockfs(mockDirectoryStructure);

    const gallery = new Gallery("test-gal");
    await gallery.open();
    for await (const _ of gallery.generateIndexingSequenceForNewFiles()) {
    }

    mockDirectoryStructure["test-gal"]["foo.gif"] = "2048x1536";
    mockDirectoryStructure["test-gal"]["qux.webm"] = "2048x1536 20s";
    mockfs(mockDirectoryStructure);

    const Item = gallery.models.item;
    await Item.update({ lost: true }, { where: { filename: ["foo.gif", "qux.webm"] } });

    const updateSpy = jest.spyOn(Item, "update");
    let i = 0;
    for await (const step of gallery.generateIndexingSequenceForPreexistences()) {
      expect(step.totalCount).toBe(4);
      expect(step.processedCount).toBe(i);
      if (i > 0) {
        if (["foo.gif", "qux.webm"].includes(step.processedInfo.path)) {
          expect(step.processedInfo?.result).toBe("found-lost-items-candidate-file");
        } else {
          expect(step.processedInfo?.result).toBe("no-big-change");
        }
      }
      i++;
    }
    expect(updateSpy).not.toBeCalled();
    expect((await Item.findOne({ where: { filename: "foo.gif" } })).lost).toBeTrue();
    expect((await Item.findOne({ where: { filename: "qux.webm" } })).lost).toBeTrue();

    await gallery.dispose();
  });
});
