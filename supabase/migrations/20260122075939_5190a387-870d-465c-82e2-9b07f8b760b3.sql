-- Domain pricing settings (single-row)
CREATE TABLE IF NOT EXISTS public.domain_pricing_settings (
  id boolean PRIMARY KEY DEFAULT true,
  default_package_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.domain_pricing_settings ENABLE ROW LEVEL SECURITY;

-- TLD prices per package
CREATE TABLE IF NOT EXISTS public.domain_tld_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.packages (id) ON DELETE CASCADE,
  tld text NOT NULL,
  price_usd numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT domain_tld_prices_tld_format CHECK (tld ~ '^\.[a-z0-9-]{2,}$')
);

-- Unique per package + TLD (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS domain_tld_prices_package_tld_uidx
ON public.domain_tld_prices (package_id, lower(tld));

ALTER TABLE public.domain_tld_prices ENABLE ROW LEVEL SECURITY;

-- Policies (Postgres has no IF NOT EXISTS for CREATE POLICY)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'domain_pricing_settings'
      AND policyname = 'domain_pricing_settings_select_public'
  ) THEN
    CREATE POLICY domain_pricing_settings_select_public
    ON public.domain_pricing_settings
    FOR SELECT
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'domain_pricing_settings'
      AND policyname = 'domain_pricing_settings_manage_super_admin'
  ) THEN
    CREATE POLICY domain_pricing_settings_manage_super_admin
    ON public.domain_pricing_settings
    FOR ALL
    USING (has_role(auth.uid(), 'super_admin'::public.app_role))
    WITH CHECK (has_role(auth.uid(), 'super_admin'::public.app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'domain_tld_prices'
      AND policyname = 'domain_tld_prices_select_public'
  ) THEN
    CREATE POLICY domain_tld_prices_select_public
    ON public.domain_tld_prices
    FOR SELECT
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'domain_tld_prices'
      AND policyname = 'domain_tld_prices_manage_super_admin'
  ) THEN
    CREATE POLICY domain_tld_prices_manage_super_admin
    ON public.domain_tld_prices
    FOR ALL
    USING (has_role(auth.uid(), 'super_admin'::public.app_role))
    WITH CHECK (has_role(auth.uid(), 'super_admin'::public.app_role));
  END IF;
END $$;

-- updated_at triggers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_domain_pricing_settings_updated_at'
  ) THEN
    CREATE TRIGGER trg_domain_pricing_settings_updated_at
    BEFORE UPDATE ON public.domain_pricing_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_domain_tld_prices_updated_at'
  ) THEN
    CREATE TRIGGER trg_domain_tld_prices_updated_at
    BEFORE UPDATE ON public.domain_tld_prices
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;