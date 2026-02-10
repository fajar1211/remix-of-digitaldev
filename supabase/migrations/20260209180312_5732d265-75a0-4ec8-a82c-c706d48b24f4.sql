-- Add package scoping for subscription add-ons
ALTER TABLE public.subscription_add_ons
ADD COLUMN IF NOT EXISTS package_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscription_add_ons_package_id_fkey'
  ) THEN
    ALTER TABLE public.subscription_add_ons
    ADD CONSTRAINT subscription_add_ons_package_id_fkey
    FOREIGN KEY (package_id) REFERENCES public.packages(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_subscription_add_ons_package_id ON public.subscription_add_ons(package_id);
