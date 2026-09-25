-- App Store 5.1.1(v): date of birth must not be required for core app use.
ALTER TABLE public.profiles
  ALTER COLUMN date_of_birth DROP NOT NULL;

COMMENT ON COLUMN public.profiles.date_of_birth IS
  'Optional. Used for age-appropriate coaching and under-13 parent email when provided.';
