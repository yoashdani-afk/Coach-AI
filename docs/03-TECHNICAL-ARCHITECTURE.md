# Coach AI — Technical Architecture (MVP)

**Version:** 2.0  
**Last Updated:** 2026-07-23  
**Builder context:** Solo founder using AI coding tools (Cursor)

---

## 1. Architecture Philosophy

The MVP optimises for **speed to first 100 users**, not scale to 100,000.

| Principle | Decision |
|-----------|----------|
| Minimise moving parts | 3 services max: Mobile, Supabase, one Edge Function |
| No custom ML/CV | Multimodal LLM watches the clip directly |
| Managed over self-hosted | Supabase handles auth, DB, storage, edge functions |
| Mobile-first | 80% of effort on app UX and report quality |
| Ship in 10–14 weeks | Cut everything that doesn't serve retention |

---

## 2. MVP Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    EXPO REACT NATIVE APP                     │
│         iOS + Android — primary product surface              │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                        SUPABASE                              │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────┐│
│  │   Auth   │  │  PostgreSQL  │  │   Storage (clips)     ││
│  │ Apple/   │  │  + RLS       │  │   Private buckets     ││
│  │ Google/  │  │              │  │                       ││
│  │ Email    │  │              │  │                       ││
│  └──────────┘  └──────────────┘  └───────────────────────┘│
│                           │                                  │
│                           ▼                                  │
│              ┌────────────────────────┐                     │
│              │   Edge Function:       │                     │
│              │   generate-report      │                     │
│              │                        │                     │
│              │   1. Fetch clip URL    │                     │
│              │   2. Call multimodal   │                     │
│              │      LLM with video    │                     │
│              │   3. Parse structured  │                     │
│              │      JSON response     │                     │
│              │   4. Save report to DB │                     │
│              │   5. Trigger push      │                     │
│              └───────────┬────────────┘                     │
└──────────────────────────┼──────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   Multimodal LLM API   │
              │   (Gemini 2.0 Flash)   │
              │   Native video input   │
              └────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   Expo Push / FCM      │
              │   (report ready)       │
              └────────────────────────┘
```

**That's the entire MVP backend.** No Redis, no GPU workers, no S3, no Kubernetes.

---

## 3. Technology Stack

### 3.1 Mobile — Expo React Native

| Choice | Why |
|--------|-----|
| **Expo SDK 52+** | Fastest path to iOS + Android; OTA updates; push notifications built-in |
| **Expo Router** | File-based routing, deep links to reports |
| **NativeWind (Tailwind)** | Rapid premium UI with dark theme |
| **Reanimated 3** | Rating reveal animation, screen transitions |
| **TanStack Query** | Server state caching, optimistic updates |
| **Zustand** | Minimal local state (auth, upload progress) |
| **Supabase JS client** | Auth, DB queries, storage uploads directly from app |
| **expo-image-picker** | Camera roll clip selection |
| **expo-av** | Clip preview before upload |
| **React Native Gifted Chat** | AI coach chat UI (Milestone 5) |

**Why not Flutter?** TypeScript end-to-end; better AI coding tool support; larger package ecosystem for MVP features.

---

### 3.2 Backend — Supabase (All-in-One)

| Service | Usage |
|---------|-------|
| **Supabase Auth** | Apple, Google, email sign-up/login; JWT tokens |
| **Supabase PostgreSQL** | Profiles, clips, reports, chat messages |
| **Supabase Storage** | Private clip uploads (200 MB max) |
| **Supabase Edge Functions** | `generate-report`, `chat` (Deno/TypeScript) |
| **Row Level Security** | Users access only their own data |
| **Database Webhooks** | Trigger edge function when clip status → `ready_for_analysis` |

**Why not NestJS/AWS?** Solo founder can't operate ECS, Terraform, and GPU workers. Supabase gives auth + DB + storage + serverless functions in one dashboard. Migrate later if needed.

---

### 3.3 AI — Multimodal LLM (Video Input)

| Choice | Why |
|--------|-----|
| **Google Gemini 2.0 Flash** (primary) | Native video input; fast (~30–60s); cheap (~$0.05–0.10/clip); good vision quality |
| **GPT-4o** (fallback) | Frame extraction + image sequence if Gemini unavailable |
| **Structured output** | JSON schema enforced via response format / tool use |

**Why not custom CV?** Building YOLO + tracking + event detection is 6+ months of ML work. Gemini watches the clip and coaches — good enough for MVP validation.

**MVP AI flow:**
```
Clip URL + Profile + Focus Areas
        ↓
Gemini 2.0 Flash (video input)
        ↓
Structured JSON report
        ↓
Save to PostgreSQL → Push notification
```

---

### 3.4 Notifications

| Choice | Why |
|--------|-----|
| **Expo Push Notifications** | Built into Expo; no Firebase setup needed for MVP |
| **Edge function trigger** | Send push after report saved |

---

### 3.5 Analytics & Monitoring

| Tool | Purpose | Cost |
|------|---------|------|
| **PostHog** | Product analytics, funnels, retention | Free tier |
| **Sentry** | Crash reporting (mobile + edge functions) | Free tier |
| **Supabase Dashboard** | DB metrics, storage, function logs | Included |

---

## 4. What We Removed (vs v1 Plan)

| Removed | Why |
|---------|-----|
| NestJS API server | Supabase client + edge functions sufficient |
| AWS ECS / Terraform | Over-engineered for MVP |
| Redis / BullMQ | No job queue needed; edge function handles async |
| tus resumable upload | Clips ≤ 200 MB; direct Supabase Storage upload |
| FFmpeg / HLS transcoding | No streaming needed; clip plays locally before upload |
| Python CV microservices | No computer vision in MVP |
| GPU workers | No ML inference |
| CloudFront CDN | Supabase Storage signed URLs sufficient |
| WebSocket progress | Polling or push notification instead |
| Socket.io chat gateway | Edge function with SSE or simple request/response |

---

## 5. Data Flow — Clip to Report

```
1. UPLOAD
   Mobile → Supabase Storage (private bucket: clips/{userId}/{clipId}.mp4)
   Mobile → INSERT clip record (status: UPLOADED, focus_areas, profile snapshot)

2. TRIGGER
   Database webhook OR client calls edge function → generate-report
   Update clip status: ANALYSING

3. ANALYSE
   Edge function:
     a. Generate signed URL for clip (60s expiry)
     b. Build prompt: profile + focus areas + coaching instructions
     c. Call Gemini 2.0 Flash with video URL + prompt
     d. Parse structured JSON response
     e. Validate schema (Zod)
     f. INSERT report record
     g. Update clip status: COMPLETE

4. NOTIFY
   Send Expo push notification: "Your coaching report is ready"
   Mobile fetches report via Supabase client (RLS)

Total time: 30 seconds – 2 minutes
```

---

## 6. Security

| Layer | Implementation |
|-------|----------------|
| Auth | Supabase JWT; SecureStore on device |
| Data access | Row Level Security on all tables |
| Clip storage | Private bucket; signed URLs only (60s expiry) |
| Edge functions | Verify JWT before processing |
| API keys | Supabase secrets (never in client code) |
| Rate limiting | Edge function: max 10 analyses/day per user (beta) |

---

## 7. Cost Estimate (MVP — 100 Users)

| Service | Monthly Cost |
|---------|-------------|
| Supabase Pro | $25 |
| Gemini API (600 analyses @ $0.10) | $60 |
| Expo EAS Build | $0 (free tier) |
| PostHog + Sentry | $0 (free tiers) |
| Apple Developer | $8/mo (annualised) |
| Google Play | $2/mo (one-time $25) |
| **Total** | **~$95/month** |

**Cost per analysis:** ~$0.10 (Gemini Flash video)

---

## 8. Folder Structure (MVP — Simplified)

```
coach-ai/
├── app/                          # Expo Router screens
│   ├── (auth)/
│   ├── (tabs)/
│   ├── clip/
│   └── report/
├── src/
│   ├── components/
│   ├── hooks/
│   ├── lib/                      # Supabase client, utils
│   ├── stores/
│   └── theme/
├── supabase/
│   ├── functions/
│   │   ├── generate-report/      # Main AI pipeline
│   │   └── chat/                 # AI coach (M5)
│   ├── migrations/               # SQL schema
│   └── seed.sql                  # Drill templates
├── docs/
├── app.json
├── package.json
└── README.md
```

**No monorepo.** Single Expo project + Supabase folder. Simple enough for one person + AI coding tools.

---

## 9. Migration Path (When to Add Complexity)

| Trigger | Add |
|---------|-----|
| 1,000+ users | Dedicated API server (still serverless) |
| Report quality plateau | Fine-tune prompts; add frame extraction fallback |
| Users want longer clips | FFmpeg transcoding; resumable upload |
| Users want full matches | Begin CV pipeline (see 06-CV-PIPELINE.md) |
| Revenue > $5K MRR | RevenueCat subscriptions |
| GDPR enterprise requests | Dedicated EU Supabase region |

---

## 10. Architecture Decision Records

### ADR-001: Multimodal LLM over custom CV for MVP
**Decision:** Gemini watches clips directly; no YOLO/tracking.  
**Rationale:** CV pipeline is 6+ months. LLM coaching quality is sufficient to validate PMF with 100 users.

### ADR-002: Supabase over custom backend
**Decision:** All backend via Supabase (auth, DB, storage, edge functions).  
**Rationale:** Solo founder; one dashboard; zero DevOps; ship in weeks not months.

### ADR-003: Clip-based over full-match
**Decision:** 10s–5min clips only.  
**Rationale:** Faster upload, faster analysis, lower cost, clearer user intent via focus selection.

### ADR-004: No monorepo
**Decision:** Single Expo project, not Turborepo.  
**Rationale:** One developer; no shared packages needed yet.

---

## 11. Future Architecture (v2+)

When the product validates and scales:

```
MVP (now)          v1.2                v2.0
Supabase      →    + RevenueCat    →   + CV Pipeline
Edge Functions     + Longer clips       + NestJS API
Gemini Flash       + GPT-4o quality     + GPU workers
Expo App           + Web dashboard      + Heat maps
```

See `06-CV-PIPELINE.md` for the full computer vision roadmap (post-MVP).
