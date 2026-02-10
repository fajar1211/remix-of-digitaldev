-- 1) Table to persist business type category ordering
CREATE TABLE IF NOT EXISTS public.business_type_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_type_categories_sort_order
ON public.business_type_categories (sort_order);

ALTER TABLE public.business_type_categories ENABLE ROW LEVEL SECURITY;

-- 2) RLS policies (match business_types behavior)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'business_type_categories'
      AND policyname = 'admins_can_manage_business_type_categories'
  ) THEN
    CREATE POLICY admins_can_manage_business_type_categories
    ON public.business_type_categories
    FOR ALL
    USING (has_role(auth.uid(), 'admin'::public.app_role) OR has_role(auth.uid(), 'super_admin'::public.app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::public.app_role) OR has_role(auth.uid(), 'super_admin'::public.app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'business_type_categories'
      AND policyname = 'authenticated_can_read_active_business_type_categories'
  ) THEN
    CREATE POLICY authenticated_can_read_active_business_type_categories
    ON public.business_type_categories
    FOR SELECT
    USING ((auth.uid() IS NOT NULL) AND (is_active = true));
  END IF;
END $$;
