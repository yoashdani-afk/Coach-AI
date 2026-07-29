import { spawn } from 'node:child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

const FFMPEG_PATH = ffmpegInstaller.path;

export type VideoRotation = 0 | 90 | 180 | 270;

export interface VideoGeometry {
  /** Stored stream width (before rotation). */
  storedWidth: number;
  /** Stored stream height (before rotation). */
  storedHeight: number;
  /** Clockwise rotation needed for display (0, 90, 180, 270). */
  rotation: VideoRotation;
  /** Display-oriented width after rotation is applied. */
  displayWidth: number;
  /** Display-oriented height after rotation is applied. */
  displayHeight: number;
  /** True when display matrix or tags indicate horizontal mirroring. */
  isMirrored: boolean;
}

function parseRotation(stderr: string): VideoRotation {
  const displayMatrix = stderr.match(/rotation of (-?\d+(?:\.\d+)?)\s*degrees/i);
  if (displayMatrix) {
    const raw = Math.round(Number(displayMatrix[1])) % 360;
    const normalized = ((raw % 360) + 360) % 360;
    if (normalized === 90 || normalized === 270 || normalized === 180) {
      return normalized as VideoRotation;
    }
  }

  const rotateTag = stderr.match(/\brotate\s*:\s*(-?\d+)/i);
  if (rotateTag) {
    const raw = Math.round(Number(rotateTag[1])) % 360;
    const normalized = ((raw % 360) + 360) % 360;
    if (normalized === 90 || normalized === 270 || normalized === 180) {
      return normalized as VideoRotation;
    }
  }

  return 0;
}

function parseMirrored(stderr: string): boolean {
  return (
    /hflip/i.test(stderr) ||
    /horizontal flip/i.test(stderr) ||
    /mirror/i.test(stderr)
  );
}

function parseStreamDimensions(stderr: string): { width: number; height: number } | null {
  const match = stderr.match(/Stream #\d+:\d+.*Video:.*\s(\d{2,5})x(\d{2,5})/);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!width || !height) return null;
  return { width, height };
}

function displayDimensions(
  storedWidth: number,
  storedHeight: number,
  rotation: VideoRotation
): { displayWidth: number; displayHeight: number } {
  if (rotation === 90 || rotation === 270) {
    return { displayWidth: storedHeight, displayHeight: storedWidth };
  }
  return { displayWidth: storedWidth, displayHeight: storedHeight };
}

/**
 * Reads video stream geometry via ffmpeg stderr (no separate ffprobe binary required).
 */
export async function probeVideoGeometry(videoPath: string): Promise<VideoGeometry> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_PATH, ['-hide_banner', '-i', videoPath]);
    const stderrChunks: Buffer[] = [];

    proc.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
    proc.on('error', reject);
    proc.on('close', () => {
      const stderr = Buffer.concat(stderrChunks).toString('utf8');
      const dims = parseStreamDimensions(stderr);
      if (!dims) {
        reject(new Error('Could not read video stream dimensions from ffmpeg probe'));
        return;
      }

      const rotation = parseRotation(stderr);
      const { displayWidth, displayHeight } = displayDimensions(
        dims.width,
        dims.height,
        rotation
      );

      resolve({
        storedWidth: dims.width,
        storedHeight: dims.height,
        rotation,
        displayWidth,
        displayHeight,
        isMirrored: parseMirrored(stderr),
      });
    });
  });
}
