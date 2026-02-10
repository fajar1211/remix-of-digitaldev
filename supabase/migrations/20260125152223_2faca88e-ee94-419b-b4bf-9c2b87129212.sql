-- Create configurable business types
CREATE TABLE IF NOT EXISTS public.business_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  type text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_types_category_type_unique UNIQUE (category, type)
);

ALTER TABLE public.business_types ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
  -- SELECT: any authenticated user can read active business types
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'business_types' AND policyname = 'authenticated_can_read_active_business_types'
  ) THEN
    CREATE POLICY authenticated_can_read_active_business_types
    ON public.business_types
    FOR SELECT
    USING (auth.uid() IS NOT NULL AND is_active = true);
  END IF;

  -- Admin/Super admin manage all
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'business_types' AND policyname = 'admins_can_manage_business_types'
  ) THEN
    CREATE POLICY admins_can_manage_business_types
    ON public.business_types
    FOR ALL
    USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
  END IF;
END $$;

-- Trigger for updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_business_types_updated_at'
  ) THEN
    CREATE TRIGGER update_business_types_updated_at
    BEFORE UPDATE ON public.business_types
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS business_types_active_order_idx
ON public.business_types (is_active, category, sort_order, type);