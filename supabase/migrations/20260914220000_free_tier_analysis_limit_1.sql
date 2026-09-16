-- Align free-tier analysis RPC defaults with FREE_TIER_ANALYSES_PER_MONTH = 1.
-- App clients already pass p_monthly_limit explicitly; this updates SQL defaults /
-- COALESCE fallbacks for dashboard/ad-hoc calls that omit the argument.

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
  v_limit INT := GREATEST(0, COALESCE(p_monthly_limit, 1));
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
  v_limit INT := GREATEST(0, COALESCE(p_monthly_limit, 1));
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

CREATE OR REPLACE FUNCTION public.reset_my_analysis_usage(p_monthly_limit INT DEFAULT 1)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_period DATE;
  v_limit INT := GREATEST(0, COALESCE(p_monthly_limit, 1));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  PERFORM public._rollover_analysis_usage_if_needed(v_uid);

  UPDATE public.profiles
  SET
    analyses_used_this_month = 0,
    updated_at = NOW()
  WHERE id = v_uid
  RETURNING analyses_period_start INTO v_period;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN json_build_object(
    'ok', true,
    'used', 0,
    'remaining', v_limit,
    'limit', v_limit,
    'period_start', v_period,
    'period_end', (v_period + INTERVAL '1 month')::date
  );
END;
$$;

COMMENT ON FUNCTION public.reset_my_analysis_usage(INT) IS
  'Resets analyses_used_this_month to 0 for auth.uid() only. Intended for signed-in self-service / testing.';

REVOKE ALL ON FUNCTION public.reset_my_analysis_usage(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_my_analysis_usage(INT) TO authenticated;
