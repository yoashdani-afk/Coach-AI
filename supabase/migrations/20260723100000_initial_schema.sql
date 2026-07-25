-- Coach AI MVP Schema v1
-- Run via: supabase db push

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

-- Profiles (1:1 with auth.users)
CREATE TABLE public.profiles (
  id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name          TEXT NOT NULL,
  avatar_url            TEXT,
  position              player_position NOT NULL,
  age                   INT NOT NULL CHECK (age BETWEEN 10 AND 50),
  skill_level           skill_level NOT NULL,
  preferred_foot        preferred_foot NOT NULL,
  playing_style         TEXT[],
  improvement_goals     TEXT NOT NULL,
  analyses_used_this_month INT NOT NULL DEFAULT 0,
  analyses_bonus_credits   INT NOT NULL DEFAULT 0,
  analyses_reset_at     TIMESTAMPTZ DEFAULT date_trunc('month', NOW()) + INTERVAL '1 month',
  push_token            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own profile" ON public.profiles
  FOR ALL USING (auth.uid() = id);

-- Clips
CREATE TABLE public.clips (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title             TEXT,
  storage_path      TEXT NOT NULL,
  duration_seconds  INT NOT NULL CHECK (duration_seconds BETWEEN 10 AND 300),
  file_size_bytes   BIGINT NOT NULL,
  focus_areas       focus_area[] NOT NULL,
  status            clip_status NOT NULL DEFAULT 'UPLOADING',
  failure_reason    TEXT,
  profile_snapshot  JSONB NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clips_user_id ON public.clips(user_id, created_at DESC);

ALTER TABLE public.clips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own clips" ON public.clips
  FOR ALL USING (auth.uid() = user_id);

-- Reports
CREATE TABLE public.reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id           UUID NOT NULL UNIQUE REFERENCES public.clips(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  overall_rating    DECIMAL(3,1) NOT NULL CHECK (overall_rating BETWEEN 0 AND 10),
  strengths         JSONB NOT NULL,
  areas_to_improve  JSONB NOT NULL,
  coach_explanation TEXT NOT NULL,
  drills            JSONB NOT NULL,
  focus_areas       focus_area[] NOT NULL,
  helpful           BOOLEAN,
  model_used        TEXT,
  generation_time_ms INT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reports_user_id ON public.reports(user_id, created_at DESC);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own reports" ON public.reports
  FOR SELECT USING (auth.uid() = user_id);

-- Storage bucket for clips (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('clips', 'clips', false, 209715200)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload own clips"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'clips' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own clips"
ON storage.objects FOR SELECT
USING (bucket_id = 'clips' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own clips"
ON storage.objects FOR DELETE
USING (bucket_id = 'clips' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Helper: remaining analyses for free tier (3/month + bonus credits)
CREATE OR REPLACE FUNCTION public.get_remaining_analyses(p_user_id UUID)
RETURNS INT AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_free_limit INT := 3;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  IF v_profile.analyses_reset_at <= NOW() THEN
    UPDATE public.profiles
    SET analyses_used_this_month = 0,
        analyses_reset_at = date_trunc('month', NOW()) + INTERVAL '1 month'
    WHERE id = p_user_id;
    v_profile.analyses_used_this_month := 0;
  END IF;

  RETURN GREATEST(0, v_free_limit - v_profile.analyses_used_this_month + v_profile.analyses_bonus_credits);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
