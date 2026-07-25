# Coach AI — Feature Checklist (MVP)

**Version:** 2.0  
**Last Updated:** 2026-07-23  
**Status:** Milestone 0 In Progress

---

## Progress Summary

| Milestone | Features | Done | Progress |
|-----------|----------|------|----------|
| M0: Design & Foundation | 12 | 10 | ✅ Complete |
| M1: Auth & Profiles | 10 | 0 | ⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜ 0% |
| M2: Clip Upload | 12 | 0 | ⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜ 0% |
| M3: AI Reports | 12 | 0 | ⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜ 0% |
| M4: Report & Progress | 14 | 0 | ⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜ 0% |
| M5: AI Chat | 8 | 0 | ⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜ 0% |
| M6: Beta Launch | 10 | 0 | ⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜ 0% |
| **TOTAL** | **78** | **0** | **0%** |

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ⬜ | Not started |
| 🔄 | In progress |
| ✅ | Complete |

---

## M0: Design System & App Foundation

| Status | ID | Feature |
|--------|----|---------|
| ✅ | M0-01 | Expo project init (SDK 54, Router, NativeWind) |
| ⬜ | M0-02 | Supabase project setup (live cloud project — user action) |
| ✅ | M0-03 | Database migration SQL (profiles, clips, reports) |
| ✅ | M0-04 | Dark theme design tokens |
| ✅ | M0-05 | UI components (Button, Card, Input, Chip, RatingBadge) |
| ✅ | M0-06 | Tab navigation (Home, Progress, Coach, Profile) |
| ✅ | M0-07 | Onboarding screens (2 slides) |
| ✅ | M0-08 | App icon + splash screen (Expo template assets) |
| ✅ | M0-09 | Supabase Storage bucket — in migration SQL |
| ✅ | M0-10 | RLS policies — in migration SQL |
| ⬜ | M0-11 | Sentry crash reporting setup |
| ⬜ | M0-12 | PostHog analytics setup |

---

## M1: User Accounts & Player Profiles

| Status | ID | Feature |
|--------|----|---------|
| ⬜ | M1-01 | Email + password sign up |
| ⬜ | M1-02 | Apple Sign In |
| ⬜ | M1-03 | Google Sign In |
| ⬜ | M1-04 | Login + forgot password screens |
| ⬜ | M1-05 | Profile setup screen (position, age, level, foot, style, goals) |
| ⬜ | M1-06 | Profile CRUD via Supabase client |
| ⬜ | M1-07 | Auth state (Zustand + SecureStore) |
| ⬜ | M1-08 | Protected routes |
| ⬜ | M1-09 | Profile edit screen |
| ⬜ | M1-10 | Avatar upload (optional) |

---

## M2: Clip Upload System

| Status | ID | Feature |
|--------|----|---------|
| ⬜ | M2-01 | Camera roll clip picker |
| ⬜ | M2-02 | Duration validation (10s–5min) |
| ⬜ | M2-03 | File size validation (≤ 200 MB) |
| ⬜ | M2-04 | Clip preview (expo-av) |
| ⬜ | M2-05 | Focus area multi-select (10 options) |
| ⬜ | M2-06 | Upload to Supabase Storage with progress |
| ⬜ | M2-07 | Clip record in DB with profile snapshot |
| ⬜ | M2-08 | Upload flow UI (pick → preview → focus → upload) |
| ⬜ | M2-09 | Home screen empty state + upload CTA |
| ⬜ | M2-10 | Home screen clip list with status badges |
| ⬜ | M2-11 | Optional clip title/note |
| ⬜ | M2-12 | Delete clip |

---

## M3: AI Coaching Report Generation

| Status | ID | Feature |
|--------|----|---------|
| ⬜ | M3-01 | Edge function: generate-report |
| ⬜ | M3-02 | Gemini 2.0 Flash video integration |
| ⬜ | M3-03 | System + user prompt templates (v1) |
| ⬜ | M3-04 | Structured JSON output (Zod validation) |
| ⬜ | M3-05 | Report saved to DB |
| ⬜ | M3-06 | Clip status flow (ANALYSING → COMPLETE/FAILED) |
| ⬜ | M3-07 | Analysing/waiting screen |
| ⬜ | M3-08 | Push notification on report ready |
| ⬜ | M3-09 | Error handling (poor video, timeout, retry) |
| ⬜ | M3-10 | Rate limiting (10 analyses/day) |
| ⬜ | M3-11 | Prompt testing with 10+ real clips |
| ⬜ | M3-12 | Profile + focus area personalisation in prompt |

---

## M4: Report Screens & Progress Tracking

| Status | ID | Feature |
|--------|----|---------|
| ⬜ | M4-01 | Report screen layout |
| ⬜ | M4-02 | Overall rating reveal animation |
| ⬜ | M4-03 | Strengths section (bullet cards) |
| ⬜ | M4-04 | Areas to improve section (bullet cards) |
| ⬜ | M4-05 | Coach explanation section |
| ⬜ | M4-06 | Training drills section |
| ⬜ | M4-07 | Thumbs up/down feedback |
| ⬜ | M4-08 | "Upload another clip" CTA |
| ⬜ | M4-09 | Progress tab: rating trend chart |
| ⬜ | M4-10 | Progress tab: summary stats |
| ⬜ | M4-11 | Report history on home screen |
| ⬜ | M4-12 | Clip video playback on report screen |
| ⬜ | M4-13 | Dashboard RPC function |
| ⬜ | M4-14 | Recurring improvement themes |

---

## M5: AI Coach Chat

| Status | ID | Feature |
|--------|----|---------|
| ⬜ | M5-01 | Edge function: chat |
| ⬜ | M5-02 | Chat DB tables (threads, messages) |
| ⬜ | M5-03 | Chat UI (message bubbles) |
| ⬜ | M5-04 | Report-context chat |
| ⬜ | M5-05 | General coaching chat (profile-aware) |
| ⬜ | M5-06 | Chat history persistence |
| ⬜ | M5-07 | Suggested question chips |
| ⬜ | M5-08 | Coach tab in navigation |

---

## M6: Beta Launch

| Status | ID | Feature |
|--------|----|---------|
| ⬜ | M6-01 | Bug fix sprint (P0/P1) |
| ⬜ | M6-02 | PostHog funnel events |
| ⬜ | M6-03 | TestFlight + Play Store internal build |
| ⬜ | M6-04 | First 20 user invites |
| ⬜ | M6-05 | Report quality iteration |
| ⬜ | M6-06 | In-app feedback button |
| ⬜ | M6-07 | App Store screenshots + description |
| ⬜ | M6-08 | Privacy policy + terms of service |
| ⬜ | M6-09 | App Store + Play Store submission |
| ⬜ | M6-10 | 100 users acquired |

---

## Explicitly Descoped (Future)

These were in v1 plan but removed from MVP:

| Feature | Target |
|---------|--------|
| Full match upload | v2.0 |
| Computer vision pipeline | v2.0 |
| Player tracking | v2.0 |
| Heat maps / touch maps | v2.0 |
| Minute-by-minute timeline | v2.5 |
| 15 category ratings | v2.5 |
| Tactical analysis | v2.5 |
| NestJS API server | v1.2 (if needed) |
| AWS infrastructure | v2.0 |
| tus resumable upload | v2.0 |
| WebSocket progress | v2.0 |
| Subscriptions (RevenueCat) | v1.2 |
| Report sharing | v1.1 |
| In-app video recording | v1.3 |
| Parental consent flow | v1.2 |
| Light mode | v1.1 |
| Localisation | v2.0 |

---

## Success Metrics Tracker

| Metric | Target | Current |
|--------|--------|---------|
| Registered users | 100 | 0 |
| Completed analyses | 60 | 0 |
| Day-7 retention | ≥ 50% | — |
| Report helpfulness | ≥ 4.0/5 | — |
| Time to report (p95) | ≤ 2 min | — |
| Upload → report rate | ≥ 90% | — |

---

## Approval Gate

| Document | Status |
|----------|--------|
| 01-PRD.md (v2.0) | ✅ Updated — awaiting approval |
| 02-USER-JOURNEYS.md (v2.0) | ✅ Updated — awaiting approval |
| 03-TECHNICAL-ARCHITECTURE.md (v2.0) | ✅ Updated — awaiting approval |
| 04-DATABASE-SCHEMA.md (v2.0) | ✅ Updated — awaiting approval |
| 05-AI-PIPELINE.md (v2.0) | ✅ Updated — awaiting approval |
| 06-CV-PIPELINE.md (v2.0) | ✅ Reframed as future vision |
| 07-API-DESIGN.md (v2.0) | ✅ Updated — awaiting approval |
| 09-ROADMAP.md (v2.0) | ✅ Updated — awaiting approval |
| 10-FEATURE-CHECKLIST.md (v2.0) | ✅ Updated — awaiting approval |

### Decisions (Final)
- **Monetisation:** 3 free analyses/month; manual beta credits; subscriptions post-validation
- **Sharing:** Deferred post-MVP (image export + share links later)
- **Brand:** Coach AI (working name); trademark review before public launch
- **Recording:** Camera roll only for MVP

### Approval
- [x] MVP scope approved
- [x] Stack approved (Expo + Supabase + Gemini)
- [x] Report structure approved
- [x] Milestone 0 started
