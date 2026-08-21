import { View, Text, Pressable } from 'react-native';
import { useState } from 'react';
import { SHOW_TRACKING_DEBUG } from '@/lib/trackingConfig';
import { mapVideoBoxToViewport, type MappedPlayerMarker } from '@/lib/videoViewportMapping';
import type { VideoViewportLayout } from '@/lib/videoViewportMapping';
import type { CoordinateSource, TrackingBoundingBox, TrackingState } from '@/types/analysis';

interface TrackingDebugOverlayProps {
  layout: VideoViewportLayout;
  mapped: MappedPlayerMarker | null;
  normalizedBox: TrackingBoundingBox | null;
  state: TrackingState | null;
  currentVideoTimeMs?: number;
  previousSampleTimeMs?: number | null;
  nextSampleTimeMs?: number | null;
  trackingTimestampMs?: number | null;
  identityConfidence?: number | null;
  trackId?: string | null;
  coordinateSource?: CoordinateSource | null;
  debugTrail?: Array<{ x: number; y: number }>;
}

/** Developer overlay — box, centre, tip, trail, timestamps. */
export function TrackingDebugOverlay({
  layout,
  mapped,
  normalizedBox,
  state,
  currentVideoTimeMs,
  previousSampleTimeMs,
  nextSampleTimeMs,
  trackingTimestampMs,
  identityConfidence,
  trackId,
  coordinateSource,
  debugTrail = [],
}: TrackingDebugOverlayProps) {
  const [expanded, setExpanded] = useState(false);

  if (!SHOW_TRACKING_DEBUG) return null;

  const mappedBox = normalizedBox ? mapVideoBoxToViewport(normalizedBox, layout) : null;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
    >
      <View
        style={{
          position: 'absolute',
          left: layout.offsetX,
          top: layout.offsetY,
          width: layout.renderedWidth,
          height: layout.renderedHeight,
          borderWidth: 1,
          borderColor: 'rgba(0, 200, 83, 0.35)',
          borderStyle: 'dashed',
        }}
      />

      {debugTrail.map((point, index) => {
        const screenX = layout.offsetX + point.x * layout.renderedWidth;
        const screenY = layout.offsetY + point.y * layout.renderedHeight;
        const opacity = 0.25 + (index / Math.max(1, debugTrail.length)) * 0.75;
        return (
          <View
            key={`trail-${index}-${point.x.toFixed(3)}`}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: screenX - 3,
              top: screenY - 3,
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: `rgba(0, 200, 83, ${opacity})`,
            }}
          />
        );
      })}

      {mappedBox ? (
        <>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: mappedBox.x,
              top: mappedBox.y,
              width: mappedBox.width,
              height: mappedBox.height,
              borderWidth: 2,
              borderColor: '#00E676',
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: mappedBox.centerX - 3,
              top: mappedBox.centerY - 3,
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: '#00E676',
            }}
          />
        </>
      ) : null}

      {mapped ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: mapped.arrowTipX - 4,
            top: mapped.arrowTipY - 4,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: '#FFEB3B',
            borderWidth: 1,
            borderColor: '#000',
          }}
        />
      ) : null}

      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={{
          position: 'absolute',
          right: 6,
          bottom: 6,
          backgroundColor: 'rgba(0,0,0,0.75)',
          borderRadius: 8,
          paddingHorizontal: 8,
          paddingVertical: 6,
          maxWidth: expanded ? '92%' : 120,
        }}
      >
        <Text style={{ color: '#8BC34A', fontSize: 10, fontWeight: '700' }}>
          Debug {expanded ? '▾' : '▸'}
        </Text>
        {expanded ? (
          <>
            <Text style={{ color: '#AAA', fontSize: 9, lineHeight: 13, marginTop: 4 }}>
              playback {currentVideoTimeMs ?? '—'} ms
            </Text>
            <Text style={{ color: '#AAA', fontSize: 9, lineHeight: 13 }}>
              prev {previousSampleTimeMs ?? '—'} · next {nextSampleTimeMs ?? '—'}
            </Text>
            <Text style={{ color: '#AAA', fontSize: 9, lineHeight: 13 }}>
              sample {trackingTimestampMs ?? '—'} ms
            </Text>
            <Text style={{ color: '#AAA', fontSize: 9, lineHeight: 13 }}>
              track {trackId ?? '—'} · {state ?? '—'}
            </Text>
            <Text style={{ color: '#AAA', fontSize: 9, lineHeight: 13 }}>
              source {coordinateSource ?? '—'} · conf {(identityConfidence ?? 0).toFixed(2)}
            </Text>
            {mapped ? (
              <Text style={{ color: '#AAA', fontSize: 9, lineHeight: 13 }}>
                tip {mapped.arrowTipX.toFixed(0)},{mapped.arrowTipY.toFixed(0)}
              </Text>
            ) : null}
            {normalizedBox ? (
              <Text style={{ color: '#AAA', fontSize: 9, lineHeight: 13 }}>
                box x{normalizedBox.x.toFixed(3)} y{normalizedBox.y.toFixed(3)} w
                {normalizedBox.width.toFixed(3)} h{normalizedBox.height.toFixed(3)}
              </Text>
            ) : null}
            <Text style={{ color: '#AAA', fontSize: 9, lineHeight: 13 }}>
              src {layout.sourceWidth}×{layout.sourceHeight} · scale {layout.scale.toFixed(3)}
            </Text>
          </>
        ) : null}
      </Pressable>
    </View>
  );
}
