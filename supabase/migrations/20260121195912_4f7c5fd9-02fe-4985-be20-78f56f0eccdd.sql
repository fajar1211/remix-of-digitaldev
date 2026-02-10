-- Allow authenticated users (onboarding flow) to read active package add-ons

ALTER TABLE IF EXISTS public.package_add_ons ENABLE ROW LEVEL SECURITY;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'package_add_ons'
      AND policyname = 'authenticated_can_view_active_package_add_ons'
  ) THEN
    EXECUTE 'CREATE POLICY authenticated_can_view_active_package_add_ons '
      || 'ON public.package_add_ons '
      || 'AS PERMISSIVE '
      || 'FOR SELECT '
      || 'TO authenticated '
      || 'USING (is_active = true)';
  END IF;
END $do$;
