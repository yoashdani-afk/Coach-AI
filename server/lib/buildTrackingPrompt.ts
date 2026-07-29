import type { AnalysisRequestMetadata } from './types.js';
import { getClipDurationSec, getFocusTimestampSec } from './videoWindow.js';

export function buildTrackingSystemInstruction(): string {
  return `You are a football video analyst tracking ONE marked player through sampled still frames.

Rules:
1. Return bounding boxes in NORMALISED 0–1 coordinates relative to the full video frame (top-left origin).
2. box.x and box.y are the TOP-LEFT corner of the player silhouette.
3. box.width and box.height are the player's visible width and height in normalised units.
4. Never jump the box to a similar-looking teammate.
5. Combine colour, kit, shorts, socks, build, movement, direction, velocity, trajectory, and ALL user reference crops.
6. CONFIRMED = strong visual evidence. PROBABLE = continuity cues only. LOST = off-screen or indistinguishable after multiple failed frames.
7. When confidence drops: predict → search nearby → re-identify → continue. Do NOT declare LOST after a single missed frame.
8. When LOST: state LOST — client will hide marker.
9. Return valid JSON only.`;
}

export function buildTrackingUserPrompt(metadata: AnalysisRequestMetadata): string {
  const { playerSelection, clip } = metadata;
  const focusSec = getFocusTimestampSec(playerSelection, clip.durationMs);
  const durationSec = getClipDurationSec(clip.durationMs);

  const refs =
    playerSelection.identityProfile?.references ??
    [
      {
        normalizedX: playerSelection.normalizedX,
        normalizedY: playerSelection.normalizedY,
        timestampMs: playerSelection.timestampMs,
        label: 'primary' as const,
      },
    ];

  const refLines = refs
    .map(
      (ref) =>
        `- ${ref.label} at ${(ref.timestampMs / 1000).toFixed(1)}s (${ref.normalizedX.toFixed(3)}, ${ref.normalizedY.toFixed(3)})`
    )
    .join('\n');

  return `Track the marked player through this ${durationSec.toFixed(1)}s football clip using the sampled still frames.

User confirmed identity references:
${refLines}

Reference images show the player's appearance at these moments. Use them to re-identify after camera pans.

Return one keyframe per sampled timestamp (~every 0.75s) across the FULL clip.

JSON schema:
{
  "keyframes": [{
    "timestampMs": 0,
    "state": "CONFIRMED|PROBABLE|LOST",
    "confidence": 0.0,
    "box": { "x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0 }
  }],
  "confirmedIntervals": [{ "startMs": 0, "endMs": 0 }],
  "uncertainIntervals": [{ "startMs": 0, "endMs": 0 }],
  "lostIntervals": [{ "startMs": 0, "endMs": 0 }],
  "trackingConfidence": 0.0
}

When LOST: do NOT attach the box to another player.
When player reappears: return a new box only after visual re-identification using reference crops.`;
}
