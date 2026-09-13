-- Analysis usage tracking on profiles (account-scoped, not device-local)
-- Real calendar-month rollover via RPCs

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS analyses_used_this_month INT NOT NULL DEFAULT 0
    CHECK (analyses_used_this_month >= 0),
  ADD COLUMN IF NOT EXISTS analyses_period_start DATE NOT NULL
    DEFAULT (date_trunc('month', TIMEZONE('utc', NOW()))::date);

COMMENT ON COLUMN public.profiles.analyses_used_this_month IS
  'Successful Gemini analyses consumed in the current billing period (UTC calendar month).';
COMMENT ON COLUMN public.profiles.analyses_period_start IS
  'UTC calendar-month start (1st) for analyses_used_this_month; rolled forward by RPCs.';

-- Idempotent consume: same attempt_id never double-charges
CREATE TABLE IF NOT EXISTS public.analysis_credit_attempts (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt_id  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, attempt_id)
);

CREATE INDEX IF NOT EXISTS idx_analysis_credit_attempts_user
  ON public.analysis_credit_attempts (user_id, created_at DESC);

ALTER TABLE public.analysis_credit_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own credit attempts"
  ON public.analysis_credit_attempts FOR SELECT
  USING (auth.uid() = user_id);

-- Inserts only via SECURITY DEFINER RPC (no direct client insert policy)

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._analysis_period_start_utc()
RETURNS DATE
LANGUAGE sql
STABLE
AS $$
  SELECT date_trunc('month', TIMEZONE('utc', NOW()))::date;
$$;

CREATE OR REPLACE FUNCTION public._rollover_analysis_usage_if_needed(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period DATE := public._analysis_period_start_utc();
BEGIN
  UPDATE public.profiles
  SET
    analyses_used_this_month = 0,
    analyses_period_start = v_period,
    updated_at = NOW()
  WHERE id = p_user_id
    AND analyses_period_start < v_period;
END;
$$;

-- ---------------------------------------------------------------------------
-- get_analysis_usage(p_monthly_limit)
-- Returns JSON: used, remaining, limit, period_start, period_end
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_analysis_usage(p_monthly_limit INT DEFAULT 3)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_used INT;
  v_period DATE;
  v_limit INT := GREATEST(0, COALESCE(p_monthly_limit, 3));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  PERFORM public._rollover_analysis_usage_if_needed(v_uid);

  SELECT analyses_used_this_month, analyses_period_start
  INTO v_used, v_period
  FROM public.profiles
  WHERE id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN json_build_object(
    'used', v_used,
    'remaining', GREATEST(0, v_limit - v_used),
    'limit', v_limit,
    'period_start', v_period,
    'period_end', (v_period + INTERVAL '1 month')::date
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_analysis_usage(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_analysis_usage(INT) TO authenticated;

-- ---------------------------------------------------------------------------
-- consume_analysis_credit(p_attempt_id, p_monthly_limit)
-- Idempotent by (user_id, attempt_id). Returns JSON status.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_analysis_credit(
  p_attempt_id TEXT,
  p_monthly_limit INT DEFAULT 3
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_used INT;
  v_period DATE;
  v_limit INT := GREATEST(0, COALESCE(p_monthly_limit, 3));
  v_already BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_attempt_id IS NULL OR length(trim(p_attempt_id)) = 0 THEN
    RAISE EXCEPTION 'attempt_id required' USING ERRCODE = '22023';
  END IF;

  PERFORM public._rollover_analysis_usage_if_needed(v_uid);

  SELECT EXISTS (
    SELECT 1 FROM public.analysis_credit_attempts
    WHERE user_id = v_uid AND attempt_id = p_attempt_id
  ) INTO v_already;

  IF v_already THEN
    SELECT analyses_used_this_month, analyses_period_start
    INTO v_used, v_period
    FROM public.profiles WHERE id = v_uid;

    RETURN json_build_object(
      'ok', true,
      'duplicate', true,
      'used', v_used,
      'remaining', GREATEST(0, v_limit - v_used),
      'limit', v_limit,
      'period_start', v_period,
      'period_end', (v_period + INTERVAL '1 month')::date
    );
  END IF;

  SELECT analyses_used_this_month, analyses_period_start
  INTO v_used, v_period
  FROM public.profiles
  WHERE id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_used >= v_limit THEN
    RETURN json_build_object(
      'ok', false,
      'reason', 'limit_reached',
      'used', v_used,
      'remaining', 0,
      'limit', v_limit,
      'period_start', v_period,
      'period_end', (v_period + INTERVAL '1 month')::date
    );
  END IF;

  INSERT INTO public.analysis_credit_attempts (user_id, attempt_id)
  VALUES (v_uid, p_attempt_id);

  UPDATE public.profiles
  SET
    analyses_used_this_month = v_used + 1,
    updated_at = NOW()
  WHERE id = v_uid;

  v_used := v_used + 1;

  RETURN json_build_object(
    'ok', true,
    'duplicate', false,
    'used', v_used,
    'remaining', GREATEST(0, v_limit - v_used),
    'limit', v_limit,
    'period_start', v_period,
    'period_end', (v_period + INTERVAL '1 month')::date
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_analysis_credit(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_analysis_credit(TEXT, INT) TO authenticated;
