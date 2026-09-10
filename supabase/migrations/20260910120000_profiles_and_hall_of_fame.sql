-- Profiles (auth-linked; DOB + optional parent/guardian email for under-13)
-- Hall of Fame entries + public video bucket
-- Independent of 20260723100000_initial_schema.sql (do not apply that file)

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id                      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  date_of_birth           DATE NOT NULL,
  parent_guardian_email   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT parent_email_required_under_13 CHECK (
    -- Soft check: if parent email is set it must look like an email.
    -- Under-13 enforcement is done at signup in the app; parent_guardian_email
    -- is NULL for ages 13+.
    parent_guardian_email IS NULL
    OR parent_guardian_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  )
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- hall_of_fame_entries  (maps to GoalSubmission)
-- ---------------------------------------------------------------------------
CREATE TABLE public.hall_of_fame_entries (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- GoalSubmission fields
  report_id               TEXT NOT NULL,
  video_path              TEXT NOT NULL,          -- storage object path: {user_id}/{entry_id}.ext
  thumbnail_timestamp_ms  INT NOT NULL DEFAULT 0,
  thumbnail_focal_y       REAL,
  player_name             TEXT NOT NULL,
  position                TEXT NOT NULL,          -- Position enum as text
  position_label          TEXT NOT NULL,
  play_title              TEXT NOT NULL,          -- goal title
  summary                 TEXT NOT NULL DEFAULT '', -- short description
  analysis_mode           TEXT NOT NULL DEFAULT 'GOAL',

  -- score (GoalScore)
  score_overall           NUMERIC(4,1) NOT NULL CHECK (score_overall >= 0 AND score_overall <= 10),
  score_is_demo           BOOLEAN NOT NULL DEFAULT false,
  score_categories        JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- award (GoalAward) — badge text + type/emoji for UI
  award_type              TEXT NOT NULL,
  award_emoji             TEXT NOT NULL DEFAULT '',
  award_label             TEXT NOT NULL,

  submitted_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source                  TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'demo')),
  auto_inducted           BOOLEAN NOT NULL DEFAULT false,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT hall_of_fame_entries_unique_user_report UNIQUE (user_id, report_id)
);

CREATE INDEX idx_hof_entries_score
  ON public.hall_of_fame_entries (score_overall DESC, submitted_at DESC);

CREATE INDEX idx_hof_entries_user
  ON public.hall_of_fame_entries (user_id, submitted_at DESC);

ALTER TABLE public.hall_of_fame_entries ENABLE ROW LEVEL SECURITY;

-- Global Leaderboard: anyone (incl. anon with anon key) can read all entries
CREATE POLICY "Anyone can read hall of fame entries"
  ON public.hall_of_fame_entries FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own hall of fame entries"
  ON public.hall_of_fame_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own hall of fame entries"
  ON public.hall_of_fame_entries FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own hall of fame entries"
  ON public.hall_of_fame_entries FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage: public hall-of-fame videos (streamable by anyone)
-- Path convention: {user_id}/{entry_id}.mp4
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hall-of-fame',
  'hall-of-fame',
  true,
  209715200, -- 200 MB
  ARRAY['video/mp4', 'video/quicktime', 'video/x-m4v']
)
ON CONFLICT (id) DO NOTHING;

-- Public read/stream
CREATE POLICY "Anyone can view hall of fame videos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'hall-of-fame');

-- Only owner can upload into their folder
CREATE POLICY "Users upload own hall of fame videos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'hall-of-fame'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users update own hall of fame videos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'hall-of-fame'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'hall-of-fame'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users delete own hall of fame videos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'hall-of-fame'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
