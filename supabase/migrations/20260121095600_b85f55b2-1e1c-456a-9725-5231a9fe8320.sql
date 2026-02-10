-- Add is_recommended flag for highlighting packages on public /packages page
ALTER TABLE public.packages
ADD COLUMN IF NOT EXISTS is_recommended boolean NOT NULL DEFAULT false;

-- Optional index for fast filtering/sorting (small table but harmless)
CREATE INDEX IF NOT EXISTS idx_packages_is_recommended
ON public.packages (is_recommended)
WHERE is_active = true AND show_on_public = true;