-- Fix: Postgres doesn't support CREATE POLICY IF NOT EXISTS

-- 1) Report links per business
CREATE TABLE IF NOT EXISTS public.business_report_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  kind text NOT NULL,
  url text NOT NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_report_links_kind_chk CHECK (kind IN (
    'local_insights',
    'keyword_rankings',
    'traffic_insights',
    'conversion_insights'
  )),
  CONSTRAINT business_report_links_business_kind_uniq UNIQUE (business_id, kind)
);

ALTER TABLE public.business_report_links ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'business_report_links'
      AND policyname = 'users_can_read_own_business_report_links'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "users_can_read_own_business_report_links"
      ON public.business_report_links
      FOR SELECT
      TO authenticated
      USING (
        business_id IN (
          SELECT b.id FROM public.businesses b WHERE b.user_id = auth.uid()
        )
      )
    $p$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'business_report_links'
      AND policyname = 'assist_can_manage_business_report_links'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "assist_can_manage_business_report_links"
      ON public.business_report_links
      FOR ALL
      TO authenticated
      USING (
        public.has_role(auth.uid(), 'assist'::public.app_role)
        OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
      )
      WITH CHECK (
        public.has_role(auth.uid(), 'assist'::public.app_role)
        OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
      )
    $p$;
  END IF;
END$$;

DROP TRIGGER IF EXISTS trg_business_report_links_updated_at ON public.business_report_links;
CREATE TRIGGER trg_business_report_links_updated_at
BEFORE UPDATE ON public.business_report_links
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


-- 2) Downloadable reports
CREATE TABLE IF NOT EXISTS public.downloadable_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  description text NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.downloadable_reports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'downloadable_reports'
      AND policyname = 'users_can_read_own_downloadable_reports'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "users_can_read_own_downloadable_reports"
      ON public.downloadable_reports
      FOR SELECT
      TO authenticated
      USING (
        business_id IN (
          SELECT b.id FROM public.businesses b WHERE b.user_id = auth.uid()
        )
      )
    $p$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'downloadable_reports'
      AND policyname = 'assist_can_manage_downloadable_reports'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "assist_can_manage_downloadable_reports"
      ON public.downloadable_reports
      FOR ALL
      TO authenticated
      USING (
        public.has_role(auth.uid(), 'assist'::public.app_role)
        OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
      )
      WITH CHECK (
        public.has_role(auth.uid(), 'assist'::public.app_role)
        OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
      )
    $p$;
  END IF;
END$$;
