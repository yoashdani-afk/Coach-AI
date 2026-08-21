import { spawn } from 'node:child_process';
import { open, stat } from 'node:fs/promises';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

const FFMPEG_PATH = ffmpegInstaller.path;
const MP4_PROBE_BYTES = 512 * 1024;
const FIXED_ONE = 65536;
export const STRONG_PORTRAIT_ASPECT_RATIO = 1.5;
/** 270° clockwise = 90° counter-clockwise (Veo portrait-encoded football clips). */
export const LANDSCAPE_FALLBACK_ROTATION: CanonicalRotation = 270;

export type VideoOrientation = 'landscape' | 'portrait';
export type CanonicalRotation = 0 | 90 | 180 | 270;

export interface VideoOrientationPlan {
  codedWidth: number;
  codedHeight: number;
  displayWidth: number;
  displayHeight: number;
  metadataRotation: CanonicalRotation;
  appliedRotation: CanonicalRotation;
  landscapeFallbackApplied: boolean;
  sideDataRotation: number | null;
  tagsRotation: number | null;
}

export function orientationFromSize(width: number, height: number): VideoOrientation {
  return width >= height ? 'landscape' : 'portrait';
}

export function normalizeDegrees(value: number): CanonicalRotation {
  const normalized = ((Math.round(value) % 360) + 360) % 360;
  if (normalized === 90) return 90;
  if (normalized === 180) return 180;
  if (normalized === 270) return 270;
  return 0;
}

export function isStrongPortraitFrame(width: number, height: number): boolean {
  return width > 0 && height / width > STRONG_PORTRAIT_ASPECT_RATIO;
}

export function displayDimensions(
  codedWidth: number,
  codedHeight: number,
  rotation: CanonicalRotation
): { displayWidth: number; displayHeight: number } {
  if (rotation === 90 || rotation === 270) {
    return { displayWidth: codedHeight, displayHeight: codedWidth };
  }
  return { displayWidth: codedWidth, displayHeight: codedHeight };
}

export function resolveAppliedRotation(
  metadataRotation: CanonicalRotation,
  codedWidth: number,
  codedHeight: number
): CanonicalRotation {
  if (metadataRotation !== 0) return metadataRotation;
  if (isStrongPortraitFrame(codedWidth, codedHeight)) return LANDSCAPE_FALLBACK_ROTATION;
  return 0;
}

export function mapNormalizedTapToPixels(
  normalizedX: number,
  normalizedY: number,
  frameWidth: number,
  frameHeight: number
): { x: number; y: number; clampedNormalizedX: number; clampedNormalizedY: number } {
  const clampedNormalizedX = Math.min(1, Math.max(0, normalizedX));
  const clampedNormalizedY = Math.min(1, Math.max(0, normalizedY));
  const x = Math.round(clampedNormalizedX * Math.max(1, frameWidth - 1));
  const y = Math.round(clampedNormalizedY * Math.max(1, frameHeight - 1));
  return {
    x: Math.min(frameWidth - 1, Math.max(0, x)),
    y: Math.min(frameHeight - 1, Math.max(0, y)),
    clampedNormalizedX,
    clampedNormalizedY,
  };
}

function clockwiseFromSideData(sideDataRotation: number): CanonicalRotation {
  return normalizeDegrees(-sideDataRotation);
}

function clockwiseFromTags(tagsRotation: number): CanonicalRotation {
  return normalizeDegrees(tagsRotation);
}

function parseStreamDimensions(stderr: string): { width: number; height: number } | null {
  const match = stderr.match(/Stream #\d+:\d+.*Video:.*\s(\d{2,5})x(\d{2,5})/);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!width || !height) return null;
  return { width, height };
}

function parseSideDataRotation(stderr: string): number | null {
  const match = stderr.match(/displaymatrix: rotation of (-?\d+(?:\.\d+)?)\s*degrees/i);
  if (!match) return null;
  return Math.round(Number(match[1]));
}

function parseTagsRotation(stderr: string): number | null {
  const match = stderr.match(/\brotate\s*:\s*(-?\d+)/i);
  if (!match) return null;
  return Math.round(Number(match[1]));
}

function readAtomType(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset + 4),
    view.getUint8(offset + 5),
    view.getUint8(offset + 6),
    view.getUint8(offset + 7)
  );
}

function readInt32BE(view: DataView, offset: number): number {
  return view.getInt32(offset, false);
}

function matrixToClockwiseRotation(a: number, b: number, c: number, d: number): CanonicalRotation {
  const scale = (value: number) => value / FIXED_ONE;
  const na = scale(a);
  const nb = scale(b);
  const nc = scale(c);
  const nd = scale(d);

  if (Math.abs(na) < 0.1 && nb > 0.5 && nc < -0.5 && Math.abs(nd) < 0.1) return 90;
  if (Math.abs(na) < 0.1 && nb < -0.5 && nc > 0.5 && Math.abs(nd) < 0.1) return 270;
  if (na < -0.5 && Math.abs(nb) < 0.1 && Math.abs(nc) < 0.1 && nd < -0.5) return 180;
  return 0;
}

function parseTkhdRotation(view: DataView, atomOffset: number): CanonicalRotation {
  const version = view.getUint8(atomOffset + 8);
  const matrixOffset = version === 0 ? atomOffset + 54 : atomOffset + 66;
  if (matrixOffset + 20 > view.byteLength) return 0;

  const a = readInt32BE(view, matrixOffset);
  const b = readInt32BE(view, matrixOffset + 4);
  const c = readInt32BE(view, matrixOffset + 12);
  const d = readInt32BE(view, matrixOffset + 16);
  return matrixToClockwiseRotation(a, b, c, d);
}

function findMoovOffset(view: DataView): number | null {
  let offset = 0;
  while (offset + 8 <= view.byteLength) {
    const size = readInt32BE(view, offset);
    if (size < 8) break;
    if (readAtomType(view, offset) === 'moov') return offset;
    offset += size;
  }
  return null;
}

function findVideoTrackRotation(view: DataView, moovOffset: number): CanonicalRotation {
  const moovSize = readInt32BE(view, moovOffset);
  const moovEnd = Math.min(view.byteLength, moovOffset + moovSize);
  let offset = moovOffset + 8;

  while (offset + 8 <= moovEnd) {
    const size = readInt32BE(view, offset);
    if (size < 8) break;

    if (readAtomType(view, offset) === 'trak') {
      const trakEnd = Math.min(view.byteLength, offset + size);
      let childOffset = offset + 8;

      while (childOffset + 8 <= trakEnd) {
        const childSize = readInt32BE(view, childOffset);
        if (childSize < 8) break;

        if (readAtomType(view, childOffset) === 'tkhd') {
          const rotation = parseTkhdRotation(view, childOffset);
          if (rotation !== 0) return rotation;
        }

        childOffset += childSize;
      }
    }

    offset += size;
  }

  return 0;
}

async function readProbeWindow(
  fileHandle: Awaited<ReturnType<typeof open>>,
  position: number,
  length: number
): Promise<Buffer> {
  const buffer = Buffer.alloc(length);
  const { bytesRead } = await fileHandle.read(buffer, 0, length, position);
  return buffer.subarray(0, bytesRead);
}

async function readMp4ProbeBuffer(videoPath: string): Promise<Buffer> {
  const fileHandle = await open(videoPath, 'r');
  try {
    const { size: fileSize } = await stat(videoPath);
    if (fileSize <= MP4_PROBE_BYTES) {
      return readProbeWindow(fileHandle, 0, fileSize);
    }

    const tail = await readProbeWindow(
      fileHandle,
      Math.max(0, fileSize - MP4_PROBE_BYTES),
      MP4_PROBE_BYTES
    );
    const tailView = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
    const moovInTail = findMoovOffset(tailView);
    if (moovInTail != null) {
      const tailRotation = findVideoTrackRotation(tailView, moovInTail);
      if (tailRotation !== 0) return tail;
    }

    return readProbeWindow(fileHandle, 0, MP4_PROBE_BYTES);
  } finally {
    await fileHandle.close();
  }
}

async function probeTkhdClockwiseRotation(videoPath: string): Promise<CanonicalRotation> {
  if (!videoPath.toLowerCase().endsWith('.mp4') && !videoPath.toLowerCase().endsWith('.mov')) {
    return 0;
  }

  try {
    const buffer = await readMp4ProbeBuffer(videoPath);
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const moovOffset = findMoovOffset(view);
    if (moovOffset == null) return 0;
    return findVideoTrackRotation(view, moovOffset);
  } catch {
    return 0;
  }
}

function runFfmpegProbe(videoPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_PATH, ['-hide_banner', '-i', videoPath]);
    const stderrChunks: Buffer[] = [];

    proc.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
    proc.on('error', reject);
    proc.on('close', () => resolve(Buffer.concat(stderrChunks).toString('utf8')));
  });
}

function resolveMetadataRotation(params: {
  sideDataRotation: number | null;
  tagsRotation: number | null;
  tkhdRotation: CanonicalRotation;
}): CanonicalRotation {
  if (params.sideDataRotation != null && params.sideDataRotation !== 0) {
    return clockwiseFromSideData(params.sideDataRotation);
  }
  if (params.tkhdRotation !== 0) return params.tkhdRotation;
  if (params.tagsRotation != null && params.tagsRotation !== 0) {
    return clockwiseFromTags(params.tagsRotation);
  }
  return 0;
}

/** Shared orientation plan for selection frames and analysis video normalization. */
export async function probeVideoOrientationPlan(videoPath: string): Promise<VideoOrientationPlan> {
  const [stderr, tkhdRotation] = await Promise.all([
    runFfmpegProbe(videoPath),
    probeTkhdClockwiseRotation(videoPath),
  ]);

  const dims = parseStreamDimensions(stderr);
  if (!dims) {
    throw new Error('Could not read coded video dimensions from ffmpeg probe');
  }

  const sideDataRotation = parseSideDataRotation(stderr);
  const tagsRotation = parseTagsRotation(stderr);
  const metadataRotation = resolveMetadataRotation({ sideDataRotation, tagsRotation, tkhdRotation });
  const appliedRotation = resolveAppliedRotation(metadataRotation, dims.width, dims.height);
  const landscapeFallbackApplied =
    metadataRotation === 0 && appliedRotation === LANDSCAPE_FALLBACK_ROTATION;
  const { displayWidth, displayHeight } = displayDimensions(
    dims.width,
    dims.height,
    appliedRotation
  );

  return {
    codedWidth: dims.width,
    codedHeight: dims.height,
    displayWidth,
    displayHeight,
    metadataRotation,
    appliedRotation,
    landscapeFallbackApplied,
    sideDataRotation,
    tagsRotation,
  };
}

export function rotationToFfmpegVideoFilter(rotation: CanonicalRotation): string | null {
  switch (rotation) {
    case 90:
      return 'transpose=1';
    case 180:
      return 'transpose=1,transpose=1';
    case 270:
      return 'transpose=2';
    default:
      return null;
  }
}
