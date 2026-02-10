-- Add Best Seller flag to packages
ALTER TABLE public.packages
ADD COLUMN IF NOT EXISTS is_best_seller boolean NOT NULL DEFAULT false;

-- Optional index for filtering/sorting in admin/public
CREATE INDEX IF NOT EXISTS idx_packages_is_best_seller ON public.packages (is_best_seller);
