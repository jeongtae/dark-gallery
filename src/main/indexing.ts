import { promisify } from "util";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import sharp from "sharp";
import { ExifImage } from "exif";
import ffmpeg, { ffprobe as _ffprobe, FfprobeData } from "fluent-ffmpeg";
import _getImageSize from "image-size";
const ffprobe = promisify<string, FfprobeData>(_ffprobe);
const getImageSize = promisify(_getImageSize);

export type PathFilteringOptions = {
  /** 무시할 디렉터리 이름의 배열입니다. */
  ignoreDirectories?: string[];
  /** 무시할 파일 이름의 배열입니다. */
  ignoreFiles?: string[];
  /** 통과할 확장자 이름의 배열입니다. 제공하지 않으면 모든 확장자를 허용합니다. */
  acceptingExtensions?: string[];
};

/** 주어진 디렉터리 경로 아래의 모든 파일의 개수를 셉니다.
 * @param baseDirPath 탐색할 기반 경로입니다.
 * @param options 탐색 옵션입니다. (*각 옵션에서 Glob 패턴은 허용하지 않습니다.*)
 * @returns 파일의 개수
 */
export async function countAllChildFiles(baseDirPath: string, options: PathFilteringOptions = {}) {
  let { ignoreDirectories = [], ignoreFiles = [], acceptingExtensions = null } = options;
  acceptingExtensions = acceptingExtensions?.map(ext => ext.toLowerCase());

  let result: number = 0;
  async function walk(currentRelativeDirPath: string) {
    const currentResolvedDirPath = path.join(baseDirPath, currentRelativeDirPath);
    const dirents = await fs.promises.readdir(currentResolvedDirPath, { withFileTypes: true });
    for (const dirent of dirents) {
      const { name } = dirent;
      const relativePath = path.join(currentRelativeDirPath, name);
      if (dirent.isDirectory()) {
        const isPassedIgnoreDirectories = !ignoreDirectories.includes(name);
        if (isPassedIgnoreDirectories) {
          await walk(relativePath);
        }
      } else if (dirent.isFile()) {
        const extension = path.extname(name).toLowerCase().substring(1);
        const isPassedAcceptingExtensions = acceptingExtensions?.includes(extension) ?? true;
        const isPassedIgnoreFiles = !ignoreFiles.includes(name);
        if (isPassedAcceptingExtensions && isPassedIgnoreFiles) {
          result += 1;
        }
      }
    }
  }

  await walk(".");
  return result;
}

/** 주어진 디렉터리 경로 아래의 모든 파일의 경로를 열거합니다.
 * @param baseDirPath 탐색할 기반 경로입니다.
 * @param options 탐색 옵션입니다. (*각 옵션에서 Glob 패턴은 허용하지 않습니다.*)
 * @yields 파일의 경로 (매개변수로 제공한 기반 경로에 대한 상대 경로)
 */
export function generateAllChildFileRelativePaths(
  baseDirPath: string,
  options: PathFilteringOptions = {}
): AsyncGenerator<string> {
  let { ignoreDirectories = [], ignoreFiles = [], acceptingExtensions = null } = options;
  acceptingExtensions = acceptingExtensions?.map(ext => ext.toLowerCase());
  async function* walk(currentRelativeDirPath: string): AsyncGenerator<string> {
    const currentResolvedDirPath = path.join(baseDirPath, currentRelativeDirPath);
    const nextRelativeDirPathList: string[] = [];
    const dirents = await fs.promises.readdir(currentResolvedDirPath, { withFileTypes: true });
    for (const dirent of dirents) {
      const { name } = dirent;
      const relativePath = path.join(currentRelativeDirPath, name);
      if (dirent.isDirectory()) {
        const isPassedIgnoreDirectories = !ignoreDirectories.includes(name);
        if (isPassedIgnoreDirectories) {
          nextRelativeDirPathList.push(relativePath);
        }
      } else if (dirent.isFile()) {
        const extension = path.extname(name).toLowerCase().substring(1);
        const isPassedAcceptingExtensions = acceptingExtensions?.includes(extension) ?? true;
        const isPassedIgnoreFiles = !ignoreFiles.includes(name);
        if (isPassedAcceptingExtensions && isPassedIgnoreFiles) {
          yield relativePath;
        }
      }
    }
    for (const nextRelativeDirPath of nextRelativeDirPathList) {
      for await (const relativePath of walk(nextRelativeDirPath)) {
        yield relativePath;
      }
    }
  }
  return walk(".");
}

/** 주어진 경로에 해당하는 파일의 파일의 SHA-1 해시값을 계산합니다.
 * @returns 40자리의 16진수 문자열로 나타낸 SHA-1 해시값을 반환합니다.
 */
export function getFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hasher = crypto.createHash("sha1");
    const stream = fs.createReadStream(filePath);
    stream.once("error", reject);
    stream.on("data", hasher.update.bind(hasher));
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
 * @throws {NodeJS.ErrnoException}
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
export type ImageInfo = {
  width: number;
  height: number;
  /** EXIF 메타데이터에 기록된 시각입니다. */
  taggedTime?: Date;
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
      const taggedTime = await getExifTime(filePath);
      if (taggedTime) result.taggedTime = taggedTime;
    } catch {}
  }
  return result;
}

export type VideoInfo = {
  width: number;
  height: number;
  /** 마이크로초 단위의 길이입니다. */
  duration: number;
  /** 비디오 코덱 문자열입니다. */
  codec: string;
  /** 메타데이터에 기록된 시각입니다. */
  taggedTime?: Date;
};
export async function getVideoInfo(filePath: string) {
  const metadata = await ffprobe(filePath);
  const { duration } = metadata.format;
  const { width, height, codec_name: codec } = metadata.streams.find(
    stream => stream.codec_type.toLowerCase() === "video"
  );
  const result: VideoInfo = {
    width,
    height,
    codec,
    duration: Math.ceil(duration * 1000),
  };
  const tags: any = metadata.format.tags;
  const taggedTime: string = tags["com.apple.quicktime.creationdate"] || tags["creation_time"];
  if (taggedTime) result.taggedTime = new Date(taggedTime);
  return result;
}

/** 원본 크기 비율을 유지한 채로, 적당하게 변경되는 크기를 계산합니다.
 * @param width 원본 크기의 너비
 * @param height 원본 크기의 높이
 * @param coverSize 희망 크기, 제공한 너비와 높이 중 짧은 쪽이 이 값이 됩니다.
 * @param maxAspectRatio 최대 허용할 크기 비율, 비율의 긴 정도만을 의미합니다.
 * 제공한 원본 크기의 긴 정도가, 이 값을 넘어서면, 긴 쪽을 희망 크기에 맞춥니다.
 * 단순히 긴 정도를 의미하기 때문에 1 이상의 값만 사용할 수 있습니다.
 * @returns 적당하게 계산된 결과 크기
 */
export function getResizedImageSize(
  width: number,
  height: number,
  coverSize: number,
  maxAspectRatio: number
): { width: number; height: number } {
  const aspectRatio = width / height;
  if (aspectRatio <= maxAspectRatio && aspectRatio >= 1 / maxAspectRatio) {
    return {
      width: Math.round(aspectRatio <= 1 ? coverSize : coverSize * aspectRatio),
      height: Math.round(aspectRatio >= 1 ? coverSize : coverSize / aspectRatio),
    };
  } else {
    return {
      width: Math.round(aspectRatio >= 1 ? coverSize : coverSize * aspectRatio),
      height: Math.round(aspectRatio <= 1 ? coverSize : coverSize / aspectRatio),
    };
  }
}

type ClipRange = {
  /** 시작 타임스탬프 (밀리초 단위) */
  start: number;
  /** 길이 (밀리초 단위) */
  duration: number;
};
/** 주어진 비디오 길이에서 미리보기 용도로 쓸만하도록 적당히 나눈 ClipRange 객체 목록을 계산합니다.
 * @param duration 클립당 비디오 길이 (밀리초 단위)
 * @returns 적당하게 분할된 `ClipRange` 객체 목록
 */
function getPreviewClipRangesOfVideoDuration(duration: number) {
  const CLIP_INTERVAL = 12000;
  const CLIP_DURATION = 1500;

  const numberOfClips = Math.min(~~(duration / CLIP_INTERVAL) + 1, 8);

  const clipRanges: ClipRange[] = [];
  for (let i = 0; i < numberOfClips; i++) {
    const mid = (duration / numberOfClips) * (i + 0.5);
    const start = Math.max(mid - CLIP_DURATION / 2, 0);
    clipRanges.push({
      start,
      duration: Math.min(CLIP_DURATION, duration - start),
    });
  }
  return clipRanges;
}

/** 주어진 경로에 있는 이미지로 크기가 변경된 WEBP 이미지를 만들어서 버퍼 형태로 반환합니다.
 * 변경하려는 크기 비율이 원본 비율과 다를 경우, `cover attention`모드로 변경됩니다.
 * @param filePath 이미지 파일의 절대경로
 * @param width 변경할 너비
 * @param height 변경할 높이
 * @param quality WEBP 퀄리티값 (기본 70)
 * @returns WEBP 이미지가 담긴 버퍼
 */
export async function getResizedWebpImageBufferOfImageFile(
  filePath: string,
  width: number,
  height: number,
  quality: number = 70
) {
  return await sharp(filePath)
    .resize(width, height, { fit: "cover", position: sharp.strategy.attention })
    .webp({ quality })
    .toBuffer();
}

/** 주어진 경로에 있는 이미지로 크기가 변경된 WEBP 이미지로 만들어서 저장합니다.
 * 변경하려는 크기 비율이 원본 비율과 다를 경우, `cover attention`모드로 변경됩니다.
 * @param srcPath 원본 이미지 파일의 절대경로
 * @param destPath 저장할 이미지 파일의 절대경로
 * @param width 변경할 너비
 * @param height 변경할 높이
 * @param quality WEBP 퀄리티값 (기본 70)
 */
export function writeResizedWebpImageFileOfImageFile(
  srcPath: string,
  destPath: string,
  width: number,
  height: number,
  quality: number = 70
) {
  return new Promise((resolve, reject) =>
    sharp(srcPath)
      .resize(width, height, { fit: "cover", position: sharp.strategy.attention })
      .webp({ quality })
      .toFile(destPath, (err, info) => (err ? reject(err) : resolve(info)))
  );
}

/** 주어진 경로에 있는 비디오의 적당한 장면을 크기가 변경된 WEBP 이미지로 만들어서 저장합니다.
 * 변경하려는 크기 비율이 원본 비율과 다를 경우, 비율을 늘려서 맞춥니다.
 * @param srcPath 원본 비디오 파일의 절대경로
 * @param destPath 저장할 비디오 파일의 절대경로
 * @param width 변경할 너비
 * @param height 변경할 높이
 * @param quality WEBP 퀄리티 (기본 70)
 */
export async function writeResizedWebpImageFileOfVideoFile(
  srcPath: string,
  destPath: string,
  width: number,
  height: number,
  quality: number = 70
) {
  const metadata = await ffprobe(srcPath);
  let { duration } = metadata.format;
  duration *= 1000;
  const clipRange = getPreviewClipRangesOfVideoDuration(duration)[0];
  const timestamp = clipRange.start + clipRange.duration / 2;

  return new Promise((resolve, reject) =>
    ffmpeg()
      .seek(timestamp / 1000)
      .input(srcPath)
      .size(`${~~width}x${~~height}`)
      .videoCodec("libwebp")
      .withOptions(["-vframes:v 1", `-qscale ${~~quality}`])
      .outputFormat("webp")
      .output(destPath)
      .on("error", reject)
      .on("end", resolve)
      .run()
  );
}

/** 주어진 경로에 있는 비디오의 축소판 프리뷰 비디오 파일을 작성합니다. H264 MP4 형식으로 작성됩니다.
 * 변경하려는 크기 비율이 원본 비율과 다를 경우, 비율을 늘려서 맞춥니다.
 * @param filePath 비디오 파일의 절대경로
 * @param destPath 비디오 파일을 저장할 절대경로 (.mp4 확장자)
 * @param tempDirPath 분할 클립을 임시저장할 디렉터리 경로
 * @param width 변경할 너비
 * @param height 변경할 높이
 * @param crf H264 CRF, 낮을수록 고화질 (0~51, 기본 22)
 */
export async function writeResizedPreviewVideoFileOfVideoFile(
  srcPath: string,
  destPath: string,
  tempDirPath: string,
  width: number,
  height: number,
  crf: number = 22
) {
  const srcBaseName = path.basename(srcPath);
  const metadata = await ffprobe(srcPath);
  let { duration } = metadata.format;
  duration *= 1000;
  const clipRanges = getPreviewClipRangesOfVideoDuration(duration);

  const clipPaths: string[] = [];
  try {
    for (let i = 0; i < clipRanges.length; i++) {
      const { start, duration } = clipRanges[i];
      const clipPath = path.join(tempDirPath, `TMP_${srcBaseName}_CLIP${i + 1}.mp4`);
      clipPaths.push(clipPath);
      await new Promise((resolve, reject) =>
        ffmpeg()
          .input(srcPath)
          .size(`${~~width}x${~~height}`)
          .setStartTime(start / 1000)
          .setDuration(duration / 1000)
          .videoCodec("libx264")
          .addOptions([`-crf ${~~crf}`])
          .fps(24)
          .noAudio()
          .output(clipPath)
          .on("error", reject)
          .on("end", resolve)
          .run()
      );
    }
    await new Promise((resolve, reject) => {
      let command = ffmpeg();
      for (const path of clipPaths) {
        command = command.addInput(path);
      }
      return command
        .videoCodec("libx264")
        .addOptions([`-crf ${~~crf}`])
        .noAudio()
        .on("error", reject)
        .on("end", resolve)
        .mergeToFile(destPath);
    });
  } finally {
    for (const clipPath of clipPaths) {
      try {
        fs.promises.unlink(clipPath);
      } catch {}
    }
  }
}
