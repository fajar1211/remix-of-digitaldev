-- Subscription add-ons (for /order/subscription)
CREATE TABLE IF NOT EXISTS public.subscription_add_ons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  description text NULL,
  price_idr integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_add_ons ENABLE ROW LEVEL SECURITY;

-- Public can read active add-ons (order page is public)
DROP POLICY IF EXISTS "Public can read active subscription add-ons" ON public.subscription_add_ons;
CREATE POLICY "Public can read active subscription add-ons"
ON public.subscription_add_ons
FOR SELECT
USING (is_active = true);

-- Super admin full access
DROP POLICY IF EXISTS "Super admin can manage subscription add-ons" ON public.subscription_add_ons;
CREATE POLICY "Super admin can manage subscription add-ons"
ON public.subscription_add_ons
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- Keep updated_at fresh
DROP TRIGGER IF EXISTS update_subscription_add_ons_updated_at ON public.subscription_add_ons;
CREATE TRIGGER update_subscription_add_ons_updated_at
BEFORE UPDATE ON public.subscription_add_ons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_subscription_add_ons_active_sort
ON public.subscription_add_ons (is_active, sort_order);