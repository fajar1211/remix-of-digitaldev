-- Package add-ons configurable by Super Admin and used in onboarding
CREATE TABLE IF NOT EXISTS public.package_add_ons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  add_on_key TEXT NOT NULL,
  label TEXT NOT NULL,
  price_per_unit NUMERIC NOT NULL DEFAULT 0,
  unit_step INTEGER NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'unit',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (package_id, add_on_key)
);

ALTER TABLE public.package_add_ons ENABLE ROW LEVEL SECURITY;

-- Super admins can manage all add-ons
CREATE POLICY "super_admin_manage_package_add_ons"
ON public.package_add_ons
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- Authenticated users can read active add-ons (shown during onboarding)
CREATE POLICY "authenticated_can_read_active_package_add_ons"
ON public.package_add_ons
FOR SELECT
TO authenticated
USING (is_active = true);

-- updated_at trigger
DROP TRIGGER IF EXISTS update_package_add_ons_updated_at ON public.package_add_ons;
CREATE TRIGGER update_package_add_ons_updated_at
BEFORE UPDATE ON public.package_add_ons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_package_add_ons_package_id ON public.package_add_ons(package_id);
CREATE INDEX IF NOT EXISTS idx_package_add_ons_add_on_key ON public.package_add_ons(add_on_key);
