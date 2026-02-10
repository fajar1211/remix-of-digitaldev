ALTER TABLE public.user_packages
ADD COLUMN IF NOT EXISTS duration_months integer;

-- Backfill existing rows
UPDATE public.user_packages
SET duration_months = 1
WHERE duration_months IS NULL;

ALTER TABLE public.user_packages
ALTER COLUMN duration_months SET NOT NULL;

ALTER TABLE public.user_packages
ALTER COLUMN duration_months SET DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_packages_duration_months_positive'
  ) THEN
    ALTER TABLE public.user_packages
      ADD CONSTRAINT user_packages_duration_months_positive CHECK (duration_months > 0);
  END IF;
END $$;