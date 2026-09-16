-- Anniversary-based analysis periods (not calendar-month 1sts).
-- Free: period anchored to profile created_at (download/signup day).
-- Pro: client syncs anchor to RevenueCat latestPurchaseDate on subscribe.

COMMENT ON COLUMN public.profiles.analyses_used_this_month IS
  'Successful Gemini analyses consumed in the current anniversary period.';
COMMENT ON COLUMN public.profiles.analyses_period_start IS
  'UTC start date of the current analysis period; rolls forward by +1 month (anniversary), not calendar month.';

ALTER TABLE public.profiles
  ALTER COLUMN analyses_period_start
  SET DEFAULT ((TIMEZONE('utc', NOW()))::date);

-- Re-anchor profiles still on calendar-month 1sts to signup/created day.
UPDATE public.profiles
SET
  analyses_period_start = created_at::date,
  updated_at = NOW()
WHERE analyses_period_start = date_trunc('month', analyses_period_start)::date;

-- Drop calendar-month helper (replaced by anniversary rollover).
DROP FUNCTION IF EXISTS public._analysis_period_start_utc();

CREATE OR REPLACE FUNCTION public._rollover_analysis_usage_if_needed(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start DATE;
  v_today DATE := (TIMEZONE('utc', NOW()))::date;
BEGIN
  SELECT analyses_period_start
  INTO v_start
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND OR v_start IS NULL THEN
    RETURN;
  END IF;

  -- Still inside current window [v_start, v_start + 1 month)
  IF (v_start + INTERVAL '1 month')::date > v_today THEN
    RETURN;
  END IF;

  -- Catch up any missed periods; usage resets once for the new open window.
  WHILE (v_start + INTERVAL '1 month')::date <= v_today LOOP
    v_start := (v_start + INTERVAL '1 month')::date;
  END LOOP;

  UPDATE public.profiles
  SET
    analyses_used_this_month = 0,
    analyses_period_start = v_start,
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

-- Align period to a purchase/signup anniversary. Used when Pro activates.
CREATE OR REPLACE FUNCTION public.sync_analysis_period_anchor(
  p_anchor DATE,
  p_reset_used BOOLEAN DEFAULT FALSE,
  p_monthly_limit INT DEFAULT 1
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_today DATE := (TIMEZONE('utc', NOW()))::date;
  v_anchor DATE := COALESCE(p_anchor, v_today);
  v_start DATE;
  v_used INT;
  v_limit INT := GREATEST(0, COALESCE(p_monthly_limit, 1));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF v_anchor > v_today THEN
    v_anchor := v_today;
  END IF;

  v_start := v_anchor;
  WHILE (v_start + INTERVAL '1 month')::date <= v_today LOOP
    v_start := (v_start + INTERVAL '1 month')::date;
  END LOOP;

  UPDATE public.profiles
  SET
    analyses_period_start = v_start,
    analyses_used_this_month = CASE
      WHEN p_reset_used THEN 0
      ELSE analyses_used_this_month
    END,
    updated_at = NOW()
  WHERE id = v_uid
  RETURNING analyses_used_this_month INTO v_used;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN json_build_object(
    'ok', true,
    'used', v_used,
    'remaining', GREATEST(0, v_limit - v_used),
    'limit', v_limit,
    'period_start', v_start,
    'period_end', (v_start + INTERVAL '1 month')::date
  );
END;
$$;

COMMENT ON FUNCTION public.sync_analysis_period_anchor(DATE, BOOLEAN, INT) IS
  'Sets analysis period to the anniversary window for p_anchor (UTC). Optionally resets usage (Pro subscribe).';

REVOKE ALL ON FUNCTION public.sync_analysis_period_anchor(DATE, BOOLEAN, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_analysis_period_anchor(DATE, BOOLEAN, INT) TO authenticated;
