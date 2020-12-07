import { promisify } from "util";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { ExifImage } from "exif";
import _getImageSize from "image-size";
const getImageSize = promisify(_getImageSize);

type GetAllChildFilePathOptions = {
  /** 무시할 디렉터리 이름의 배열입니다. */
  ignoreDirectories?: string[];
  /** 무시할 파일 이름의 배열입니다. */
  ignoreFiles?: string[];
  /** 통과할 확장자 이름의 배열입니다. 제공하지 않으면 모든 확장자를 허용합니다. */
  acceptingExtensions?: string[];
};
/** 주어진 디렉터리 경로 아래의 모든 파일의 경로를 탐색합니다.
 * @param basePath 탐색할 기반 경로입니다.
 * @param options 탐색 옵션입니다. (*각 옵션에서 Glob 패턴은 허용하지 않습니다.*)
 * @returns 파일 경로의 배열을 반환하며, 각 경로는 매개변수로 제공한 기반 경로에 대한 상대 경로입니다.
 */
export async function getAllChildFilePath(
  basePath: string,
  options: GetAllChildFilePathOptions = {}
) {
  const { ignoreDirectories, ignoreFiles, acceptingExtensions } = options;
  const result: string[] = [];

  const walk = async (relativeDirectoryPath: string) => {
    const absoluteDirectoryPath = path.join(basePath, relativeDirectoryPath);
    const dirents = await fs.promises.readdir(absoluteDirectoryPath, { withFileTypes: true });
    for (const dirent of dirents) {
      const { name } = dirent;
      const joinedPath = path.join(relativeDirectoryPath, name);
      const ext = path.extname(name).toLowerCase().substring(1);
      if (
        dirent.isFile() &&
        !ignoreFiles?.includes(name) &&
        (acceptingExtensions?.includes(ext) ?? true)
      ) {
        result.push(joinedPath);
      } else if (dirent.isDirectory() && !ignoreDirectories?.includes(name)) {
        await walk(joinedPath);
      }
    }
    return result;
  };

  await walk(".");
  return result;
}

/** 주어진 경로에 해당하는 파일의 파일의 SHA-1 해시값을 계산합니다.
 * @returns 40자리의 16진수 문자열로 나타낸 SHA-1 해시값을 반환합니다.
 */
export function getFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hasher = crypto.createHash("sha1");
    const stream = fs.createReadStream(filePath);
    stream.once("error", reject);
    stream.on("data", chunk => hasher.update(chunk));
    stream.once("close", () => resolve(hasher.digest("hex")));
  });
}

type FileInfo = {
  /** 바이트 단위의 파일 크기입니다. */
  size: number;
  /** 파일의 수정한 시각입니다. */
  mtime: Date;
};
/** 주어진 경로에 해당하는 파일의 정보를 조회합니다.
 * @param filePath 조회할 파일의 절대 경로입니다.
 * @throws `NodeJS.ErrnoException`
 * @returns 파일 정보 객체를 반환합니다.
 */
export async function getFileInfo(filePath: string): Promise<FileInfo> {
  const stat = await fs.promises.stat(filePath);
  return {
    size: stat.size,
    mtime: stat.mtime,
  };
}

function getExifTime(filePath: string): Promise<Date> {
  return new Promise((resolve, reject) => {
    new ExifImage({ image: filePath }, (error, exif) => {
      if (error) {
        reject(error);
        return;
      }
      let dateString = exif.exif.DateTimeOriginal || exif.exif.CreateDate;
      if (!dateString) {
        reject(new Error());
        return;
      }
      const matches = [
        ...dateString.matchAll(/(\d{4}).(\d{1,2}).(\d{1,2}).(\d{2}).(\d{2}).(\d{2})/g),
      ];
      if (!matches.length) {
        reject(new Error());
        return;
      }
      try {
        const dateParts = {
          Y: parseInt(matches[0][1]),
          M: parseInt(matches[0][2]),
          D: parseInt(matches[0][3]),
          h: parseInt(matches[0][4]),
          m: parseInt(matches[0][5]),
          s: parseInt(matches[0][6]),
        };
        const date = new Date(
          dateParts.Y,
          dateParts.M - 1,
          dateParts.D,
          dateParts.h,
          dateParts.m,
          dateParts.s
        );
        resolve(date);
      } catch (e) {
        reject(e);
      }
    });
  });
}
type ImageInfo = {
  width: number;
  height: number;
  /** EXIF 메타데이터에 기록된 시각입니다. */
  exifTime?: Date;
};
/** 주어진 경로에 해당하는 이미지 파일의 정보를 조회합니다.
 * @param filePath 조회할 파일의 절대 경로입니다.
 * @returns 이미지 파일 정보 객체를 반환합니다.
 */
export async function getImageInfo(filePath: string): Promise<ImageInfo> {
  const { width, height } = await getImageSize(filePath);
  const result: ImageInfo = {
    width,
    height,
  };
  const ext = path.extname(filePath).substring(1).toLowerCase();
  if (ext === "jpg" || ext === "jpeg") {
    try {
      result.exifTime = await getExifTime(filePath);
    } catch {}
  }
  return result;
}
