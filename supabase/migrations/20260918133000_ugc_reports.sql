-- User-generated content reports (Hall of Fame, etc.)
CREATE TABLE IF NOT EXISTS public.ugc_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  entry_id        TEXT NOT NULL,
  owner_user_id   UUID,
  player_name     TEXT NOT NULL DEFAULT '',
  play_title      TEXT NOT NULL DEFAULT '',
  reason          TEXT NOT NULL,
  platform        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ugc_reports_created
  ON public.ugc_reports (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ugc_reports_entry
  ON public.ugc_reports (entry_id);

ALTER TABLE public.ugc_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert ugc reports"
  ON public.ugc_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_user_id OR reporter_user_id IS NULL);

-- Allow insert with reporter_user_id = auth.uid()
DROP POLICY IF EXISTS "Authenticated users can insert ugc reports" ON public.ugc_reports;
CREATE POLICY "Authenticated users can insert ugc reports"
  ON public.ugc_reports FOR INSERT
  TO authenticated
  WITH CHECK (reporter_user_id = auth.uid());

-- Admins review in SQL / Table Editor (service role). No public SELECT.
