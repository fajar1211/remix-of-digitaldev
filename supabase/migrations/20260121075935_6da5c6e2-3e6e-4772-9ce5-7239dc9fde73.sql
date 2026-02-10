-- Allow Super Admin to manage packages (used by onboarding)

-- Ensure RLS is enabled (safe if already enabled)
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- UPDATE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'packages'
      AND policyname = 'super_admin_can_update_packages'
  ) THEN
    CREATE POLICY super_admin_can_update_packages
    ON public.packages
    FOR UPDATE
    USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));
  END IF;

  -- INSERT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'packages'
      AND policyname = 'super_admin_can_insert_packages'
  ) THEN
    CREATE POLICY super_admin_can_insert_packages
    ON public.packages
    FOR INSERT
    WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));
  END IF;

  -- DELETE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'packages'
      AND policyname = 'super_admin_can_delete_packages'
  ) THEN
    CREATE POLICY super_admin_can_delete_packages
    ON public.packages
    FOR DELETE
    USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));
  END IF;
END $$;