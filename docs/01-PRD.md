# Coach AI — Product Requirements Document (PRD)

**Version:** 2.0 (MVP Scope)  
**Status:** Draft — Awaiting Approval  
**Last Updated:** 2026-07-23  
**Working Title:** Coach AI

---

## 1. Executive Summary

Coach AI v1 is a mobile app that gives every player their own personal football coach. Players upload short clips (10 seconds to 5 minutes) from matches or training, select what they want feedback on, and receive a detailed professional coaching report — strengths, weaknesses, elite-level explanations, and personalised drills.

**No computer vision in v1.** A multimodal AI model watches the clip and generates coaching feedback grounded in what it sees, combined with the player's profile and chosen focus areas.

**Primary user:** Amateur to academy players (ages 14–30) who want actionable coaching on specific moments, not generic tips.

**MVP goal:** Ship a beautiful, retention-focused app and get the first 100 users giving real feedback.

**Business model:** Free tier — 3 AI clip analyses per month. Beta testers may receive manual credit top-ups. Paid subscriptions (Pro: higher limits, progress tracking, AI coach chat) added after demand is proven.

---

## 2. Problem Statement

| Problem | Impact |
|---------|--------|
| Players can't afford a personal coach | They repeat mistakes without understanding why |
| YouTube drills are generic | Advice doesn't match their position, level, or goals |
| Self-review is subjective | Players miss body position, scanning, and decision errors |
| Full-match analysis tools are complex and slow | Players just want feedback on one moment |

**MVP insight:** Players don't need a 90-minute breakdown to improve. They need expert feedback on the clip they're thinking about *right now*.

---

## 3. Goals & Success Metrics

### 3.1 MVP Product Goals

1. Deliver coaching reports within **≤ 2 minutes** of upload (p95).
2. Generate feedback rated **≥ 4.0/5** for relevance (in-app thumbs up/down).
3. Achieve **≥ 50% Day-7 retention** after first completed report.
4. Reach **100 registered users** with **≥ 60 completed analyses** within 8 weeks of beta launch.

### 3.2 Key Metrics

| Metric | MVP Target |
|--------|------------|
| Upload → report completion rate | ≥ 90% |
| Time to first report | ≤ 2 min (p95) |
| Reports per user (first 30 days) | ≥ 2.5 |
| Day-7 retention | ≥ 50% |
| Report helpfulness rating | ≥ 4.0/5 |
| Share rate (report shared externally) | ≥ 10% |

**North Star (MVP):** Completed coaching reports per active user per week.

---

## 4. User Personas

### Persona A — "Academy Improver" (Primary)
- **Age:** 16–19  
- **Level:** Academy / regional league  
- **Goal:** Fix specific weaknesses (first touch, scanning)  
- **Behaviour:** Records 30-second clips after training, uploads same evening  

### Persona B — "Sunday League Player"
- **Age:** 22–30  
- **Level:** Amateur / 5-a-side  
- **Goal:** Understand why a pass or shot didn't work  
- **Behaviour:** Trims a moment from phone footage, wants quick honest feedback  

### Persona C — "Dedicated Trainer"
- **Age:** 14–25  
- **Level:** Any  
- **Goal:** Track improvement on a specific skill over weeks  
- **Behaviour:** Uploads weekly clips focused on same skill area, compares reports  

---

## 5. MVP Feature Requirements

### 5.1 Authentication & Accounts

| ID | Requirement | Priority |
|----|-------------|----------|
| AUTH-01 | Email + password sign up | P0 |
| AUTH-02 | Apple Sign In (iOS) | P0 |
| AUTH-03 | Google Sign In (Android) | P0 |
| AUTH-04 | Password reset | P0 |
| AUTH-05 | Persistent session | P0 |

**Out of scope for MVP:** Team accounts, parental consent flow (add before public youth marketing).

---

### 5.2 Player Profile

| Field | Type | Required |
|-------|------|----------|
| Display name | string | Yes |
| Position | enum (GK, CB, LB, RB, CDM, CM, CAM, LW, RW, ST) | Yes |
| Age | number | Yes |
| Level | enum (Beginner, Intermediate, Advanced, Semi-Pro) | Yes |
| Preferred foot | enum (Left, Right, Both) | Yes |
| Playing style | multi-select (e.g. Playmaker, Pace, Physical, Technical) | No |
| Goals for improvement | free text (max 200 chars) | Yes |
| Profile photo | image | No |

Profile is used to personalise every coaching report. Editable anytime from settings.

---

### 5.3 Clip Upload

| ID | Requirement | Priority |
|----|-------------|----------|
| UPL-01 | Upload clip from camera roll | P0 |
| UPL-02 | Duration: 10 seconds to 5 minutes | P0 |
| UPL-03 | Supported formats: MP4, MOV | P0 |
| UPL-04 | Max file size: 200 MB | P0 |
| UPL-05 | Upload progress indicator | P0 |
| UPL-06 | Optional clip title / note | P1 |
| UPL-07 | Record clip in-app | P2 (post-MVP — camera roll only for MVP) |

**Out of scope for MVP:** Full match upload, resumable multi-GB uploads, background upload, player identification step.

---

### 5.4 Focus Area Selection

Before analysis, the user selects **one or more** focus areas:

| Focus Area | Description |
|------------|-------------|
| First touch | Control, body shape, receiving under pressure |
| Passing | Weight, angle, decision, vision |
| Shooting | Technique, placement, body position |
| Defending | Tackling, jockeying, body position, timing |
| Dribbling | Close control, changes of direction, 1v1 |
| Movement | Off-ball runs, timing, creating space |
| Positioning | Where they are relative to play |
| Decision making | Choice of action vs alternatives |
| 1v1 situations | Attacking or defending duels |
| Football IQ | Awareness, scanning, game understanding |

**UX:** Multi-select chips. At least one required. Selection is sent to the AI with the clip.

---

### 5.5 AI Coaching Report

Generated after upload + focus selection. Target delivery: **≤ 2 minutes**.

#### Report Structure

```
┌─────────────────────────────────────┐
│  Overall Rating: 7.8 / 10           │
│  Focus: Passing, Decision making    │
├─────────────────────────────────────┤
│  STRENGTHS (2–4 bullet points)      │
│  • Good body position before receive│
│  • Positive attacking decision      │
├─────────────────────────────────────┤
│  AREAS TO IMPROVE (2–4 bullet points│
│  • Scan before receiving            │
│  • Faster decision under pressure   │
├─────────────────────────────────────┤
│  COACH EXPLANATION                  │
│  What happened, why it worked or    │
│  failed, what an elite player would│
│  do differently. UEFA Pro tone.     │
├─────────────────────────────────────┤
│  TRAINING RECOMMENDATIONS           │
│  2–3 specific drills with reps/sets │
└─────────────────────────────────────┘
```

| ID | Requirement | Priority |
|----|-------------|----------|
| RPT-01 | Overall rating (0.0–10.0, one decimal) | P0 |
| RPT-02 | Strengths list (2–4 items) | P0 |
| RPT-03 | Areas to improve (2–4 items) | P0 |
| RPT-04 | Coach explanation (2–4 paragraphs) | P0 |
| RPT-05 | Training recommendations (2–3 drills) | P0 |
| RPT-06 | Focus areas reflected in feedback | P0 |
| RPT-07 | Profile-aware personalisation | P0 |
| RPT-08 | Report helpfulness rating (thumbs up/down) | P0 |
| RPT-09 | Share report as image or link | P2 (post-MVP) |

**Out of scope for MVP:** Minute-by-minute timeline, per-touch breakdown, heat maps, touch maps, tactical diagrams, 15 category ratings, automatic event detection.

---

### 5.6 Progress Tracking (Lightweight)

| ID | Requirement | Priority |
|----|-------------|----------|
| PRG-01 | List of past clips and reports | P0 |
| PRG-02 | Overall rating per clip | P0 |
| PRG-03 | Simple trend line (rating over time) | P0 |
| PRG-04 | Most common improvement themes | P1 |
| PRG-05 | "Upload again" CTA on report screen | P0 |

**Out of scope for MVP:** Category breakdown charts, aggregate heat maps, cross-match tactical comparison.

---

### 5.7 AI Coach Chat (Milestone 5)

| ID | Requirement | Priority |
|----|-------------|----------|
| CHAT-01 | Ask follow-up questions about a report | P0 |
| CHAT-02 | General coaching advice (position-aware) | P0 |
| CHAT-03 | Drill clarification | P1 |
| CHAT-04 | Conversation history per report | P1 |

**Out of scope for MVP:** Cross-match comparison, video timestamp seek from chat.

---

### 5.8 Notifications

| ID | Requirement | Priority |
|----|-------------|----------|
| NTF-01 | Push when report is ready | P0 |
| NTF-02 | Weekly nudge to upload a new clip | P1 |

**Out of scope for MVP:** Training reminders, personal best alerts, weekly progress digest.

---

## 6. Design Requirements

### 6.1 Visual Direction
- **Aesthetic:** Premium, minimal, dark-first — Apple Sports × FotMob  
- **Theme:** Dark mode only for MVP (charcoal base, green accent for positive, amber for improve)  
- **Typography:** SF Pro / Inter — large rating numbers, clean body  
- **Key moment:** Rating reveal animation on report screen  
- **Reports:** Card-based layout, easy to scan, shareable  

### 6.2 MVP Screens (12 total)
1. Splash + onboarding (2 slides)  
2. Sign up / Login  
3. Profile setup  
4. Home (past reports + upload CTA)  
5. Upload clip  
6. Select focus areas  
7. Processing (analysing animation)  
8. Report (rating, strengths, improve, explanation, drills)  
9. Report history list  
10. Progress (simple trend)  
11. AI Coach chat  
12. Settings / Profile edit  

---

## 7. Non-Functional Requirements (MVP)

| Category | Requirement |
|----------|-------------|
| Performance | Report screen loads in < 1s; analysis ≤ 2 min p95 |
| Availability | 99% uptime (Supabase + serverless) |
| Security | TLS; encrypted storage; RLS on all user data |
| Privacy | Clips private by default; deleted on account deletion |
| Cost | ≤ $0.15 per analysis at MVP scale |
| Platforms | iOS + Android via Expo |

---

## 8. Explicitly Out of Scope (MVP)

- Full match upload and analysis  
- Computer vision / player tracking  
- Heat maps, touch maps, pitch diagrams  
- Minute-by-minute timeline  
- Per-touch automated detection  
- Player identification in video  
- Multi-player / team analysis  
- Tactical phase analysis  
- Video streaming / HLS transcoding  
- Desktop or web app  
- Subscriptions / payments (add post-beta)  
- Parental consent flow  
- Localisation (English only for MVP)  

---

## 9. Future Vision (Post-MVP)

Preserved for v2+ — not built now:

| Feature | Target Version |
|---------|----------------|
| Longer clips (up to 15 min) | v1.1 |
| Multiple focus reports per clip | v1.1 |
| Subscriptions (RevenueCat) | v1.2 |
| Cross-clip progress insights | v1.2 |
| Full match upload | v2.0 |
| Player tracking + heat maps | v2.0 |
| Automatic event detection (CV pipeline) | v2.0 |
| Tactical analysis + timeline | v2.5 |
| Professional academy reports | v3.0 |

See `06-CV-PIPELINE.md` for the future computer vision roadmap.

---

## 10. Risks & Mitigations (MVP)

| Risk | Mitigation |
|------|------------|
| AI gives generic or inaccurate feedback | Structured output schema; profile + focus context; thumbs-down feedback loop |
| Video too dark/blurry for AI to analyse | Pre-upload quality check; friendly error with tips |
| Analysis cost too high per clip | Gemini Flash for video; cache prompts; limit free tier |
| Low retention after first report | Progress trend + weekly nudge + "upload again" CTA on every report |
| Solo founder bandwidth | Minimal stack (Supabase + Expo + one edge function); no custom CV |

---

## 11. Decisions (Final)

### Monetisation
- **Free tier:** 3 AI clip analyses per month (controls AI usage cost during validation).
- **Beta users:** Manual credit top-ups for selected testers.
- **Future:** Paid subscriptions after proving demand.
  - Free: 3 analyses/month
  - Pro: higher limits, progress tracking, AI coach chat, advanced features

### Sharing
- **MVP:** Not prioritised — core coaching experience first.
- **Future:** Export reports as images; shareable report links (coaches, teammates, social).

### Brand Name
- **Working name:** Coach AI (temporary).
- No development time on branding until pre-launch trademark review.

### In-App Recording
- **MVP:** Camera roll upload only — no in-app recording.
- Players already record clips; keeps MVP faster and simpler.

---

## 12. Approval Checklist

- [x] MVP scope approved (clip-based, no CV)  
- [x] Report structure approved  
- [x] Design direction approved  
- [x] Solo-founder stack approved (Expo + Supabase + Gemini)  
- [x] Open questions resolved  
- [x] Milestone 0 approved — development in progress  
