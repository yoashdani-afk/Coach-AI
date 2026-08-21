"""
YOLO + BoT-SORT selected-player tracking for football clips.
Returns observations for a single BoT-SORT track ID chosen at the user's tap frame.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from ultralytics import YOLO

from tracker_config import (
    load_merged_tracker_config,
    parse_tracker_namespace,
    resolve_tracker_yaml_path,
    tracker_config_summary,
)

PERSON_CLASS = 0
STRICT_NEAREST_RADIUS = 0.06  # fraction of max(frameW, frameH)
YOLO_MODEL = "yolov8n.pt"


@dataclass
class FrameTracks:
    timestamp_ms: int
    frame_index: int
    width: int
    height: int
    tracks: list[tuple[int, np.ndarray, float]] = field(default_factory=list)


@dataclass
class FrameRef:
    frame_index: int
    timestamp_ms: int


@dataclass
class RunSpan:
    start_frame: int
    end_frame: int
    start_ms: int
    end_ms: int
    length: int


@dataclass
class TrackDiagnostics:
    selected_track_id: str
    first_confirmed: FrameRef | None
    last_confirmed: FrameRef | None
    first_lost: FrameRef | None
    longest_confirmed_run: RunSpan | None
    longest_lost_run: RunSpan | None
    still_image_paths: dict[str, str]


def _box_contains(box_xyxy: np.ndarray, px: float, py: float) -> bool:
    x1, y1, x2, y2 = box_xyxy
    return x1 <= px <= x2 and y1 <= py <= y2


def _box_center(box_xyxy: np.ndarray) -> tuple[float, float]:
    x1, y1, x2, y2 = box_xyxy
    return (x1 + x2) / 2.0, (y1 + y2) / 2.0


def _normalize_box(box_xyxy: np.ndarray, width: int, height: int) -> dict[str, float]:
    x1, y1, x2, y2 = box_xyxy
    return {
        "x": float(x1 / width),
        "y": float(y1 / height),
        "width": float((x2 - x1) / width),
        "height": float((y2 - y1) / height),
    }


def select_track_at_tap(
    tracks: list[tuple[int, np.ndarray, float]],
    normalized_tap_x: float,
    normalized_tap_y: float,
    width: int,
    height: int,
) -> int | None:
    if not tracks:
        return None

    tap_px_x = normalized_tap_x * width
    tap_px_y = normalized_tap_y * height
    max_dim = max(width, height)
    strict_radius = STRICT_NEAREST_RADIUS * max_dim

    containing: list[tuple[int, np.ndarray, float]] = []
    for tid, box, conf in tracks:
        if _box_contains(box, tap_px_x, tap_px_y):
            containing.append((tid, box, conf))

    if len(containing) == 1:
        return containing[0][0]

    if len(containing) > 1:
        containing.sort(
            key=lambda item: (item[2], -((item[1][2] - item[1][0]) * (item[1][3] - item[1][1]))),
            reverse=True,
        )
        return containing[0][0]

    best_tid: int | None = None
    best_dist = math.inf
    for tid, box, _conf in tracks:
        cx, cy = _box_center(box)
        dist = math.hypot(tap_px_x - cx, tap_px_y - cy)
        if dist < best_dist and dist <= strict_radius:
            best_dist = dist
            best_tid = tid

    return best_tid


def _read_video_meta(video_path: str) -> tuple[float, int, int, int]:
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"cannot_open_video: {video_path}")
    fps = float(cap.get(cv2.CAP_PROP_FPS) or 30.0)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    cap.release()
    if width <= 0 or height <= 0:
        raise ValueError("invalid_video_dimensions")
    return fps, width, height, frame_count


def _run_yolo_track(video_path: str, clip_duration_ms: int | None) -> tuple[list[FrameTracks], float, int, int]:
    fps, width, height, _frame_count = _read_video_meta(video_path)
    model = YOLO(YOLO_MODEL)

    tracker_cfg_dict = load_merged_tracker_config()
    tracker_cfg = parse_tracker_namespace(tracker_cfg_dict)
    tracker_yaml_path = resolve_tracker_yaml_path()
    print("[BoT-SORT] Tracker config", tracker_config_summary(tracker_cfg), flush=True)

    frames: list[FrameTracks] = []
    results = model.track(
        source=video_path,
        persist=True,
        tracker=tracker_yaml_path,
        classes=[PERSON_CLASS],
        stream=True,
        verbose=False,
    )

    for frame_index, result in enumerate(results):
        timestamp_ms = int(round((frame_index / fps) * 1000))
        if clip_duration_ms is not None and timestamp_ms > clip_duration_ms:
            break

        tracks: list[tuple[int, np.ndarray, float]] = []
        boxes = result.boxes
        if boxes is not None and len(boxes) > 0 and boxes.id is not None:
            xyxy = boxes.xyxy.cpu().numpy()
            confs = boxes.conf.cpu().numpy()
            tids = boxes.id.cpu().numpy().astype(int)
            for tid, box, conf in zip(tids, xyxy, confs):
                tracks.append((int(tid), box.astype(float), float(conf)))

        frames.append(
            FrameTracks(
                timestamp_ms=timestamp_ms,
                frame_index=frame_index,
                width=width,
                height=height,
                tracks=tracks,
            )
        )

    return frames, fps, width, height


def _find_reference_frame(frames: list[FrameTracks], reference_timestamp_ms: int) -> FrameTracks:
    if not frames:
        raise ValueError("no_frames_processed")
    return min(frames, key=lambda f: abs(f.timestamp_ms - reference_timestamp_ms))


def _build_lost_intervals(
    frames: list[FrameTracks],
    selected_track_id: int,
    clip_duration_ms: int,
) -> list[dict[str, int]]:
    intervals: list[dict[str, int]] = []
    in_lost = False
    start_ms = 0

    for frame in frames:
        present = any(tid == selected_track_id for tid, _box, _conf in frame.tracks)
        if not present and not in_lost:
            in_lost = True
            start_ms = frame.timestamp_ms
        elif present and in_lost:
            intervals.append({"startMs": start_ms, "endMs": frame.timestamp_ms})
            in_lost = False

    if in_lost:
        end_ms = frames[-1].timestamp_ms if frames else clip_duration_ms
        intervals.append({"startMs": start_ms, "endMs": end_ms})

    return intervals


def _selected_present(frame: FrameTracks, selected_track_id: int) -> bool:
    return any(tid == selected_track_id for tid, _box, _conf in frame.tracks)


def _compute_track_diagnostics(
    frames: list[FrameTracks],
    selected_track_id: int,
) -> TrackDiagnostics:
    present = [_selected_present(frame, selected_track_id) for frame in frames]

    first_confirmed: FrameRef | None = None
    last_confirmed: FrameRef | None = None
    first_lost: FrameRef | None = None

    for idx, frame in enumerate(frames):
        if present[idx]:
            if first_confirmed is None:
                first_confirmed = FrameRef(frame.frame_index, frame.timestamp_ms)
            last_confirmed = FrameRef(frame.frame_index, frame.timestamp_ms)
        elif idx > 0 and present[idx - 1] and first_lost is None:
            first_lost = FrameRef(frame.frame_index, frame.timestamp_ms)

    def collect_runs(target_present: bool) -> list[RunSpan]:
        runs: list[RunSpan] = []
        start_idx: int | None = None
        for idx, frame in enumerate(frames):
            if present[idx] == target_present:
                if start_idx is None:
                    start_idx = idx
            elif start_idx is not None:
                end_idx = idx - 1
                runs.append(
                    RunSpan(
                        start_frame=frames[start_idx].frame_index,
                        end_frame=frames[end_idx].frame_index,
                        start_ms=frames[start_idx].timestamp_ms,
                        end_ms=frames[end_idx].timestamp_ms,
                        length=end_idx - start_idx + 1,
                    )
                )
                start_idx = None
        if start_idx is not None:
            end_idx = len(frames) - 1
            runs.append(
                RunSpan(
                    start_frame=frames[start_idx].frame_index,
                    end_frame=frames[end_idx].frame_index,
                    start_ms=frames[start_idx].timestamp_ms,
                    end_ms=frames[end_idx].timestamp_ms,
                    length=end_idx - start_idx + 1,
                )
            )
        return runs

    confirmed_runs = collect_runs(True)
    lost_runs = collect_runs(False)

    longest_confirmed = max(confirmed_runs, key=lambda r: r.length, default=None)
    longest_lost = max(lost_runs, key=lambda r: r.length, default=None)

    return TrackDiagnostics(
        selected_track_id=f"track-{selected_track_id}",
        first_confirmed=first_confirmed,
        last_confirmed=last_confirmed,
        first_lost=first_lost,
        longest_confirmed_run=longest_confirmed,
        longest_lost_run=longest_lost,
        still_image_paths={},
    )


def _frame_ref_dict(ref: FrameRef | None) -> dict[str, int] | None:
    if ref is None:
        return None
    return {"frameIndex": ref.frame_index, "timestampMs": ref.timestamp_ms}


def _run_span_dict(run: RunSpan | None) -> dict[str, int] | None:
    if run is None:
        return None
    return {
        "startFrame": run.start_frame,
        "endFrame": run.end_frame,
        "startMs": run.start_ms,
        "endMs": run.end_ms,
        "length": run.length,
    }


def diagnostics_log_payload(diagnostics: TrackDiagnostics) -> dict[str, Any]:
    return {
        "selectedTrackId": diagnostics.selected_track_id,
        "firstConfirmedFrame": _frame_ref_dict(diagnostics.first_confirmed),
        "lastConfirmedFrame": _frame_ref_dict(diagnostics.last_confirmed),
        "firstLostFrame": _frame_ref_dict(diagnostics.first_lost),
        "longestContinuousConfirmedRun": _run_span_dict(diagnostics.longest_confirmed_run),
        "longestLostRun": _run_span_dict(diagnostics.longest_lost_run),
    }


def _read_video_frame(video_path: str, frame_index: int) -> np.ndarray | None:
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
    ok, img = cap.read()
    cap.release()
    return img if ok else None


def _annotate_still(
    img: np.ndarray,
    meta: FrameTracks | None,
    selected_track_id: int,
    label: str,
    is_lost: bool,
) -> np.ndarray:
    annotated = img.copy()
    h, w = annotated.shape[:2]

    if meta:
        for tid, box, conf in meta.tracks:
            x1, y1, x2, y2 = map(int, box)
            is_selected = tid == selected_track_id
            color = (0, 255, 0) if is_selected else (180, 180, 180)
            thickness = 3 if is_selected else 1
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, thickness)
            tag = f"{tid}" if not is_selected else f"SEL {tid} {conf:.2f}"
            cv2.putText(
                annotated,
                tag,
                (x1, max(16, y1 - 6)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5 if not is_selected else 0.6,
                color,
                2,
            )

    banner = label
    if is_lost:
        banner = f"LOST — {label}"
    cv2.rectangle(annotated, (0, 0), (w, 36), (0, 0, 0), -1)
    cv2.putText(annotated, banner, (8, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)

    if meta:
        ts_line = f"frame={meta.frame_index}  t={meta.timestamp_ms / 1000:.2f}s"
        cv2.putText(annotated, ts_line, (8, h - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)

    if is_lost:
        cv2.putText(annotated, "LOST", (w - 120, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255), 2)

    return annotated


def write_diagnostic_stills(
    video_path: str,
    frames: list[FrameTracks],
    selected_track_id: int,
    diagnostics: TrackDiagnostics,
    output_dir: Path,
) -> dict[str, str]:
    output_dir.mkdir(parents=True, exist_ok=True)
    frame_map = {f.frame_index: f for f in frames}
    paths: dict[str, str] = {}

    def save_still(name: str, frame_index: int, label: str, is_lost: bool) -> None:
        img = _read_video_frame(video_path, frame_index)
        if img is None:
            return
        meta = frame_map.get(frame_index)
        annotated = _annotate_still(img, meta, selected_track_id, label, is_lost)
        out_path = output_dir / f"{name}.jpg"
        cv2.imwrite(str(out_path), annotated)
        paths[name] = str(out_path)

    if diagnostics.first_confirmed:
        save_still(
            "still-first-confirmed",
            diagnostics.first_confirmed.frame_index,
            "first confirmed",
            False,
        )

    if diagnostics.last_confirmed:
        save_still(
            "still-last-confirmed",
            diagnostics.last_confirmed.frame_index,
            "last confirmed",
            False,
        )

    if diagnostics.first_lost:
        lost_idx = diagnostics.first_lost.frame_index
        save_still("still-first-lost", lost_idx, "first disappearance", True)
        for offset in (1, 2, 3):
            save_still(
                f"still-after-lost-{offset}",
                lost_idx + offset,
                f"after disappearance +{offset}",
                True,
            )

    return paths


def write_debug_video(
    video_path: str,
    frames: list[FrameTracks],
    selected_track_id: int,
    output_path: str,
) -> str:
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"cannot_open_video_for_debug: {video_path}")

    fps = float(cap.get(cv2.CAP_PROP_FPS) or 30.0)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    if not writer.isOpened():
        cap.release()
        raise ValueError(f"cannot_create_debug_video: {output_path}")

    track_map = {f.frame_index: f for f in frames}

    frame_index = 0
    while True:
        ok, img = cap.read()
        if not ok:
            break

        meta = track_map.get(frame_index)
        selected_present = False
        if meta:
            selected_present = _selected_present(meta, selected_track_id)
            for tid, box, conf in meta.tracks:
                x1, y1, x2, y2 = map(int, box)
                is_selected = tid == selected_track_id
                color = (0, 255, 0) if is_selected else (180, 180, 180)
                thickness = 3 if is_selected else 1
                cv2.rectangle(img, (x1, y1), (x2, y2), color, thickness)
                label = f"{tid}" if not is_selected else f"SEL {tid}"
                font_scale = 0.4 if not is_selected else 0.55
                cv2.putText(img, label, (x1, max(14, y1 - 4)), cv2.FONT_HERSHEY_SIMPLEX, font_scale, color, 1)

                if is_selected:
                    cx = int((x1 + x2) / 2)
                    tip_y = max(0, y1 - 18)
                    cv2.arrowedLine(img, (cx, tip_y), (cx, y1), (0, 255, 0), 3, tipLength=0.35)

        ts_ms = meta.timestamp_ms if meta else int(round((frame_index / fps) * 1000))
        header = f"frame={frame_index}  t={ts_ms / 1000:.2f}s"
        cv2.rectangle(img, (0, 0), (width, 28), (0, 0, 0), -1)
        cv2.putText(img, header, (6, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)

        if meta and not selected_present:
            cv2.rectangle(img, (0, 30), (width, 58), (0, 0, 180), -1)
            cv2.putText(img, f"LOST track-{selected_track_id}", (6, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)
        elif meta and selected_present:
            cv2.putText(img, f"CONFIRMED track-{selected_track_id}", (6, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 0), 2)

        writer.write(img)
        frame_index += 1

    cap.release()
    writer.release()
    return output_path


def track_player(
    video_path: str,
    reference_timestamp_ms: int,
    normalized_tap_x: float,
    normalized_tap_y: float,
    clip_duration_ms: int,
    job_id: str | None = None,
    debug_output_dir: str | None = None,
) -> dict[str, Any]:
    frames, fps, width, height = _run_yolo_track(video_path, clip_duration_ms)

    ref_frame = _find_reference_frame(frames, reference_timestamp_ms)
    selected_track_id = select_track_at_tap(
        ref_frame.tracks,
        normalized_tap_x,
        normalized_tap_y,
        ref_frame.width,
        ref_frame.height,
    )
    if selected_track_id is None:
        raise ValueError("no_track_at_reference_tap")

    observations: list[dict[str, Any]] = []
    frames_with_player = 0

    for frame in frames:
        match = next(((tid, box, conf) for tid, box, conf in frame.tracks if tid == selected_track_id), None)
        if not match:
            continue
        _tid, box, conf = match
        frames_with_player += 1
        observations.append(
            {
                "timestampMs": frame.timestamp_ms,
                "trackId": f"track-{selected_track_id}",
                "confidence": conf,
                "box": _normalize_box(box, width, height),
                "state": "CONFIRMED",
                "coordinateSource": "detection",
            }
        )

    total_frames = len(frames)
    lost_frames = total_frames - frames_with_player
    coverage_ratio = frames_with_player / max(1, total_frames)
    lost_intervals = _build_lost_intervals(frames, selected_track_id, clip_duration_ms)

    diagnostics = _compute_track_diagnostics(frames, selected_track_id)

    out_dir = Path(debug_output_dir or Path.cwd() / ".tracking-debug")
    run_suffix = job_id or f"run-{selected_track_id}"
    run_dir = out_dir / run_suffix
    run_dir.mkdir(parents=True, exist_ok=True)

    debug_video_path = str(run_dir / "botsort-debug.mp4")
    write_debug_video(video_path, frames, selected_track_id, debug_video_path)

    still_paths = write_diagnostic_stills(
        video_path,
        frames,
        selected_track_id,
        diagnostics,
        run_dir,
    )
    diagnostics.still_image_paths = still_paths

    print("[BoT-SORT] Track diagnostics", diagnostics_log_payload(diagnostics), flush=True)
    print("[BoT-SORT] Debug artifacts", {"video": debug_video_path, "stills": still_paths}, flush=True)

    stats = {
        "selectedTrackId": f"track-{selected_track_id}",
        "totalFrames": total_frames,
        "framesWithSelectedPlayer": frames_with_player,
        "lostFrames": lost_frames,
        "identitySwitches": 0,
        "coverageRatio": coverage_ratio,
        "diagnostics": diagnostics_log_payload(diagnostics),
    }

    print("[BoT-SORT] Track complete", stats, flush=True)

    return {
        "selectedTrackId": f"track-{selected_track_id}",
        "sourceWidth": width,
        "sourceHeight": height,
        "fps": round(fps, 3),
        "observations": observations,
        "lostIntervals": lost_intervals,
        "stats": stats,
        "debugVideoPath": debug_video_path,
        "debugStillPaths": still_paths,
        "diagnostics": diagnostics_log_payload(diagnostics),
    }
