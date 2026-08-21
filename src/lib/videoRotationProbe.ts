import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import type { VideoRotation } from '@/lib/videoViewportMapping';

const PROBE_BYTES = 512 * 1024;
const FIXED_ONE = 65536;

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

function matrixToRotation(a: number, b: number, c: number, d: number): VideoRotation {
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

function parseTkhdRotation(view: DataView, atomOffset: number): VideoRotation {
  const version = view.getUint8(atomOffset + 8);
  const matrixOffset = version === 0 ? atomOffset + 54 : atomOffset + 66;
  if (matrixOffset + 20 > view.byteLength) return 0;

  const a = readInt32BE(view, matrixOffset);
  const b = readInt32BE(view, matrixOffset + 4);
  const c = readInt32BE(view, matrixOffset + 12);
  const d = readInt32BE(view, matrixOffset + 16);
  return matrixToRotation(a, b, c, d);
}

function findMoovOffset(view: DataView): number | null {
  let offset = 0;
  while (offset + 8 <= view.byteLength) {
    const size = readInt32BE(view, offset);
    if (size < 8) break;

    const type = readAtomType(view, offset);
    if (type === 'moov') return offset;

    offset += size;
  }
  return null;
}

function findVideoTrackRotation(view: DataView, moovOffset: number): VideoRotation {
  const moovSize = readInt32BE(view, moovOffset);
  const moovEnd = Math.min(view.byteLength, moovOffset + moovSize);
  let offset = moovOffset + 8;

  while (offset + 8 <= moovEnd) {
    const size = readInt32BE(view, offset);
    if (size < 8) break;

    const type = readAtomType(view, offset);
    if (type === 'trak') {
      const trakEnd = Math.min(view.byteLength, offset + size);
      let childOffset = offset + 8;

      while (childOffset + 8 <= trakEnd) {
        const childSize = readInt32BE(view, childOffset);
        if (childSize < 8) break;

        const childType = readAtomType(view, childOffset);
        if (childType === 'tkhd') {
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

function parseRotationFromBuffer(buffer: ArrayBuffer): VideoRotation {
  const view = new DataView(buffer);
  const moovOffset = findMoovOffset(view);
  if (moovOffset == null) return 0;
  return findVideoTrackRotation(view, moovOffset);
}

async function readProbeWindow(uri: string, position: number, length: number): Promise<ArrayBuffer> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
    position,
    length,
  });

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function readProbeBytes(uri: string): Promise<ArrayBuffer | null> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    const fileSize = info.exists && !info.isDirectory ? info.size : 0;

    if (fileSize > PROBE_BYTES) {
      const tail = await readProbeWindow(uri, Math.max(0, fileSize - PROBE_BYTES), PROBE_BYTES);
      const tailRotation = parseRotationFromBuffer(tail);
      if (tailRotation !== 0) return tail;

      const head = await readProbeWindow(uri, 0, PROBE_BYTES);
      return head;
    }

    const file = new File(uri);
    return file.arrayBuffer();
  } catch {
    return null;
  }
}

/** Reads MP4 track display matrix rotation metadata (0/90/180/270). */
export async function probeMp4VideoRotation(uri: string): Promise<VideoRotation> {
  try {
    const buffer = await readProbeBytes(uri);
    if (!buffer) return 0;
    return parseRotationFromBuffer(buffer);
  } catch (error) {
    console.warn('[videoRotationProbe] Failed to read rotation metadata', {
      message: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}
