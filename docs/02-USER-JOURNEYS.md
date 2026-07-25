# Coach AI — User Journeys (MVP)

**Version:** 2.0  
**Last Updated:** 2026-07-23

---

## Journey Map Overview

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│  Discover   │───▶│   Profile    │───▶│ Upload Clip │───▶│  Get Report  │───▶│   Return    │
│  & Sign Up  │    │   Setup      │    │ + Focus     │    │  & Improve   │    │  & Retain   │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘    └─────────────┘
```

**MVP principle:** Every journey completes in under 5 minutes of active user time (excluding ≤ 2 min AI wait).

---

## Journey 1: First-Time User — Sign Up to First Report

**Persona:** Academy Improver (17)  
**Goal:** Upload a training clip and get coaching feedback  
**Active time:** ~4 minutes + ≤ 2 min wait

| Step | User Action | System Response | Critical UX |
|------|-------------|-----------------|-------------|
| 1 | Opens app | 2-slide onboarding: "Your personal coach" + "Upload a clip, get pro feedback" | Value prop in 5 seconds |
| 2 | Taps "Get Started" | Sign up (Apple / Google / email) | Social login first on iOS |
| 3 | Completes auth | Profile wizard: name, position, age, level, foot, goals | One screen, not three |
| 4 | Lands on Home | Empty state: "Upload your first clip" + illustration | Single clear CTA |
| 5 | Taps "Upload Clip" | Camera roll picker | Show "10s – 5min" hint |
| 6 | Selects 45-sec training clip | Clip preview + duration confirmed | Reject if < 10s or > 5min |
| 7 | Selects focus areas | Chip multi-select: "Passing" + "Decision making" | At least 1 required |
| 8 | Taps "Analyse" | Upload progress → analysing animation | "This takes about 1–2 minutes" |
| 9 | Gets push notification | Opens app → report ready | Deep link to report |
| 10 | Sees rating reveal | **7.8/10** animates in (FotMob style) | The "wow" moment |
| 11 | Reads strengths + improve | Scannable bullet cards | Specific, not generic |
| 12 | Reads coach explanation | 2–3 paragraphs, UEFA Pro tone | Feels like a real coach |
| 13 | Reads drills | 2 drills with reps and focus | Actionable immediately |
| 14 | Taps thumbs up | "Thanks! Upload another clip to track progress" | Reinforce loop |

**Success criteria:** User completes flow and rates report helpful (thumbs up) within first session.

---

## Journey 2: Returning User — Weekly Improvement Loop

**Persona:** Dedicated Trainer  
**Goal:** Track passing improvement over 3 weeks  
**Active time:** ~3 minutes per session

| Step | User Action | System Response |
|------|-------------|-----------------|
| 1 | Opens app (Week 2) | Home shows last report (7.8) + trend arrow |
| 2 | Taps "Upload Clip" | Same flow, faster (profile remembered) |
| 3 | Uploads new passing clip | Focus: "Passing" only |
| 4 | Gets report | Rating: **8.1/10** — "+0.3 vs last time" badge |
| 5 | Opens Progress tab | Simple line chart: 7.2 → 7.8 → 8.1 |
| 6 | Sees recurring theme | "Scan before receiving" flagged as persistent weakness |
| 7 | Opens AI Coach | "How can I improve my scanning?" |
| 8 | Gets personalised drill advice | Position-aware, references past reports |

**Success criteria:** User uploads ≥ 2 clips within 14 days.

---

## Journey 3: Quick Feedback — Single Moment

**Persona:** Sunday League Player  
**Goal:** Understand why a shot went wide  
**Active time:** ~3 minutes

| Step | User Action | System Response |
|------|-------------|-----------------|
| 1 | Trims 15-sec clip from match footage on phone | — |
| 2 | Opens app → Upload | Picks clip from camera roll |
| 3 | Selects "Shooting" | Single focus area |
| 4 | Waits ~90 seconds | Analysing animation with tip: "Body position matters" |
| 5 | Reads report | "Your plant foot was too wide, causing..." |
| 6 | Reads drill | "Placement shooting: 20 reps, 6-yard box" |
| 7 | Shares report screenshot | Share sheet → WhatsApp group chat |

**Success criteria:** Report addresses shooting specifically with technique detail.

---

## Journey 4: Analysis Wait Experience

**Duration:** 30 seconds – 2 minutes

```
[✓] Clip uploaded
[●] Coach is watching your clip...
[○] Generating your report
[○] Ready
```

**During wait:**
- Rotating coaching tips ("Elite players scan 3–4 times before receiving")
- Subtle animation (not a spinner)
- User can leave app → push notification when ready

**Failure cases:**

| Scenario | User Sees | Recovery |
|----------|-----------|----------|
| Video too dark/blurry | "We couldn't see enough detail — try brighter footage" | Re-upload tips |
| AI timeout (> 3 min) | "Taking longer than usual" | Auto-retry; notify when ready |
| Upload failed | "Upload failed — check connection" | Retry button |

---

## Journey 5: AI Coach Follow-Up (Milestone 5)

**Persona:** Any user viewing a report  
**Goal:** Clarify a drill or ask for alternative advice

```
User:  "The scan-and-play drill — how many reps should I do daily?"

Coach: "For your level (Advanced CM), I'd suggest 3 sets of 8 reps,
        4 times per week. Focus on scanning left shoulder before
        every touch — that's the weakness from your last two clips.
        
        Keep sessions under 15 minutes to stay sharp."

User:  "What would a pro do differently in that clip?"

Coach: "In that clip at the moment you received, a pro like Pedri
        would have scanned twice before the pass arrived, opened
        his body to face forward, and played first time into space
        rather than taking an extra touch under pressure..."
```

**Guardrails:** No medical advice; stays football-focused; references user's profile and past reports when available.

---

## Journey 6: Beta Launch — First 100 Users

**Goal:** Validate product-market fit with real players

| Week | Action | Target |
|------|--------|--------|
| 1 | Invite 20 local academy players | 15 sign-ups, 10 reports |
| 2 | Share in 2 football subreddits / Discords | +30 sign-ups |
| 3 | Ask users to share reports on social | 10% share rate |
| 4 | In-app survey: "Would you pay £5/month?" | ≥ 30% say yes |
| 5–6 | Iterate on report quality from feedback | ≥ 4.0/5 helpfulness |
| 7–8 | Open beta on TestFlight / Play Store | 100 total users |

---

## Emotional Journey Arc

```
Curiosity → Commitment → Anticipation → Delight → Action → Habit
    ↑           ↑            ↑            ↑         ↑        ↑
 Onboarding   Profile     Upload+Focus   Report   Drills   Progress
```

**Moments of truth:**
1. **Onboarding (10 sec)** — "This looks premium and serious"
2. **Focus selection** — "It understands what I care about"
3. **Rating reveal** — "That number feels fair and motivating"
4. **Coach explanation** — "This isn't generic ChatGPT — it watched my clip"
5. **Second upload** — Progress tab shows improvement → retention hook

---

## Edge Cases (MVP)

| Scenario | Handling |
|----------|----------|
| Clip too short (< 10s) | Block with message: "Minimum 10 seconds" |
| Clip too long (> 5 min) | Block with message: "Trim to 5 minutes or less" |
| No focus area selected | Disable "Analyse" button |
| User skips profile setup | Require profile before first upload |
| Offline | Show offline banner; queue not needed (small clips) |
| Account deletion | Delete all clips and reports within 24 hours |
