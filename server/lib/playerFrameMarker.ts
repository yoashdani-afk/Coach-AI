import { spawn } from 'node:child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import sharp from 'sharp';
import {
  frameMatchesDisplayGeometry,
  mapTapToFramePixels,
} from './markerCoordinates.js';
import type { PlayerSelection } from './types.js';
import { getFocusTimestampSec } from './videoWindow.js';
import { probeVideoGeometry, type VideoGeometry } from './videoProbe.js';

const FFMPEG_PATH = ffmpegInstaller.path;

export interface PlayerGroundingFramesResult {
  success: boolean;
  cleanFrameBase64?: string;
  markedFrameBase64?: string;
  /** Zoomed crop around the player — no marker. */
  cleanCropBase64?: string;
  /** Optional nearby-time crops for re-identification. */
  nearbyCropBase64?: string[];
  /** Crops from each user identity reference (primary/secondary/tertiary). */
  identityReferenceCropsBase64?: string[];
  mimeType: 'image/jpeg';
  frameWidth?: number;
  frameHeight?: number;
  markerPixelX?: number;
  markerPixelY?: number;
  clampedNormalizedX?: number;
  clampedNormalizedY?: number;
  timestampMs: number;
  tapNormalizedX: number;
  tapNormalizedY: number;
  geometry?: VideoGeometry;
  frameIsDisplayOriented?: boolean;
  error?: string;
}

function runFfmpegExtractFrame(videoPath: string, timestampSec: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const args = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-ss',
      timestampSec.toFixed(3),
      '-i',
      videoPath,
      '-frames:v',
      '1',
      '-f',
      'image2pipe',
      '-vcodec',
      'png',
      'pipe:1',
    ];

    const chunks: Buffer[] = [];
    const stderr: Buffer[] = [];
    const proc = spawn(FFMPEG_PATH, args);

    proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));

    proc.on('error', (error) => reject(error));
    proc.on('close', (code) => {
      if (code === 0 && chunks.length > 0) {
        resolve(Buffer.concat(chunks));
        return;
      }
      reject(
        new Error(
          `ffmpeg frame extraction failed (code ${code ?? 'unknown'}): ${Buffer.concat(stderr).toString('utf8').trim()}`
        )
      );
    });
  });
}

/** Corner bracket + arrow pointing at player — marker offset so kit/body stays visible. */
function buildCornerMarkerSvg(
  width: number,
  height: number,
  pixelX: number,
  pixelY: number
): string {
  const stroke = Math.max(4, Math.round(Math.min(width, height) * 0.005));
  const bracket = Math.min(width, height) * 0.055;
  const dotR = Math.max(3, stroke * 0.8);

  const anchorX = pixelX;
  const anchorY = pixelY;
  const bracketX = Math.min(width - bracket * 2, anchorX + bracket * 0.6);
  const bracketY = Math.max(bracket * 2, anchorY - bracket * 2.2);
  const bx = bracketX - bracket;
  const by = bracketY - bracket;

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
      <polygon points="0,0 10,5 0,10" fill="#00FF66"/>
    </marker>
  </defs>
  <path d="M ${bx} ${by + bracket} L ${bx} ${by} L ${bx + bracket} ${by}"
    fill="none" stroke="#00FF66" stroke-width="${stroke}" stroke-linecap="round"/>
  <line x1="${bracketX}" y1="${bracketY}" x2="${anchorX}" y2="${anchorY - dotR * 2}"
    stroke="#00FF66" stroke-width="${stroke}" marker-end="url(#arrowhead)"/>
  <circle cx="${anchorX}" cy="${anchorY}" r="${dotR}" fill="#00FF66" opacity="0.95"/>
</svg>`;
}

async function encodeJpeg(rawFrame: Buffer): Promise<Buffer> {
  return sharp(rawFrame).jpeg({ quality: 90 }).toBuffer();
}

async function extractCropAroundPlayer(
  rawFrame: Buffer,
  frameWidth: number,
  frameHeight: number,
  pixelX: number,
  pixelY: number
): Promise<Buffer> {
  const cropSize = Math.round(Math.min(frameWidth, frameHeight) * 0.28);
  const left = Math.max(0, Math.min(frameWidth - cropSize, pixelX - Math.round(cropSize / 2)));
  const top = Math.max(0, Math.min(frameHeight - cropSize, pixelY - Math.round(cropSize / 2)));

  return sharp(rawFrame)
    .extract({ left, top, width: cropSize, height: cropSize })
    .jpeg({ quality: 92 })
    .toBuffer();
}

async function extractReferenceCropAt(
  videoPath: string,
  playerSelection: PlayerSelection,
  referenceTimestampMs: number,
  normalizedX: number,
  normalizedY: number,
  geometry: VideoGeometry
): Promise<string | null> {
  const timestampSec = Math.max(0, referenceTimestampMs / 1000);
  try {
    const rawFrame = await runFfmpegExtractFrame(videoPath, timestampSec);
    const meta = await sharp(rawFrame).metadata();
    if (!meta.width || !meta.height) return null;

    const frameIsDisplayOriented = frameMatchesDisplayGeometry(
      meta.width,
      meta.height,
      geometry
    );

    const marker = mapTapToFramePixels({
      playerSelection: {
        ...playerSelection,
        normalizedX,
        normalizedY,
        timestampMs: referenceTimestampMs,
      },
      frameWidth: meta.width,
      frameHeight: meta.height,
      geometry,
      frameIsDisplayOriented,
    });

    const crop = await extractCropAroundPlayer(
      rawFrame,
      meta.width,
      meta.height,
      marker.x,
      marker.y
    );
    return crop.toString('base64');
  } catch {
    return null;
  }
}

export async function extractPlayerGroundingFrames(
  videoPath: string,
  playerSelection: PlayerSelection,
  clipDurationMs: number
): Promise<PlayerGroundingFramesResult> {
  const timestampSec = getFocusTimestampSec(playerSelection, clipDurationMs);
  const clipDurationSec = Math.max(0.1, clipDurationMs / 1000);
  const base: PlayerGroundingFramesResult = {
    success: false,
    mimeType: 'image/jpeg',
    timestampMs: Math.round(timestampSec * 1000),
    tapNormalizedX: playerSelection.normalizedX,
    tapNormalizedY: playerSelection.normalizedY,
  };

  try {
    const geometry = await probeVideoGeometry(videoPath);
    const rawFrame = await runFfmpegExtractFrame(videoPath, timestampSec);
    const meta = await sharp(rawFrame).metadata();
    const frameWidth = meta.width;
    const frameHeight = meta.height;

    if (!frameWidth || !frameHeight) {
      return { ...base, geometry, error: 'Could not read extracted frame dimensions' };
    }

    const frameIsDisplayOriented = frameMatchesDisplayGeometry(
      frameWidth,
      frameHeight,
      geometry
    );

    const marker = mapTapToFramePixels({
      playerSelection,
      frameWidth,
      frameHeight,
      geometry,
      frameIsDisplayOriented,
    });

    const cleanJpeg = await encodeJpeg(rawFrame);
    const cleanCropJpeg = await extractCropAroundPlayer(
      rawFrame,
      frameWidth,
      frameHeight,
      marker.x,
      marker.y
    );

    const markerSvg = Buffer.from(
      buildCornerMarkerSvg(frameWidth, frameHeight, marker.x, marker.y)
    );

    const markedJpeg = await sharp(rawFrame)
      .composite([{ input: markerSvg, top: 0, left: 0 }])
      .jpeg({ quality: 90 })
      .toBuffer();

    const nearbyOffsets = [-0.5, 0.5];
    const nearbyCropBase64: string[] = [];

    for (const offsetSec of nearbyOffsets) {
      const nearbySec = Math.min(
        clipDurationSec,
        Math.max(0, timestampSec + offsetSec)
      );
      if (Math.abs(nearbySec - timestampSec) < 0.05) continue;

      try {
        const nearbyFrame = await runFfmpegExtractFrame(videoPath, nearbySec);
        const nearbyMeta = await sharp(nearbyFrame).metadata();
        if (!nearbyMeta.width || !nearbyMeta.height) continue;

        const nearbyMarker = mapTapToFramePixels({
          playerSelection: {
            ...playerSelection,
            timestampMs: Math.round(nearbySec * 1000),
          },
          frameWidth: nearbyMeta.width,
          frameHeight: nearbyMeta.height,
          geometry,
          frameIsDisplayOriented: frameMatchesDisplayGeometry(
            nearbyMeta.width,
            nearbyMeta.height,
            geometry
          ),
        });

        const nearbyCrop = await extractCropAroundPlayer(
          nearbyFrame,
          nearbyMeta.width,
          nearbyMeta.height,
          nearbyMarker.x,
          nearbyMarker.y
        );
        nearbyCropBase64.push(nearbyCrop.toString('base64'));
      } catch {
        // Best-effort nearby frames
      }
    }

    const identityReferenceCropsBase64: string[] = [];
    const references =
      playerSelection.identityProfile?.references ??
      [
        {
          normalizedX: playerSelection.normalizedX,
          normalizedY: playerSelection.normalizedY,
          timestampMs: playerSelection.timestampMs,
          label: 'primary' as const,
        },
      ];

    for (const ref of references) {
      const crop = await extractReferenceCropAt(
        videoPath,
        playerSelection,
        ref.timestampMs,
        ref.normalizedX,
        ref.normalizedY,
        geometry
      );
      if (crop) identityReferenceCropsBase64.push(crop);
    }

    return {
      ...base,
      success: true,
      cleanFrameBase64: cleanJpeg.toString('base64'),
      markedFrameBase64: markedJpeg.toString('base64'),
      cleanCropBase64: cleanCropJpeg.toString('base64'),
      nearbyCropBase64,
      identityReferenceCropsBase64,
      frameWidth,
      frameHeight,
      markerPixelX: marker.x,
      markerPixelY: marker.y,
      clampedNormalizedX: marker.clampedNormalizedX,
      clampedNormalizedY: marker.clampedNormalizedY,
      geometry,
      frameIsDisplayOriented,
    };
  } catch (error) {
    return {
      ...base,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function logPlayerGroundingExtraction(
  playerSelection: PlayerSelection,
  result: PlayerGroundingFramesResult
): void {
  console.log('[Grounding] Frame extraction', {
    tapTimestampMs: playerSelection.timestampMs,
    tapNormalizedX: playerSelection.normalizedX,
    tapNormalizedY: playerSelection.normalizedY,
    trackingQualityWarning: playerSelection.trackingQualityWarning ?? false,
    reducedTrackingConfidence: playerSelection.reducedTrackingConfidence ?? false,
    extractionSuccess: result.success,
    extractedFrameWidth: result.frameWidth,
    extractedFrameHeight: result.frameHeight,
    markerPixelX: result.markerPixelX,
    markerPixelY: result.markerPixelY,
    hasCleanCrop: Boolean(result.cleanCropBase64),
    nearbyCropCount: result.nearbyCropBase64?.length ?? 0,
    identityReferenceCropCount: result.identityReferenceCropsBase64?.length ?? 0,
    extractionError: result.error,
  });
}

/** @deprecated */
export type MarkedPlayerFrameResult = PlayerGroundingFramesResult;
/** @deprecated */
export const extractMarkedPlayerFrame = extractPlayerGroundingFrames;
/** @deprecated */
export const logMarkedFrameAttempt = logPlayerGroundingExtraction;
