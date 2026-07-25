# Coach AI — Development Roadmap (MVP)

**Version:** 2.0  
**Last Updated:** 2026-07-23  
**Builder:** Solo founder with AI coding tools  
**Target:** Beta launch with first 100 users in 10–14 weeks

---

## Roadmap Overview

```
Week  1-2        3-4        5-6        7-8        9-10       11-14
      │           │           │           │           │           │
 M0: Design   M1: Auth    M2: Upload  M3: AI      M4: Report  M5: Chat
 & Foundation & Profile   System     Reports     & Progress          M6: Beta
      │           │           │           │           │           │
      └───────────┴───────────┴───────────┴───────────┴───────────┘
                              SHIP IT → 100 USERS
```

---

## Milestone 0 — Design System & App Foundation

**Duration:** 2 weeks  
**Goal:** Premium app shell ready for features.

| Task | Deliverable |
|------|-------------|
| Init Expo project (SDK 52, Expo Router, NativeWind) | Running app on iOS + Android simulators |
| Supabase project setup (auth, DB, storage) | Dev environment live |
| Database migration v1 (profiles, clips, reports) | Schema deployed |
| Dark theme design tokens (colours, typography, spacing) | `src/theme/` |
| Core UI components (Button, Card, Input, Chip, RatingBadge) | Component library |
| Tab navigation shell (Home, Progress, Coach, Profile) | 4 tabs with placeholders |
| Onboarding screens (2 slides) | Swipeable intro |
| App icon + splash screen | Store-ready assets |

**Exit criteria:**
- [ ] App launches with dark theme and tab navigation
- [ ] Supabase connected (auth + DB + storage)
- [ ] 5+ reusable UI components built

---

## Milestone 1 — User Accounts & Player Profiles

**Duration:** 2 weeks  
**Goal:** Users can sign up and create a football profile.

| Task | Deliverable |
|------|-------------|
| Supabase Auth: email + Apple + Google | Working sign up/login |
| Auth screens (login, register, forgot password) | Polished auth UI |
| Profile setup screen (single page) | All profile fields |
| Profile API (Supabase client CRUD) | Create/read/update profile |
| Auth state management (Zustand + SecureStore) | Persistent sessions |
| Protected routes (redirect if no profile) | Auth guards |
| Profile edit screen (settings tab) | Edit all fields |
| Avatar upload (optional) | Profile photo in Supabase Storage |

**Exit criteria:**
- [ ] User can sign up with Apple/Google/email
- [ ] Profile saved with all required fields
- [ ] Session persists across app restarts
- [ ] Unauthenticated users redirected to login

---

## Milestone 2 — Clip Upload System

**Duration:** 2 weeks  
**Goal:** Users can upload clips and select focus areas.

| Task | Deliverable |
|------|-------------|
| Clip picker (expo-image-picker from camera roll) | Video selection |
| Duration validation (10s–5min) | Client-side checks |
| File size validation (≤ 200 MB) | Client-side checks |
| Clip preview screen (expo-av) | Play before upload |
| Focus area selection (multi-select chips) | 10 focus options |
| Upload to Supabase Storage with progress | Progress bar |
| Clip record creation in DB | `clips` table insert |
| Upload flow UI (pick → preview → focus → upload) | 3-screen flow |
| Home screen: empty state + upload CTA | Clear first-action path |
| Home screen: clip list (uploading, analysing, complete) | Status badges |

**Exit criteria:**
- [ ] User uploads a 30-second clip successfully
- [ ] Focus areas saved with clip record
- [ ] Upload progress shown
- [ ] Clip appears on home screen with status

---

## Milestone 3 — AI Coaching Report Generation

**Duration:** 2 weeks  
**Goal:** AI analyses clips and generates structured coaching reports.

| Task | Deliverable |
|------|-------------|
| Edge function: `generate-report` | Deployed to Supabase |
| Gemini 2.0 Flash integration (video input) | Working API call |
| Prompt engineering (system + user templates) | v1 prompts |
| Structured output schema (Zod validation) | JSON report parsing |
| Report storage in DB | `reports` table insert |
| Clip status updates (ANALYSING → COMPLETE/FAILED) | Status flow |
| Analysing/waiting screen with animation | Processing UX |
| Push notification on report ready | Expo push |
| Error handling (poor video, timeout, retry) | Graceful failures |
| Prompt testing with 10+ real clips | Quality validation |

**Exit criteria:**
- [ ] Upload → report delivered in ≤ 2 minutes
- [ ] Report contains rating, strengths, improve, explanation, drills
- [ ] Push notification received when report ready
- [ ] Failed analyses show helpful error message
- [ ] 10 test clips produce quality reports (manual review)

---

## Milestone 4 — Report Screens & Progress Tracking

**Duration:** 2 weeks  
**Goal:** Beautiful report display and simple progress tracking.

| Task | Deliverable |
|------|-------------|
| Report screen (rating reveal animation) | FotMob-style rating |
| Strengths section (bullet cards) | Green-accent cards |
| Areas to improve section (bullet cards) | Amber-accent cards |
| Coach explanation section | Scrollable prose |
| Training drills section | Drill cards with reps |
| Thumbs up/down on report | Helpfulness feedback |
| "Upload another clip" CTA on report | Retention loop |
| Progress tab: rating trend line chart | Simple line chart |
| Progress tab: summary stats (avg, best, latest) | Dashboard RPC |
| Report history list on home screen | Past clips + ratings |
| Clip playback on report screen (local file or signed URL) | Video + report side by side |

**Exit criteria:**
- [ ] Report screen feels premium (design review)
- [ ] Rating reveal animation works smoothly
- [ ] Progress tab shows trend after 2+ reports
- [ ] User can navigate: home → report → upload again in < 3 taps

---

## Milestone 5 — AI Coach Chat

**Duration:** 2 weeks  
**Goal:** Users can ask follow-up coaching questions.

| Task | Deliverable |
|------|-------------|
| Edge function: `chat` | Deployed to Supabase |
| Chat database tables (threads, messages) | Migration applied |
| Chat UI (Gifted Chat or custom) | Message bubbles |
| Report-context chat ("Ask about this report") | Context injection |
| General coaching chat (profile-aware) | System prompt with profile |
| Chat history persistence | Thread + message storage |
| Suggested question chips | Quick-tap prompts |
| Coach tab in navigation | Chat entry point |

**Exit criteria:**
- [ ] User asks "How can I improve my scanning?" → relevant answer
- [ ] Chat references user's profile and past reports
- [ ] Conversation history persists across sessions
- [ ] Suggested questions appear on empty chat

---

## Milestone 6 — Beta Launch

**Duration:** 2–4 weeks  
**Goal:** 100 users, validated retention, ready for App Store.

| Task | Deliverable |
|------|-------------|
| Bug fix sprint (all P0/P1 from M0–M5) | Stable build |
| PostHog analytics events (signup, upload, report, retention) | Funnel tracking |
| Sentry crash monitoring | Error alerts |
| TestFlight (iOS) + Play Store internal testing (Android) | Beta builds |
| Invite first 20 users (local academy/training) | Initial feedback |
| Iterate on report quality from feedback | Prompt improvements |
| In-app feedback button | Qualitative data |
| App Store screenshots + description | Store listing |
| Privacy policy + terms of service | Legal pages |
| App Store + Play Store submission | Public launch |
| Growth push (social, football communities) | 100 users target |

**Exit criteria:**
- [ ] 100 registered users
- [ ] ≥ 60 completed analyses
- [ ] ≥ 50% Day-7 retention
- [ ] ≥ 4.0/5 report helpfulness
- [ ] App live on both stores
- [ ] Zero P0 bugs

---

## Timeline Summary

| Milestone | Weeks | Cumulative |
|-----------|-------|------------|
| M0: Design & Foundation | 1–2 | 2 |
| M1: Auth & Profiles | 3–4 | 4 |
| M2: Clip Upload | 5–6 | 6 |
| M3: AI Reports | 7–8 | 8 |
| M4: Report & Progress | 9–10 | 10 |
| M5: AI Chat | 11–12 | 12 |
| M6: Beta Launch | 13–14 | 14 |

**Total: 10–14 weeks** (depending on part-time vs full-time)

---

## Post-Launch Roadmap

| Version | Timeline | Features |
|---------|----------|----------|
| **v1.1** | +3 weeks | Report sharing, weekly nudge push, GPT-4o quality option |
| **v1.2** | +4 weeks | RevenueCat subscriptions, cross-clip insights |
| **v1.3** | +3 weeks | In-app recording, longer clips (up to 10 min) |
| **v2.0** | +16 weeks | Full match upload, CV pipeline, heat maps |
| **v2.5** | +12 weeks | Timeline, touch maps, 15-category ratings |

---

## Weekly Rhythm (Solo Founder)

| Day | Focus |
|-----|-------|
| Mon–Thu | Build current milestone (AI coding tools) |
| Fri | Test on physical device, fix bugs |
| Sat | Prompt quality testing with real clips |
| Sun | Plan next week, review metrics |

---

## Definition of Done

Every task is done when:
1. Works on iOS + Android physical device
2. No crashes on happy path
3. Dark theme consistent
4. Committed to main branch

---

## Risk Buffer

| Risk | Buffer |
|------|--------|
| Gemini API changes | +1 week (GPT-4o fallback) |
| App Store rejection | +1 week |
| Report quality iteration | Ongoing during M3–M4 |
| Expo/SDK issues | +3 days per milestone |

**Realistic total: 12–16 weeks**
