import fs from 'node:fs/promises';
import path from 'node:path';
import type { PlayerSelection } from '../types.js';
import type { ExtractedFrame } from './types.js';
import type { TapMatchCandidate } from './identityMatcher.js';

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export interface TapCoordinateAudit {
  displayedViewWidth: number;
  displayedViewHeight: number;
  sourceVideoWidth: number;
  sourceVideoHeight: number;
  canonicalWidth: number;
  canonicalHeight: number;
  extractedFrameWidth: number;
  extractedFrameHeight: number;
  renderedVideoRect: {
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
  };
  rawTapX: number;
  rawTapY: number;
  mappedNormalizedX: number;
  mappedNormalizedY: number;
  aspectMismatchCorrected: boolean;
  coordinatePassThrough: boolean;
  displayAspect: number;
  frameAspect: number;
  clientVideoAspect: number;
}

/** Client tap is normalized within visible video content — pass through when aspects align. */
export function mapClientTapToFrameNormalized(
  selection: PlayerSelection,
  frameWidth: number,
  frameHeight: number
): TapCoordinateAudit {
  const rawTapX = selection.normalizedX;
  const rawTapY = selection.normalizedY;

  const canonicalWidth = frameWidth;
  const canonicalHeight = frameHeight;
  const frameAspect = canonicalWidth / Math.max(1, canonicalHeight);

  const displayedViewWidth = selection.displayWidth;
  const displayedViewHeight = selection.displayHeight;
  const displayAspect = displayedViewWidth / Math.max(1, displayedViewHeight);

  const sourceVideoWidth = selection.videoWidth ?? canonicalWidth;
  const sourceVideoHeight = selection.videoHeight ?? canonicalHeight;
  const clientVideoAspect = sourceVideoWidth / Math.max(1, sourceVideoHeight);

  const renderedVideoRect = {
    offsetX: 0,
    offsetY: 0,
    width: displayedViewWidth,
    height: displayedViewHeight,
  };

  const displayMatchesFrame = Math.abs(displayAspect - frameAspect) < 0.06;
  const clientMatchesFrame = Math.abs(clientVideoAspect - frameAspect) < 0.06;

  if (!displayMatchesFrame && !clientMatchesFrame) {
    console.warn('[TapCoordinateAudit] Aspect mismatch — pass-through (no rotation)', {
      displayAspect,
      frameAspect,
      clientVideoAspect,
    });
  }

  return {
    displayedViewWidth,
    displayedViewHeight,
    sourceVideoWidth,
    sourceVideoHeight,
    canonicalWidth,
    canonicalHeight,
    extractedFrameWidth: frameWidth,
    extractedFrameHeight: frameHeight,
    renderedVideoRect,
    rawTapX,
    rawTapY,
    mappedNormalizedX: clamp01(rawTapX),
    mappedNormalizedY: clamp01(rawTapY),
    aspectMismatchCorrected: false,
    coordinatePassThrough: true,
    displayAspect,
    frameAspect,
    clientVideoAspect,
  };
}

export async function saveTapDebugFrame(params: {
  frame: ExtractedFrame;
  audit: TapCoordinateAudit;
  candidates?: TapMatchCandidate[];
  jobId?: string;
  outputDir?: string;
}): Promise<string | null> {
  const { frame, audit, candidates = [], jobId, outputDir } = params;

  try {
    const sharp = (await import('sharp')).default;
    const tapPx = Math.round(audit.mappedNormalizedX * Math.max(1, frame.width - 1));
    const tapPy = Math.round(audit.mappedNormalizedY * Math.max(1, frame.height - 1));
    const radius = Math.max(8, Math.round(Math.min(frame.width, frame.height) * 0.02));

    const boxElements: string[] = [];
    for (const c of candidates) {
      const x = Math.round(c.box.x * frame.width);
      const y = Math.round(c.box.y * frame.height);
      const w = Math.round(c.box.width * frame.width);
      const h = Math.round(c.box.height * frame.height);
      const color = c.containsTap || c.nearTap ? '#00ff00' : '#ff6600';
      boxElements.push(
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${color}" stroke-width="2"/>`,
        `<text x="${x + 4}" y="${Math.max(12, y - 4)}" fill="${color}" font-size="14" font-family="monospace">${c.trackId}</text>`
      );
    }

    const overlaySvg = Buffer.from(
      `<svg width="${frame.width}" height="${frame.height}">
        ${boxElements.join('\n')}
        <circle cx="${tapPx}" cy="${tapPy}" r="${radius}" fill="none" stroke="lime" stroke-width="3"/>
        <line x1="${tapPx - radius}" y1="${tapPy}" x2="${tapPx + radius}" y2="${tapPy}" stroke="lime" stroke-width="2"/>
        <line x1="${tapPx}" y1="${tapPy - radius}" x2="${tapPx}" y2="${tapPy + radius}" stroke="lime" stroke-width="2"/>
      </svg>`
    );

    const dir = outputDir ?? path.join(process.cwd(), '.tracking-debug');
    await fs.mkdir(dir, { recursive: true });
    const fileName = `tap-debug-${jobId ?? 'job'}-${frame.timestampMs}.jpg`;
    const outPath = path.join(dir, fileName);

    await sharp(frame.jpeg)
      .composite([{ input: overlaySvg, top: 0, left: 0 }])
      .jpeg({ quality: 85 })
      .toFile(outPath);

    console.log('[TapCoordinateAudit] Debug frame saved', {
      outPath,
      tapPx,
      tapPy,
      candidateCount: candidates.length,
    });
    return outPath;
  } catch (error) {
    console.warn('[TapCoordinateAudit] Failed to save debug frame', {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export function logTapCoordinateAudit(audit: TapCoordinateAudit, jobId?: string): void {
  console.log('[TapCoordinateAudit]', { jobId, ...audit });
}
