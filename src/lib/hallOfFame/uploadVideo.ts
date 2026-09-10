import { Platform } from 'react-native';
import { getSupabase } from '@/lib/supabase';
import { HALL_OF_FAME_BUCKET } from '@/lib/hallOfFame/supabaseMapper';

function extensionFromUri(uri: string): { ext: string; contentType: string } {
  const lower = uri.split('?')[0]?.toLowerCase() ?? '';
  if (lower.endsWith('.mov') || lower.includes('quicktime')) {
    return { ext: 'mov', contentType: 'video/quicktime' };
  }
  if (lower.endsWith('.m4v')) {
    return { ext: 'm4v', contentType: 'video/x-m4v' };
  }
  return { ext: 'mp4', contentType: 'video/mp4' };
}

/**
 * Upload a local clip to the public hall-of-fame bucket.
 * Path convention: `{userId}/{entryId}.{ext}`
 */
export async function uploadHallOfFameVideo(params: {
  userId: string;
  entryId: string;
  localUri: string;
}): Promise<{ path: string }> {
  const { userId, entryId, localUri } = params;
  const { ext, contentType } = extensionFromUri(localUri);
  const path = `${userId}/${entryId}.${ext}`;
  const supabase = getSupabase();

  const fileRes = await fetch(localUri);
  if (!fileRes.ok) {
    throw new Error(`Could not read video for Hall of Fame upload (${fileRes.status})`);
  }
  const blob = await fileRes.blob();

  // RN may return empty-type blobs; pass explicit contentType.
  const body =
    Platform.OS !== 'web' && (!blob.type || blob.type === 'application/octet-stream')
      ? blob
      : blob;

  const { error } = await supabase.storage.from(HALL_OF_FAME_BUCKET).upload(path, body, {
    contentType,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message || 'Hall of Fame video upload failed');
  }

  return { path };
}
