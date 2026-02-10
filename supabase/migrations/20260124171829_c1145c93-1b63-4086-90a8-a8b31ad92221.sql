-- Add activation timestamp to user_packages and backfill for existing rows
ALTER TABLE public.user_packages
ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ NULL;

-- Backfill: for existing records that already have started_at but no activated_at
UPDATE public.user_packages
SET activated_at = started_at
WHERE activated_at IS NULL
  AND started_at IS NOT NULL;

-- Helpful index for reporting/admin screens
CREATE INDEX IF NOT EXISTS idx_user_packages_user_id_activated_at
ON public.user_packages (user_id, activated_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_packages_user_id_expires_at
ON public.user_packages (user_id, expires_at DESC);