# Coach AI — Database Schema (MVP)

**Version:** 2.0  
**Last Updated:** 2026-07-23  
**Database:** PostgreSQL via Supabase

---

## 1. Entity Relationship Diagram

```
┌──────────────┐
│   profiles   │  (1:1 with auth.users)
└──────┬───────┘
       │
       │ 1:N
       ▼
┌──────────────┐       ┌──────────────┐
│    clips     │──────▶│   reports    │
└──────┬───────┘  1:1  └──────────────┘
       │
       │ (optional link)
       ▼
┌──────────────┐       ┌──────────────┐
│ chat_threads │──────▶│chat_messages │
└──────────────┘  1:N  └──────────────┘
```

**5 tables.** That's the entire MVP schema.

---

## 2. Enums

```sql
CREATE TYPE player_position AS ENUM (
  'GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'
);

CREATE TYPE skill_level AS ENUM (
  'BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'SEMI_PRO'
);

CREATE TYPE preferred_foot AS ENUM ('LEFT', 'RIGHT', 'BOTH');

CREATE TYPE focus_area AS ENUM (
  'FIRST_TOUCH', 'PASSING', 'SHOOTING', 'DEFENDING', 'DRIBBLING',
  'MOVEMENT', 'POSITIONING', 'DECISION_MAKING', 'ONE_V_ONE', 'FOOTBALL_IQ'
);

CREATE TYPE clip_status AS ENUM (
  'UPLOADING', 'UPLOADED', 'ANALYSING', 'COMPLETE', 'FAILED'
);
```

---

## 3. Tables

### 3.1 `profiles`

```sql
CREATE TABLE public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name    TEXT NOT NULL,
  avatar_url      TEXT,
  position        player_position NOT NULL,
  age             INT NOT NULL CHECK (age BETWEEN 10 AND 50),
  skill_level     skill_level NOT NULL,
  preferred_foot  preferred_foot NOT NULL,
  playing_style   TEXT[],           -- e.g. {'PLAYMAKER', 'PACE'}
  improvement_goals TEXT NOT NULL,    -- max 200 chars
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own profile" ON public.profiles
  FOR ALL USING (auth.uid() = id);
```

---

### 3.2 `clips`

```sql
CREATE TABLE public.clips (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title           TEXT,                          -- optional user note
  storage_path    TEXT NOT NULL,                 -- clips/{userId}/{clipId}.mp4
  duration_seconds INT NOT NULL CHECK (duration_seconds BETWEEN 10 AND 300),
  file_size_bytes BIGINT NOT NULL,
  focus_areas     focus_area[] NOT NULL,         -- user-selected
  status          clip_status NOT NULL DEFAULT 'UPLOADING',
  failure_reason  TEXT,
  -- Snapshot of profile at upload time (for accurate report context)
  profile_snapshot JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clips_user_id ON public.clips(user_id, created_at DESC);
CREATE INDEX idx_clips_status ON public.clips(status) WHERE status = 'ANALYSING';

ALTER TABLE public.clips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own clips" ON public.clips
  FOR ALL USING (auth.uid() = user_id);
```

**`profile_snapshot` example:**
```json
{
  "position": "CM",
  "age": 17,
  "skill_level": "ADVANCED",
  "preferred_foot": "RIGHT",
  "playing_style": ["PLAYMAKER"],
  "improvement_goals": "Improve scanning and first touch under pressure"
}
```

---

### 3.3 `reports`

```sql
CREATE TABLE public.reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id         UUID NOT NULL UNIQUE REFERENCES public.clips(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  overall_rating  DECIMAL(3,1) NOT NULL CHECK (overall_rating BETWEEN 0 AND 10),
  strengths       JSONB NOT NULL,       -- ["Good body position...", ...]
  areas_to_improve JSONB NOT NULL,      -- ["Scan before receiving...", ...]
  coach_explanation TEXT NOT NULL,
  drills          JSONB NOT NULL,       -- [{title, description, reps, focus}]
  focus_areas     focus_area[] NOT NULL,
  helpful         BOOLEAN,              -- null = not rated; true/false = thumbs
  model_used      TEXT,                 -- e.g. "gemini-2.0-flash"
  generation_time_ms INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reports_user_id ON public.reports(user_id, created_at DESC);
CREATE INDEX idx_reports_clip_id ON public.reports(clip_id);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own reports" ON public.reports
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service inserts reports" ON public.reports
  FOR INSERT WITH CHECK (true);  -- edge function uses service role
```

**`drills` JSONB example:**
```json
[
  {
    "title": "Scan and Play",
    "description": "Partner passes from behind. Scan over both shoulders before first touch, then play into space.",
    "reps": "3 sets of 8",
    "duration_minutes": 15,
    "focus": "FIRST_TOUCH"
  }
]
```

---

### 3.4 `chat_threads` (Milestone 5)

```sql
CREATE TABLE public.chat_threads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  report_id       UUID REFERENCES public.reports(id) ON DELETE SET NULL,
  title           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_threads_user ON public.chat_threads(user_id, updated_at DESC);

ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own threads" ON public.chat_threads
  FOR ALL USING (auth.uid() = user_id);
```

---

### 3.5 `chat_messages` (Milestone 5)

```sql
CREATE TABLE public.chat_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id       UUID NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_thread ON public.chat_messages(thread_id, created_at);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own messages" ON public.chat_messages
  FOR ALL USING (
    thread_id IN (SELECT id FROM chat_threads WHERE user_id = auth.uid())
  );
```

---

## 4. Storage Buckets

| Bucket | Access | Path | Max Size |
|--------|--------|------|----------|
| `clips` | Private (RLS) | `{userId}/{clipId}.mp4` | 200 MB |

**RLS policy:** Users can upload/read/delete only their own folder.

---

## 5. Key Queries

### Home screen — recent reports
```sql
SELECT c.id, c.title, c.focus_areas, c.created_at,
       r.overall_rating, r.id AS report_id
FROM clips c
JOIN reports r ON r.clip_id = c.id
WHERE c.user_id = $1 AND c.status = 'COMPLETE'
ORDER BY c.created_at DESC
LIMIT 20;
```

### Progress trend
```sql
SELECT r.overall_rating, r.created_at, c.focus_areas
FROM reports r
JOIN clips c ON c.id = r.clip_id
WHERE r.user_id = $1
ORDER BY r.created_at ASC;
```

### Recurring improvement themes (simple)
```sql
SELECT jsonb_array_elements_text(r.areas_to_improve) AS theme, COUNT(*) AS freq
FROM reports r
WHERE r.user_id = $1
GROUP BY theme
ORDER BY freq DESC
LIMIT 5;
```

---

## 6. Database Webhook (Analysis Trigger)

When a clip row is updated to `status = 'UPLOADED'`, a Supabase database webhook calls the `generate-report` edge function with `{ clip_id }`.

Alternative: mobile app calls the edge function directly after upload completes (simpler for MVP).

---

## 7. Removed Tables (vs v1 Plan)

These are deferred to v2+ when CV pipeline is built:

| Table | When |
|-------|------|
| `matches`, `match_videos` | v2.0 (full match) |
| `analyses`, `analysis_jobs` | v2.0 (CV pipeline) |
| `timeline_entries` | v2.0 |
| `touches` | v2.0 |
| `tactical_insights` | v2.0 |
| `ratings` (15 categories) | v2.0 |
| `improvements` | v2.0 (MVP uses report JSONB) |
| `notifications` | v1.1 (MVP uses push only) |
| `upload_sessions` | v2.0 (resumable upload) |
| `drill_library` | v1.1 (MVP: LLM generates drills inline) |

---

## 8. Migration Strategy

- SQL migrations in `supabase/migrations/`  
- Apply via Supabase CLI: `supabase db push`  
- Seed data not required for MVP (drills generated by AI)  
