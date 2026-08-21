import { Pressable, Text, View } from 'react-native';
import { useState } from 'react';
import type { TrackingBuildDebugState } from '@/types/analysis';
import { getConfiguredAnalysisApiUrl } from '@/lib/analysisHealth';

interface TrackingBuildDebugPanelProps {
  debug: TrackingBuildDebugState | null;
}

/** Dev-only technical panel for tracking build diagnostics. */
export function TrackingBuildDebugPanel({ debug }: TrackingBuildDebugPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (!__DEV__) return null;

  const apiUrl = debug?.apiUrl ?? getConfiguredAnalysisApiUrl();

  return (
    <Pressable
      onPress={() => setExpanded((v) => !v)}
      className="mt-3 rounded-xl border border-border bg-surface/80 px-3 py-2"
    >
      <Text className="text-primary text-xs font-semibold">Dev diagnostics {expanded ? '▾' : '▸'}</Text>
      {expanded ? (
        <View className="mt-2 gap-1">
          <Text className="text-text-muted text-[10px]">API: {apiUrl}</Text>
          {debug ? (
            <>
              <Text className="text-text-muted text-[10px]">URI: {debug.fileUri}</Text>
              <Text className="text-text-muted text-[10px]">
                Size: {debug.fileSizeBytes ?? 'unknown'} · MIME: {debug.mimeType}
              </Text>
              <Text className="text-text-muted text-[10px]">
                Upload: {debug.uploadBytesSent}
                {debug.uploadBytesTotal != null ? ` / ${debug.uploadBytesTotal}` : ' (total unknown)'}
              </Text>
              <Text className="text-text-muted text-[10px]">
                Elapsed: {Math.round(debug.elapsedMs / 1000)}s · HTTP: {debug.httpStatus ?? '—'}
              </Text>
              <Text className="text-text-muted text-[10px]">Job: {debug.jobId ?? '—'}</Text>
              <Text className="text-text-muted text-[10px]">Stage: {debug.currentStage}</Text>
              {debug.lastBackendResponse ? (
                <Text className="text-text-muted text-[10px]" numberOfLines={4}>
                  Last: {debug.lastBackendResponse}
                </Text>
              ) : null}
              {debug.errorMessage ? (
                <Text className="text-red-300 text-[10px]">{debug.errorMessage}</Text>
              ) : null}
            </>
          ) : (
            <Text className="text-text-muted text-[10px]">Waiting for job…</Text>
          )}
        </View>
      ) : null}
    </Pressable>
  );
}
