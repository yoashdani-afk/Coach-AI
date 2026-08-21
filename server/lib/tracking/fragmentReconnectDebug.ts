import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import type { ExtractedFrame, ObjectTrack } from './types.js';
import type { ReconnectionReport } from './trackFragmentReconnect.js';

const THUMB_W = 240;
const THUMB_H = 136;
const CAPTION_H = 18;
const HEADER_H = 18;
const COLS = 6;

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function boxToPx(
  box: { x: number; y: number; width: number; height: number },
  w: number,
  h: number
) {
  return {
    left: Math.round(box.x * w),
    top: Math.round(box.y * h),
    width: Math.max(1, Math.round(box.width * w)),
    height: Math.max(1, Math.round(box.height * h)),
  };
}

function svgOverlay(
  frameW: number,
  frameH: number,
  boxes: Array<{ box: { x: number; y: number; width: number; height: number }; label: string; color: string; strokeWidth: number }>
): Buffer {
  const rects = boxes
    .map(({ box, label, color, strokeWidth }) => {
      const px = boxToPx(box, frameW, frameH);
      return `
        <rect x="${px.left}" y="${px.top}" width="${px.width}" height="${px.height}"
          fill="none" stroke="${color}" stroke-width="${strokeWidth}"/>
        <text x="${px.left + 2}" y="${Math.max(12, px.top - 4)}" fill="${color}"
          font-size="11" font-family="monospace">${escapeXml(label)}</text>`;
    })
    .join('\n');

  const svg = `<svg width="${frameW}" height="${frameH}" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
  return Buffer.from(svg);
}

async function bufferDimensions(input: Buffer): Promise<{ width: number; height: number }> {
  const meta = await sharp(input).metadata();
  return {
    width: meta.width ?? 0,
    height: meta.height ?? 0,
  };
}

function logComposite(params: {
  baseWidth: number;
  baseHeight: number;
  overlayWidth: number;
  overlayHeight: number;
  overlayIndex: number;
  operation: string;
  left?: number;
  top?: number;
}) {
  console.log('[FragmentReconnectDebug] Composite', params);
}

/** Resize overlay so it never exceeds the base image bounds. */
async function fitOverlayToBase(
  overlay: Buffer,
  maxWidth: number,
  maxHeight: number
): Promise<Buffer> {
  if (maxWidth <= 0 || maxHeight <= 0) {
    return sharp({ create: { width: 1, height: 1, channels: 4, background: '#00000000' } })
      .png()
      .toBuffer();
  }

  const { width: overlayWidth, height: overlayHeight } = await bufferDimensions(overlay);
  if (overlayWidth <= maxWidth && overlayHeight <= maxHeight) {
    return overlay;
  }

  return sharp(overlay)
    .resize(maxWidth, maxHeight, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
}

/** Rasterize SVG to exact pixel dimensions for safe compositing. */
async function rasterizeSvg(svg: Buffer, width: number, height: number): Promise<Buffer> {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  return sharp(svg).resize(w, h, { fit: 'fill' }).png().toBuffer();
}

async function compositeOntoBase(
  base: Buffer,
  overlay: Buffer,
  left: number,
  top: number,
  overlayIndex: number,
  operation: string
): Promise<Buffer> {
  const baseDims = await bufferDimensions(base);
  const fitted = await fitOverlayToBase(overlay, baseDims.width - left, baseDims.height - top);
  const overlayDims = await bufferDimensions(fitted);

  logComposite({
    baseWidth: baseDims.width,
    baseHeight: baseDims.height,
    overlayWidth: overlayDims.width,
    overlayHeight: overlayDims.height,
    overlayIndex,
    operation,
    left,
    top,
  });

  if (left + overlayDims.width > baseDims.width || top + overlayDims.height > baseDims.height) {
    throw new Error(
      `Overlay exceeds base bounds: base=${baseDims.width}x${baseDims.height} overlay=${overlayDims.width}x${overlayDims.height} at (${left},${top})`
    );
  }

  return sharp(base)
    .composite([{ input: fitted, top, left }])
    .jpeg()
    .toBuffer();
}

async function buildThumb(frame: ExtractedFrame, boxes: Parameters<typeof svgOverlay>[2]): Promise<Buffer> {
  const baseMeta = await sharp(frame.jpeg).metadata();
  const baseW = baseMeta.width ?? frame.width;
  const baseH = baseMeta.height ?? frame.height;

  const overlaySvg = svgOverlay(baseW, baseH, boxes);
  const overlay = await rasterizeSvg(overlaySvg, baseW, baseH);

  logComposite({
    baseWidth: baseW,
    baseHeight: baseH,
    overlayWidth: baseW,
    overlayHeight: baseH,
    overlayIndex: 0,
    operation: 'frame_annotation',
  });

  const annotated = await sharp(frame.jpeg)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg()
    .toBuffer();

  return sharp(annotated)
    .resize(THUMB_W, THUMB_H, { fit: 'cover', position: 'centre' })
    .jpeg()
    .toBuffer();
}

/** Render a contact sheet showing detections, anchor track, and accepted/rejected fragments. */
export async function writeFragmentReconnectDebugSheet(params: {
  jobId: string;
  frames: ExtractedFrame[];
  allTracks: ObjectTrack[];
  anchorTrackId: string;
  report: ReconnectionReport;
  outputDir?: string;
}): Promise<string | null> {
  const { jobId, frames, allTracks, anchorTrackId, report } = params;
  const outDir = params.outputDir ?? path.join(process.cwd(), '.tracking-debug');
  await fs.mkdir(outDir, { recursive: true });

  const jsonPath = path.join(outDir, `fragment-reconnect-${jobId}.json`);
  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));

  const acceptedIds = new Set(report.mergedTrackIds.filter((id) => id !== anchorTrackId));
  const rejectedIds = new Set(
    report.candidateEvaluations.filter((e) => !e.accepted).map((e) => e.candidateTrackId)
  );

  const step = Math.max(1, Math.floor(frames.length / 24));
  const pickedFrames = frames.filter((_, i) => i % step === 0);

  const thumbs: Buffer[] = [];
  for (const frame of pickedFrames) {
    const boxes: Array<{
      box: { x: number; y: number; width: number; height: number };
      label: string;
      color: string;
      strokeWidth: number;
    }> = [];

    for (const track of allTracks) {
      const sample = track.samples.find((s) => s.timestampMs === frame.timestampMs);
      if (!sample || sample.state === 'LOST') continue;

      let color = '#888888';
      let label = track.trackId;
      let strokeWidth = 1;

      if (track.trackId === anchorTrackId) {
        color = '#00ff00';
        label = `${track.trackId} (anchor)`;
        strokeWidth = 3;
      } else if (acceptedIds.has(track.trackId)) {
        color = '#00aaff';
        label = `${track.trackId} (merged)`;
        strokeWidth = 2;
      } else if (rejectedIds.has(track.trackId)) {
        color = '#ff4444';
        label = `${track.trackId} (rejected)`;
        strokeWidth = 1;
      }

      boxes.push({ box: sample.box, label, color, strokeWidth });
    }

    thumbs.push(await buildThumb(frame, boxes));
  }

  const rows = Math.max(1, Math.ceil(thumbs.length / COLS));
  const sheetW = COLS * THUMB_W;
  const rowStride = THUMB_H + CAPTION_H;
  const sheetH = HEADER_H + rows * rowStride;

  const canvas = await sharp({
    create: {
      width: sheetW,
      height: sheetH,
      channels: 3,
      background: '#111111',
    },
  })
    .jpeg()
    .toBuffer();

  const headerSvg = Buffer.from(
    `<svg width="${sheetW}" height="${HEADER_H}" xmlns="http://www.w3.org/2000/svg">
      <text x="4" y="14" fill="#fff" font-size="12" font-family="monospace">
        Fragment reconnect — anchor=${anchorTrackId} merged=[${report.mergedTrackIds.join(',')}] coverage=${report.mergedCoverageRatio.toFixed(3)}
      </text>
    </svg>`
  );
  const headerPng = await rasterizeSvg(headerSvg, sheetW, HEADER_H);

  let sheet = await compositeOntoBase(canvas, headerPng, 0, 0, 0, 'contact_sheet_header');

  let overlayIndex = 1;
  for (let i = 0; i < thumbs.length; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const ts = pickedFrames[i]!.timestampMs;

    const tileLeft = col * THUMB_W;
    const tileTop = HEADER_H + row * rowStride;

    if (tileLeft + THUMB_W > sheetW || tileTop + THUMB_H > sheetH) {
      console.warn('[FragmentReconnectDebug] Skipping tile outside canvas', {
        tileLeft,
        tileTop,
        sheetW,
        sheetH,
      });
      continue;
    }

    const tile = await sharp(thumbs[i]!)
      .resize(THUMB_W, THUMB_H, { fit: 'cover', position: 'centre' })
      .jpeg()
      .toBuffer();

    sheet = await compositeOntoBase(sheet, tile, tileLeft, tileTop, overlayIndex++, 'contact_sheet_tile');

    const captionSvg = Buffer.from(
      `<svg width="${THUMB_W}" height="${CAPTION_H}" xmlns="http://www.w3.org/2000/svg">
        <text x="2" y="13" fill="#ccc" font-size="10" font-family="monospace">${(ts / 1000).toFixed(1)}s</text>
      </svg>`
    );
    const captionPng = await rasterizeSvg(captionSvg, THUMB_W, CAPTION_H);
    const captionTop = tileTop + THUMB_H;

    if (tileLeft + THUMB_W <= sheetW && captionTop + CAPTION_H <= sheetH) {
      sheet = await compositeOntoBase(
        sheet,
        captionPng,
        tileLeft,
        captionTop,
        overlayIndex++,
        'contact_sheet_caption'
      );
    }
  }

  const outPath = path.join(outDir, `fragment-reconnect-${jobId}.jpg`);
  await fs.writeFile(outPath, sheet);

  console.log('[FragmentReconnect] Debug sheet written', { outPath, jsonPath });
  return outPath;
}

/** Safe wrapper — never throws; returns path or null. */
export async function generateFragmentReconnectDebug(params: {
  jobId: string;
  frames: ExtractedFrame[];
  allTracks: ObjectTrack[];
  anchorTrackId: string;
  report: ReconnectionReport;
  outputDir?: string;
}): Promise<string | null> {
  return writeFragmentReconnectDebugSheet(params);
}
