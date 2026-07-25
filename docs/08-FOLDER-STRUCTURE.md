# Coach AI — Folder Structure (MVP)

**Version:** 2.0  
**Last Updated:** 2026-07-23

---

## Overview

Single Expo project + Supabase folder. No monorepo. Optimised for solo founder + AI coding tools.

```
coach-ai/
├── app/                          # Expo Router screens
├── src/                          # App source code
├── supabase/                     # Backend (DB, functions, migrations)
├── assets/                       # Images, fonts, icons
├── docs/                         # Planning documents
├── app.json
├── package.json
└── README.md
```

---

## Complete Directory Tree

```
coach-ai/
│
├── app/                              # Expo Router (file-based routing)
│   ├── (auth)/
│   │   ├── _layout.tsx               # Auth stack layout
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── forgot-password.tsx
│   ├── (onboarding)/
│   │   ├── _layout.tsx
│   │   ├── welcome.tsx               # 2-slide onboarding
│   │   └── profile-setup.tsx         # Single-page profile wizard
│   ├── (tabs)/
│   │   ├── _layout.tsx               # Tab bar (Home, Progress, Coach, Profile)
│   │   ├── index.tsx                 # Home — clip list + upload CTA
│   │   ├── progress.tsx              # Rating trend + stats
│   │   ├── coach.tsx                 # AI chat (M5)
│   │   └── profile.tsx               # Settings + edit profile
│   ├── clip/
│   │   ├── upload.tsx                # Pick video from camera roll
│   │   ├── preview.tsx               # Preview + focus area selection
│   │   └── analysing.tsx             # Processing animation
│   ├── report/
│   │   └── [id].tsx                  # Full coaching report
│   ├── _layout.tsx                   # Root layout (auth check, theme)
│   └── +not-found.tsx
│
├── src/
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Chip.tsx              # Focus area selector
│   │   │   ├── RatingBadge.tsx       # Large rating display
│   │   │   └── Skeleton.tsx
│   │   ├── report/
│   │   │   ├── RatingReveal.tsx      # Animated rating (FotMob style)
│   │   │   ├── StrengthsList.tsx
│   │   │   ├── ImproveList.tsx
│   │   │   ├── CoachExplanation.tsx
│   │   │   ├── DrillCard.tsx
│   │   │   └── ReportFeedback.tsx    # Thumbs up/down
│   │   ├── clip/
│   │   │   ├── ClipCard.tsx          # Home screen clip item
│   │   │   ├── FocusSelector.tsx     # Multi-select focus chips
│   │   │   ├── UploadProgress.tsx
│   │   │   └── ClipPreview.tsx
│   │   ├── progress/
│   │   │   ├── RatingTrend.tsx       # Line chart
│   │   │   └── StatsSummary.tsx
│   │   ├── chat/
│   │   │   ├── ChatBubble.tsx
│   │   │   ├── SuggestedQuestions.tsx
│   │   │   └── ChatInput.tsx
│   │   └── layout/
│   │       ├── EmptyState.tsx
│   │       └── ScreenHeader.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useProfile.ts
│   │   ├── useClipUpload.ts
│   │   ├── useReport.ts
│   │   ├── useProgress.ts
│   │   └── useChat.ts
│   ├── lib/
│   │   ├── supabase.ts               # Supabase client init
│   │   ├── constants.ts              # Focus areas, positions, levels
│   │   └── validation.ts             # Clip duration/size checks
│   ├── stores/
│   │   └── authStore.ts              # Zustand auth state
│   ├── theme/
│   │   ├── colors.ts
│   │   ├── typography.ts
│   │   └── spacing.ts
│   └── types/
│       ├── database.ts               # Generated Supabase types
│       └── report.ts                 # Report JSON schema types
│
├── supabase/
│   ├── functions/
│   │   ├── generate-report/
│   │   │   ├── index.ts              # Main AI pipeline
│   │   │   ├── gemini.ts             # Gemini API client
│   │   │   ├── prompts/
│   │   │   │   ├── v1-system.txt
│   │   │   │   └── v1-user.txt
│   │   │   ├── schema.ts             # Zod report validation
│   │   │   └── push.ts               # Expo push notification
│   │   └── chat/
│   │       ├── index.ts              # AI coach chat (M5)
│   │       ├── prompts/
│   │       │   └── v1-system.txt
│   │       └── context.ts            # Report + profile context builder
│   ├── migrations/
│   │   ├── 20260723000001_create_profiles.sql
│   │   ├── 20260723000002_create_clips.sql
│   │   ├── 20260723000003_create_reports.sql
│   │   ├── 20260723000004_create_chat.sql
│   │   └── 20260723000005_dashboard_rpc.sql
│   └── config.toml                   # Supabase local config
│
├── assets/
│   ├── images/
│   │   ├── icon.png
│   │   ├── splash.png
│   │   └── onboarding/
│   ├── fonts/
│   └── animations/                   # Lottie (optional)
│
├── docs/                             # Planning documents (this folder)
│
├── app.json                          # Expo config
├── eas.json                          # EAS Build config
├── tailwind.config.js                # NativeWind config
├── tsconfig.json
├── package.json
├── .env.example                      # SUPABASE_URL, SUPABASE_ANON_KEY
├── .gitignore
└── README.md
```

---

## Key Conventions

| Context | Convention | Example |
|---------|-----------|---------|
| Screens | kebab-case files in `app/` | `profile-setup.tsx` |
| Components | PascalCase | `RatingReveal.tsx` |
| Hooks | camelCase with `use` | `useClipUpload.ts` |
| Edge functions | kebab-case dirs | `generate-report/` |
| DB migrations | timestamp prefix | `20260723_create_clips.sql` |
| Types | PascalCase interfaces | `Report`, `Clip`, `Profile` |

---

## Environment Variables

```bash
# .env.example
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Supabase Edge Function secrets (set via Supabase dashboard)
GEMINI_API_KEY=...
EXPO_ACCESS_TOKEN=...  # For push notifications
```

**Never commit secrets.** Edge function keys live in Supabase secrets manager.

---

## What Was Removed (vs v1 Plan)

| Removed | Why |
|---------|-----|
| `apps/` monorepo structure | Single project sufficient |
| `packages/shared-types/` | Types live in `src/types/` |
| `services/` Python ML folder | No CV in MVP |
| `infra/terraform/` | Supabase managed |
| `apps/api/` NestJS | Supabase edge functions |
| `apps/upload-server/` tus | Direct Supabase Storage upload |
| `apps/admin/` | Not needed for MVP |

These will be re-added when scaling beyond MVP (see `03-TECHNICAL-ARCHITECTURE.md` migration path).

---

## Local Development

```bash
# Setup
npm install
cp .env.example .env.local

# Start Supabase locally (optional)
supabase start

# Run app
npx expo start

# Deploy edge function
supabase functions deploy generate-report

# Apply migrations
supabase db push
```
