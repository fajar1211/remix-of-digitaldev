-- Package durations (prepaid) with discount percent

CREATE TABLE IF NOT EXISTS public.package_durations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id uuid NOT NULL,
  duration_months integer NOT NULL,
  discount_percent numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT package_durations_duration_months_check CHECK (duration_months > 0),
  CONSTRAINT package_durations_discount_percent_check CHECK (discount_percent >= 0 AND discount_percent <= 100),
  CONSTRAINT package_durations_unique_package_duration UNIQUE (package_id, duration_months),
  CONSTRAINT package_durations_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.packages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_package_durations_package_id ON public.package_durations(package_id);
CREATE INDEX IF NOT EXISTS idx_package_durations_active ON public.package_durations(is_active);

ALTER TABLE public.package_durations ENABLE ROW LEVEL SECURITY;

-- Read: authenticated users can read active durations (onboarding)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'package_durations'
      AND policyname = 'authenticated_can_read_active_package_durations'
  ) THEN
    CREATE POLICY "authenticated_can_read_active_package_durations"
    ON public.package_durations
    FOR SELECT
    TO authenticated
    USING (is_active = true);
  END IF;
END $$;

-- Manage: super admin full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'package_durations'
      AND policyname = 'super_admin_manage_package_durations'
  ) THEN
    CREATE POLICY "super_admin_manage_package_durations"
    ON public.package_durations
    FOR ALL
    TO authenticated
    USING (has_role(auth.uid(), 'super_admin'::public.app_role))
    WITH CHECK (has_role(auth.uid(), 'super_admin'::public.app_role));
  END IF;
END $$;

-- Trigger to keep updated_at current
DROP TRIGGER IF EXISTS update_package_durations_updated_at ON public.package_durations;
CREATE TRIGGER update_package_durations_updated_at
BEFORE UPDATE ON public.package_durations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
