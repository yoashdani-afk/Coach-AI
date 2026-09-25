-- Sticky analysis allotment for the current anniversary period.
-- Pro cancel mid-period must not shrink the limit or wipe usage until rollover.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS analyses_period_limit INT NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.profiles.analyses_period_limit IS
  'Analysis allotment for the current anniversary period (1 free / 12 Pro). Sticky until rollover.';

UPDATE public.profiles
SET analyses_period_limit = GREATEST(analyses_period_limit, analyses_used_this_month, 1)
WHERE analyses_used_this_month > analyses_period_limit;

DROP FUNCTION IF EXISTS public._rollover_analysis_usage_if_needed(UUID);

CREATE OR REPLACE FUNCTION public._rollover_analysis_usage_if_needed(
  p_user_id UUID,
  p_next_period_limit INT DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start DATE;
  v_today DATE := (TIMEZONE('utc', NOW()))::date;
  v_next_limit INT := GREATEST(1, COALESCE(p_next_period_limit, 1));
BEGIN
  SELECT analyses_period_start
  INTO v_start
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND OR v_start IS NULL THEN
    RETURN;
  END IF;

  IF (v_start + INTERVAL '1 month')::date > v_today THEN
    RETURN;
  END IF;

  WHILE (v_start + INTERVAL '1 month')::date <= v_today LOOP
    v_start := (v_start + INTERVAL '1 month')::date;
  END LOOP;

  UPDATE public.profiles
  SET
    analyses_used_this_month = 0,
    analyses_period_start = v_start,
    analyses_period_limit = v_next_limit,
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_analysis_usage(p_monthly_limit INT DEFAULT 1)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_used INT;
  v_period DATE;
  v_period_limit INT;
  v_requested INT := GREATEST(0, COALESCE(p_monthly_limit, 1));
  v_limit INT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Rollover uses the requested entitlement for the NEW period only.
  PERFORM public._rollover_analysis_usage_if_needed(v_uid, v_requested);

  SELECT analyses_used_this_month, analyses_period_start, analyses_period_limit
  INTO v_used, v_period, v_period_limit
  FROM public.profiles
  WHERE id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002';
  END IF;

  v_period_limit := GREATEST(1, COALESCE(v_period_limit, 1));

  -- Mid-period upgrade to a higher allotment (free → Pro): raise sticky limit.
  -- Never shrink mid-period (Pro cancel keeps remaining Pro allotment until rollover).
  IF v_requested > v_period_limit THEN
    UPDATE public.profiles
    SET analyses_period_limit = v_requested, updated_at = NOW()
    WHERE id = v_uid;
    v_period_limit := v_requested;
  END IF;

  v_limit := v_period_limit;

  RETURN json_build_object(
    'ok', true,
    'used', v_used,
    'remaining', GREATEST(0, v_limit - v_used),
    'limit', v_limit,
    'period_start', v_period,
    'period_end', (v_period + INTERVAL '1 month')::date
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_analysis_credit(
  p_attempt_id TEXT,
  p_monthly_limit INT DEFAULT 1
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
  v_period_limit INT;
  v_requested INT := GREATEST(0, COALESCE(p_monthly_limit, 1));
  v_limit INT;
  v_already BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_attempt_id IS NULL OR length(trim(p_attempt_id)) = 0 THEN
    RAISE EXCEPTION 'attempt_id required' USING ERRCODE = '22023';
  END IF;

  PERFORM public._rollover_analysis_usage_if_needed(v_uid, v_requested);

  SELECT EXISTS (
    SELECT 1 FROM public.analysis_credit_attempts
    WHERE user_id = v_uid AND attempt_id = p_attempt_id
  ) INTO v_already;

  IF v_already THEN
    SELECT analyses_used_this_month, analyses_period_start, analyses_period_limit
    INTO v_used, v_period, v_period_limit
    FROM public.profiles WHERE id = v_uid;

    v_limit := GREATEST(1, COALESCE(v_period_limit, 1));
    IF v_requested > v_limit THEN
      v_limit := v_requested;
    END IF;

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

  SELECT analyses_used_this_month, analyses_period_start, analyses_period_limit
  INTO v_used, v_period, v_period_limit
  FROM public.profiles
  WHERE id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002';
  END IF;

  v_period_limit := GREATEST(1, COALESCE(v_period_limit, 1));
  IF v_requested > v_period_limit THEN
    UPDATE public.profiles
    SET analyses_period_limit = v_requested, updated_at = NOW()
    WHERE id = v_uid;
    v_period_limit := v_requested;
  END IF;
  v_limit := v_period_limit;

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
  WHERE id = v_uid
  RETURNING analyses_used_this_month INTO v_used;

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
  v_limit INT := GREATEST(1, COALESCE(p_monthly_limit, 1));
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
    analyses_period_limit = GREATEST(analyses_period_limit, v_limit),
    analyses_used_this_month = CASE
      WHEN p_reset_used THEN 0
      ELSE analyses_used_this_month
    END,
    updated_at = NOW()
  WHERE id = v_uid
  RETURNING analyses_used_this_month, analyses_period_limit INTO v_used, v_limit;

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

-- Keep reset helper aligned with sticky limit.
CREATE OR REPLACE FUNCTION public.reset_my_analysis_usage(p_monthly_limit INT DEFAULT 1)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_limit INT := GREATEST(1, COALESCE(p_monthly_limit, 1));
  v_period DATE;
  v_used INT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  PERFORM public._rollover_analysis_usage_if_needed(v_uid, v_limit);

  UPDATE public.profiles
  SET
    analyses_used_this_month = 0,
    analyses_period_limit = v_limit,
    updated_at = NOW()
  WHERE id = v_uid
  RETURNING analyses_used_this_month, analyses_period_start, analyses_period_limit
  INTO v_used, v_period, v_limit;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN json_build_object(
    'ok', true,
    'used', v_used,
    'remaining', GREATEST(0, v_limit - v_used),
    'limit', v_limit,
    'period_start', v_period,
    'period_end', (v_period + INTERVAL '1 month')::date
  );
END;
$$;
