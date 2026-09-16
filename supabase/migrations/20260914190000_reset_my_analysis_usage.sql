-- Dev/testing helper: reset the caller's own analysis usage for the current period.
-- Only auth.uid() can be affected — no user id parameter.

CREATE OR REPLACE FUNCTION public.reset_my_analysis_usage(p_monthly_limit INT DEFAULT 3)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_period DATE;
  v_limit INT := GREATEST(0, COALESCE(p_monthly_limit, 3));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Keep period aligned with calendar month (same helper as get/consume).
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
