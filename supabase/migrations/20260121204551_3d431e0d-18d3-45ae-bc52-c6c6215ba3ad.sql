-- Add sort_order to package_add_ons so Super Admin can control display order
ALTER TABLE public.package_add_ons
ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Backfill sort_order based on created_at within each package
WITH ranked AS (
  SELECT
    id,
    package_id,
    ROW_NUMBER() OVER (PARTITION BY package_id ORDER BY created_at ASC) - 1 AS rn
  FROM public.package_add_ons
)
UPDATE public.package_add_ons p
SET sort_order = r.rn
FROM ranked r
WHERE p.id = r.id;

-- Helpful index for ordering queries
CREATE INDEX IF NOT EXISTS idx_package_add_ons_package_sort
  ON public.package_add_ons (package_id, sort_order);
