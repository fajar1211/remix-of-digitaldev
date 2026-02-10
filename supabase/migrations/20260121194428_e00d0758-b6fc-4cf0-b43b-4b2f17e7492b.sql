-- Fix: create policy with dynamic SQL without conflicting dollar-quoting

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'packages'
      AND policyname = 'authenticated_can_view_active_packages'
  ) THEN
    EXECUTE 'CREATE POLICY authenticated_can_view_active_packages '
      || 'ON public.packages '
      || 'AS PERMISSIVE '
      || 'FOR SELECT '
      || 'TO authenticated '
      || 'USING (is_active = true)';
  END IF;
END $do$;

ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
