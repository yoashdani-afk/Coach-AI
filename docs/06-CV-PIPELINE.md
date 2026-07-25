# Coach AI — Computer Vision Pipeline

**Version:** 2.0  
**Status:** Future Vision — NOT part of MVP  
**Last Updated:** 2026-07-23

---

## ⚠️ Not Built in MVP

The MVP uses a **multimodal LLM** (Gemini 2.0 Flash) to watch clips and generate coaching feedback directly. No custom computer vision is required for v1.

This document describes the **future CV pipeline** that will be built when the product validates and users demand full-match analysis, player tracking, and automated event detection.

---

## 1. When to Build This

| Signal | Action |
|--------|--------|
| 1,000+ active users | Begin CV research |
| Users request full-match analysis | Prioritise ingest + tracking |
| LLM report quality plateaus on longer clips | CV events augment LLM context |
| Revenue supports ML hire or contractor | Accelerate pipeline build |

**Estimated effort:** 4–6 months with dedicated ML engineer (or 6–9 months solo).

---

## 2. Future Pipeline Overview

```
Full Match Video
      ↓
FFmpeg Ingest (HLS transcoding)
      ↓
Pitch Detection (homography)
      ↓
Player + Ball Detection (YOLO)
      ↓
Multi-Object Tracking (ByteTrack)
      ↓
Player Re-Identification (user-selected)
      ↓
Pose Estimation (body orientation, scanning)
      ↓
Event Classification (passes, shots, tackles, sprints)
      ↓
Tactical Features (heat maps, zones, phases)
      ↓
Structured JSON → LLM Coaching Layer
```

The LLM layer from MVP is **preserved** — CV provides structured ground truth; LLM generates coaching prose from it. This prevents hallucination and enables minute-by-minute timelines, touch maps, and 15-category ratings.

---

## 3. Future Capabilities

| Capability | Description | Target Version |
|------------|-------------|----------------|
| Player tracking | Track one identified player across full match | v2.0 |
| Event detection | Auto-detect touches, passes, shots, tackles | v2.0 |
| Heat maps | Position heat map across match | v2.0 |
| Touch maps | Pitch diagram of every touch | v2.0 |
| Minute-by-minute timeline | Chronological coaching moments | v2.5 |
| Scanning detection | Head pose before receiving | v2.5 |
| Tactical analysis | Phases, pressing, transitions | v2.5 |
| 15-category ratings | Algorithmic + LLM calibrated | v2.5 |
| Full match upload | Up to 120 minutes | v2.0 |
| Multi-player | Track entire team | v3.0 |
| xG model | Expected goals for shots | v3.0 |

---

## 4. Future Tech Stack (Reference)

| Component | Technology |
|-----------|------------|
| Detection | YOLOv11 (fine-tuned on football) |
| Tracking | ByteTrack + BoT-SORT |
| Re-ID | OSNet + jersey OCR |
| Pose | YOLO-Pose / MediaPipe |
| Pitch | Custom keypoint detector + homography |
| Events | Temporal transformer on trajectories |
| Inference | NVIDIA T4/A10G on AWS/GCP |
| Orchestration | Python Celery/Temporal workers |
| Storage | S3 + CloudFront for HLS |

---

## 5. Migration Path from MVP

When CV is ready, the architecture evolves — it doesn't replace:

```
MVP (now):
  Clip → Gemini → Report

v2.0 (hybrid):
  Clip → Gemini → Report (unchanged for short clips)
  Full match → CV Pipeline → Events JSON → LLM → Rich Report

v2.5 (CV-primary):
  Full match → CV Pipeline → Events JSON → LLM → Timeline + Touch Maps + Ratings
  Clip → Gemini → Report (still available for quick feedback)
```

**Key principle:** Short clip analysis (MVP flow) remains available forever. CV adds a premium tier for full-match analysis.

---

## 6. Data Models (Future — Reference Only)

These tables will be added when CV pipeline ships. See v1 schema docs for full definitions.

- `matches` — full match metadata  
- `match_videos` — HLS URLs, player identification bbox  
- `analyses` — pipeline status, CV artifact S3 keys  
- `timeline_entries` — minute-by-minute coaching moments  
- `touches` — per-touch analysis with pitch coordinates  
- `ratings` — 15 category ratings per report  
- `tactical_insights` — positioning, pressing, transition analysis  

---

## 7. Training Data Strategy (When Ready)

| Dataset | Purpose |
|---------|---------|
| SoccerNet | Pre-training detection models |
| Internal annotations (200+ matches) | Fine-tune all models |
| Expert event labels (50 matches) | Event classifier validation |

Target metrics:
- Player detection mAP ≥ 0.90  
- Tracking MOTA ≥ 0.75  
- Event classification F1 ≥ 0.80  

---

## 8. Cost Estimate (Future — Full Match)

| Resource | Cost/Match |
|----------|------------|
| GPU inference (18 min on T4) | $0.50–1.00 |
| LLM coaching generation | $0.75 |
| Storage (90 days) | $0.10 |
| **Total** | **$1.35–1.85/match** |

Justifies Pro/Academy subscription pricing ($10–20/month).

---

## Summary

**For MVP:** Ignore this document. Use `05-AI-PIPELINE.md` (Gemini watches clips).

**For v2+:** Return here when users outgrow clip analysis and demand full-match intelligence.
