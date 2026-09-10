import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as FileSystem from 'expo-file-system/legacy';

interface VideoPreviewProps {
  uri: string;
  className?: string;
}

function ClipUnavailable({ message }: { message: string }) {
  return (
    <View className="w-full overflow-hidden rounded-xl bg-surface-elevated border border-border items-center justify-center px-6 py-10 gap-3" style={{ aspectRatio: 16 / 9 }}>
      <View className="w-12 h-12 rounded-2xl bg-surface items-center justify-center">
        <Ionicons name="videocam-off-outline" size={24} color="#6B6B73" />
      </View>
      <Text className="text-text-primary font-medium text-center">Clip unavailable</Text>
      <Text className="text-text-secondary text-sm text-center leading-5">{message}</Text>
    </View>
  );
}

/**
 * Web: picker URIs are typically blob:/http(s). file:// is not usable in the browser.
 * Native: file/content/ph URIs are fine if the underlying asset still exists.
 */
function isUriSchemeSupported(uri: string): boolean {
  if (!uri.trim()) return false;
  if (Platform.OS === 'web') {
    return (
      uri.startsWith('blob:') ||
      uri.startsWith('http://') ||
      uri.startsWith('https://') ||
      uri.startsWith('data:')
    );
  }
  return true;
}

async function probeUriExists(uri: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    // blob:/data: are in-memory handles — a full fetch would duplicate the whole file.
    // Revoked blob URLs fail when expo-video loads; we surface that via statusChange.
    if (uri.startsWith('blob:') || uri.startsWith('data:')) {
      return true;
    }
    try {
      const head = await fetch(uri, { method: 'HEAD' });
      if (head.ok) return true;
      const ranged = await fetch(uri, { headers: { Range: 'bytes=0-0' } });
      return ranged.ok || ranged.status === 206;
    } catch {
      return false;
    }
  }

  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists;
  } catch {
    // Some schemes (e.g. content:// / ph://) may throw even when expo-video can play them.
    return true;
  }
}

function VideoPreviewPlayer({
  uri,
  className = '',
}: {
  uri: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = false;
  });

  useEffect(() => {
    setFailed(false);
    const sub = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'error' || error) {
        setFailed(true);
      }
    });
    return () => {
      sub.remove();
      player.pause();
    };
  }, [player, uri]);

  if (failed) {
    return (
      <ClipUnavailable message="This clip can no longer be loaded. The original file may have been removed or the temporary link expired." />
    );
  }

  return (
    <View
      className={`overflow-hidden rounded-xl bg-surface border border-border ${className}`}
      style={{ width: '100%', aspectRatio: 16 / 9 }}
    >
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%' }}
        contentFit="contain"
        nativeControls
        // Web only — avoids CORS audio issues for remote http(s) sources; harmless for blob:.
        {...(Platform.OS === 'web' ? { crossOrigin: 'anonymous' as const } : null)}
      />
    </View>
  );
}

/**
 * Report / analysis clip player. Unused elsewhere historically; sized for report detail.
 * Native path uses expo-video unchanged. Web rejects unsupported schemes and probes URI liveness.
 */
export function VideoPreview({ uri, className = '' }: VideoPreviewProps) {
  const [phase, setPhase] = useState<'checking' | 'ready' | 'unavailable'>('checking');
  const [message, setMessage] = useState(
    'The original video file is no longer accessible on this device.'
  );

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!uri?.trim()) {
        if (!cancelled) {
          setMessage('This report has no clip attached.');
          setPhase('unavailable');
        }
        return;
      }

      if (!isUriSchemeSupported(uri)) {
        if (!cancelled) {
          setMessage(
            Platform.OS === 'web'
              ? 'This clip uses a local file path that browsers cannot play. Re-upload the clip on this device to watch it here.'
              : 'This clip URI is not supported for playback.'
          );
          setPhase('unavailable');
        }
        return;
      }

      const exists = await probeUriExists(uri);
      if (cancelled) return;

      if (!exists) {
        setMessage(
          Platform.OS === 'web'
            ? 'This clip link is no longer valid in the browser (temporary upload links expire after refresh). Re-analyse the clip to watch it again.'
            : 'The saved clip file is missing from device storage. It may have been cleared from cache or revoked by the system.'
        );
        setPhase('unavailable');
        return;
      }

      setPhase('ready');
    }

    setPhase('checking');
    void run();
    return () => {
      cancelled = true;
    };
  }, [uri]);

  if (phase === 'checking') {
    return (
      <View
        className="w-full overflow-hidden rounded-xl bg-surface-elevated border border-border items-center justify-center"
        style={{ aspectRatio: 16 / 9 }}
      >
        <ActivityIndicator color="#00C853" />
      </View>
    );
  }

  if (phase === 'unavailable') {
    return <ClipUnavailable message={message} />;
  }

  return <VideoPreviewPlayer uri={uri} className={className} />;
}
