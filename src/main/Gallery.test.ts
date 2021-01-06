import "jest-extended";
import fs from "fs";
import path from "path";
import mockfs from "mock-fs";
import type { GalleryPathInfo } from "./ipc";
import Gallery from "./Gallery";
import type { ImageInfo } from "./indexing";

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
}));

describe("testing gallery indexing", () => {
  beforeAll(async () => {
    mockfs({
      node_modules: mockfs.load(path.resolve(process.cwd(), "node_modules"), { lazy: true }),
      "test-gallery": {
        ".darkgallery": {},
        "apple.png": "3840x2160 Apple",
        "orange.webp": "1920x1080 Orange",
      },
      "outside.jpg": "",
    });
  });
  afterAll(() => {
    mockfs.restore();
  });

  test("configs", async () => {
    const gallery = new Gallery("./test-gallery");
    await gallery.open();
    await gallery.setConfig("description", "foo");
    expect(await gallery.getConfig("description")).toBe("foo");
    await gallery.dispose();
  });

  test("creating and close gallery", async () => {
    const gallery = new Gallery("./test-gallery");
    await gallery.open();
    await gallery.dispose();
  });
});
