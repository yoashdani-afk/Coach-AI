# BoT-SORT Tracker Service

Python microservice for selected-player tracking using **Ultralytics YOLO** + **BoT-SORT** (ReID + camera motion compensation).

## Setup

```bash
cd tracker_service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

First run downloads the YOLOv8n weights automatically.

## Run

```bash
python app.py
# listens on http://127.0.0.1:8765
```

Environment:

| Variable | Default | Description |
|----------|---------|-------------|
| `TRACKER_SERVICE_PORT` | `8765` | HTTP port |
| `TRACKER_DEBUG_DIR` | `.tracking-debug` | Debug MP4 output directory |

## API

### `GET /health`

### `POST /track`

```json
{
  "videoPath": "/absolute/path/to/clip.mp4",
  "referenceTimestampMs": 1500,
  "normalizedTapX": 0.52,
  "normalizedTapY": 0.61,
  "clipDurationMs": 27000,
  "jobId": "optional-job-id"
}
```

Returns selected-player observations, lost intervals, stats, and a developer debug video path.

Debug output (every run) under `TRACKER_DEBUG_DIR/{jobId}/`:
- `botsort-debug.mp4` — all tracks, selected in green, LOST banner, frame/time overlay
- `still-first-confirmed.jpg`, `still-last-confirmed.jpg`, `still-first-lost.jpg`
- `still-after-lost-1.jpg` … `still-after-lost-3.jpg`

Logs `[BoT-SORT] Track diagnostics` with first/last confirmed, first lost, longest runs.

## Node integration

Set in `server/.env`:

```
TRACKING_ENGINE=botsort
TRACKER_SERVICE_URL=http://127.0.0.1:8765
```

Use `TRACKING_ENGINE=custom` to fall back to the legacy COCO-SSD + fragment-reconnection pipeline.
