import ffmpegPath from "ffmpeg-static";
import { path as ffprobePath } from "ffprobe-static";
import Main from "./Main";

process.env.FFMPEG_PATH = ffmpegPath;
process.env.FFPROBE_PATH = ffprobePath;

new Main(process.argv);
