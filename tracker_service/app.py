"""HTTP service for YOLO + BoT-SORT selected-player tracking."""
from __future__ import annotations

import os
import traceback
from pathlib import Path

from flask import Flask, jsonify, request

from track_player import track_player

app = Flask(__name__)
DEBUG_DIR = os.environ.get("TRACKER_DEBUG_DIR", str(Path.cwd() / ".tracking-debug"))


@app.get("/health")
def health():
    return jsonify({"ok": True, "service": "botsort-tracker"})


@app.post("/track")
def track():
    payload = request.get_json(force=True, silent=True) or {}
    video_path = payload.get("videoPath")
    if not video_path or not Path(video_path).exists():
        return jsonify({"error": "videoPath missing or not found"}), 400

    try:
        result = track_player(
            video_path=str(video_path),
            reference_timestamp_ms=int(payload.get("referenceTimestampMs", 0)),
            normalized_tap_x=float(payload.get("normalizedTapX", 0)),
            normalized_tap_y=float(payload.get("normalizedTapY", 0)),
            clip_duration_ms=int(payload.get("clipDurationMs", 0)),
            job_id=payload.get("jobId"),
            debug_output_dir=DEBUG_DIR,
        )
        return jsonify(result)
    except ValueError as error:
        traceback.print_exc()
        return jsonify({"error": str(error), "traceback": traceback.format_exc()}), 422
    except Exception:
        traceback.print_exc()
        return jsonify({"error": traceback.format_exc()}), 500


if __name__ == "__main__":
    port = int(os.environ.get("TRACKER_SERVICE_PORT", "8765"))
    app.run(host="0.0.0.0", port=port, debug=False)
