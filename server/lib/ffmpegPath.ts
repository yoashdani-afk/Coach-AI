import { existsSync } from 'node:fs';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

const SYSTEM_FFMPEG = '/usr/bin/ffmpeg';

/**
 * Prefer system ffmpeg (Railway Docker installs `/usr/bin/ffmpeg` with libx264).
 * Fall back to @ffmpeg-installer for local Mac/dev.
 */
export const FFMPEG_PATH =
  process.env.FFMPEG_PATH?.trim() ||
  (existsSync(SYSTEM_FFMPEG) ? SYSTEM_FFMPEG : ffmpegInstaller.path);
