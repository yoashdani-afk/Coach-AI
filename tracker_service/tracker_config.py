"""Resolve BoT-SORT tracker YAML from the installed Ultralytics package defaults."""
from __future__ import annotations

from pathlib import Path
from typing import Any

import ultralytics
from ultralytics.utils import YAML, IterableSimpleNamespace

LOCAL_OVERRIDES: dict[str, Any] = {
    "with_reid": True,
    "gmc_method": "sparseOptFlow",
    "appearance_thresh": 0.8,
    "proximity_thresh": 0.5,
    "fuse_score": True,
    "model": "auto",
}

SERVICE_DIR = Path(__file__).resolve().parent
LOCAL_TRACKER_YAML = SERVICE_DIR / "botsort.yaml"


def official_botsort_yaml_path() -> Path:
    return Path(ultralytics.__file__).resolve().parent / "cfg/trackers/botsort.yaml"


def load_merged_tracker_config() -> dict[str, Any]:
    official_path = official_botsort_yaml_path()
    if not official_path.exists():
        raise FileNotFoundError(f"official_botsort_yaml_not_found: {official_path}")

    cfg = dict(YAML.load(str(official_path)))
    cfg.update(LOCAL_OVERRIDES)

    # Persist merged config beside the service for inspection / YOLO.track(tracker=...)
    YAML.save(str(LOCAL_TRACKER_YAML), cfg)
    return cfg


def parse_tracker_namespace(cfg: dict[str, Any]) -> IterableSimpleNamespace:
    return IterableSimpleNamespace(**cfg)


def tracker_config_summary(cfg: dict[str, Any] | IterableSimpleNamespace) -> dict[str, Any]:
    if isinstance(cfg, IterableSimpleNamespace):
        data = vars(cfg)
    else:
        data = cfg
    return {
        "tracker_type": data.get("tracker_type"),
        "with_reid": data.get("with_reid"),
        "model": data.get("model"),
        "gmc_method": data.get("gmc_method"),
        "track_high_thresh": data.get("track_high_thresh"),
        "track_low_thresh": data.get("track_low_thresh"),
        "new_track_thresh": data.get("new_track_thresh"),
        "track_buffer": data.get("track_buffer"),
        "match_thresh": data.get("match_thresh"),
        "fuse_score": data.get("fuse_score"),
        "proximity_thresh": data.get("proximity_thresh"),
        "appearance_thresh": data.get("appearance_thresh"),
        "yamlPath": str(LOCAL_TRACKER_YAML),
        "officialSource": str(official_botsort_yaml_path()),
    }


def resolve_tracker_yaml_path() -> str:
    load_merged_tracker_config()
    return str(LOCAL_TRACKER_YAML)
