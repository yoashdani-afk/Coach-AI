import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

/**
 * Prefer system ffmpeg (Railway Dockerfile installs `/usr/bin/ffmpeg` with libx264).
 * Fall back to @ffmpeg-installer for local Mac/dev.
 */
export const FFMPEG_PATH =
  process.env.FFMPEG_PATH?.trim() || ffmpegInstaller.path;
