import * as ImagePicker from 'expo-image-picker';
import { Alert, InteractionManager, Linking, Platform } from 'react-native';
import { MAX_CLIP_DURATION_MS, MIN_CLIP_DURATION_MS } from '@/lib/constants';
import type { ClipMetadata } from '@/types/analysis';

export type PickVideoResult =
  | { ok: true; clip: ClipMetadata }
  | {
      ok: false;
      reason:
        | 'cancelled'
        | 'permission_denied'
        | 'too_short'
        | 'too_long'
        | 'invalid'
        | 'icloud_not_downloaded'
        | 'error';
      message?: string;
    };

const ICLOUD_NOT_DOWNLOADED_MESSAGE =
  'This video is stored in iCloud and has not finished downloading. Open it in Photos, wait for it to download fully, then try again.';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

function isICloudNotDownloadedError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return message.includes('PHPhotosErrorDomain error 3164') || message.includes('error 3164.');
}

export function getICloudNotDownloadedMessage(): string {
  return ICLOUD_NOT_DOWNLOADED_MESSAGE;
}

function normalizeDurationMs(duration: number | null | undefined): number {
  if (duration == null) return 0;
  // expo-image-picker reports duration in milliseconds on iOS/Android.
  if (duration > 1000) return duration;
  return duration * 1000;
}

function hasMediaLibraryAccess(
  permission: ImagePicker.MediaLibraryPermissionResponse
): boolean {
  if (permission.granted) return true;
  // iOS limited library access still allows picking via PHPicker.
  return permission.accessPrivileges === 'limited' || permission.accessPrivileges === 'all';
}

async function ensureMediaLibraryPermission(): Promise<ImagePicker.MediaLibraryPermissionResponse> {
  const existing = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (hasMediaLibraryAccess(existing)) {
    return existing;
  }
  return ImagePicker.requestMediaLibraryPermissionsAsync();
}

function waitForInteractions(): Promise<void> {
  return new Promise((resolve) => {
    InteractionManager.runAfterInteractions(() => resolve());
  });
}

function logPickerError(phase: string, error: unknown): void {
  if (error instanceof Error) {
    console.error(`[videoPicker] ${phase}:`, error.message);
    console.error(error.stack);
    return;
  }
  console.error(`[videoPicker] ${phase}:`, error);
}

export async function pickVideoFromLibrary(): Promise<PickVideoResult> {
  try {
    const permission = await ensureMediaLibraryPermission();

    if (!hasMediaLibraryAccess(permission)) {
      Alert.alert(
        'Permission needed',
        'Coach AI needs access to your photo library to select a clip for analysis.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => {
              if (Platform.OS === 'ios') Linking.openSettings();
            },
          },
        ]
      );
      return { ok: false, reason: 'permission_denied' };
    }

    // Ensure the current screen is fully presented before opening PHPicker.
    await waitForInteractions();

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      allowsMultipleSelection: false,
      selectionLimit: 1,
    });

    if (result.canceled || !result.assets?.[0]) {
      return { ok: false, reason: 'cancelled' };
    }

    const asset = result.assets[0];

    if (asset.type && asset.type !== 'video') {
      Alert.alert('Video only', 'Please choose a video clip, not a photo.');
      return { ok: false, reason: 'invalid' };
    }

    const durationMs = normalizeDurationMs(asset.duration);

    if (durationMs > 0 && durationMs < MIN_CLIP_DURATION_MS) {
      Alert.alert(
        'Clip too short',
        'Please choose a clip between 10 seconds and 5 minutes long.'
      );
      return { ok: false, reason: 'too_short' };
    }

    if (durationMs > MAX_CLIP_DURATION_MS) {
      Alert.alert(
        'Clip too long',
        'Please choose a clip between 10 seconds and 5 minutes long.'
      );
      return { ok: false, reason: 'too_long' };
    }

    if (!asset.uri) {
      return { ok: false, reason: 'invalid' };
    }

    return {
      ok: true,
      clip: {
        uri: asset.uri,
        durationMs: durationMs || 0,
        fileName: asset.fileName ?? null,
        fileSizeBytes: asset.fileSize ?? null,
      },
    };
  } catch (error) {
    logPickerError('pickVideoFromLibrary failed', error);

    if (isICloudNotDownloadedError(error)) {
      return { ok: false, reason: 'icloud_not_downloaded' };
    }

    const message =
      error instanceof Error ? error.message : 'Something went wrong opening your photo library.';

    Alert.alert('Could not open library', message);
    return { ok: false, reason: 'error', message };
  }
}
