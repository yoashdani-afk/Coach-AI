-- Public Goal coaching report payload for Hall of Fame detail views.
-- Written at induct time; NULL on legacy rows (UI shows "unavailable").

ALTER TABLE public.hall_of_fame_entries
  ADD COLUMN IF NOT EXISTS report_snapshot JSONB;

COMMENT ON COLUMN public.hall_of_fame_entries.report_snapshot IS
  'Sanitized GoalReport snapshot for public report detail (narratives + scores; no identityProfile, profile PII, chat, or analysisFallbackReason).';
