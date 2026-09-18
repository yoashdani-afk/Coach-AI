-- Allow authenticated users to permanently delete their own account.
-- Cascades remove profiles, analysis_credit_attempts, hall_of_fame_entries, etc.

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Remove Hall of Fame videos owned by this user (path: {user_id}/...)
  DELETE FROM storage.objects
  WHERE bucket_id = 'hall-of-fame'
    AND (storage.foldername(name))[1] = uid::text;

  -- Cascades to public tables that reference auth.users(id)
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

COMMENT ON FUNCTION public.delete_own_account() IS
  'Permanently deletes the calling user, their profile data, and HOF storage objects.';

REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
