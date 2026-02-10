-- Allow admins to manage packages used in /dashboard/admin/website/packages
-- Existing public policy remains unchanged.

-- Enable RLS (no-op if already enabled)
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

-- Admins/Super Admins can read all packages (needed for admin dashboard management UI)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public'
      AND tablename = 'packages'
      AND policyname = 'admins_can_read_all_packages'
  ) THEN
    EXECUTE 'CREATE POLICY "admins_can_read_all_packages" ON public.packages FOR SELECT USING (has_role(auth.uid(), ''admin''::app_role) OR has_role(auth.uid(), ''super_admin''::app_role))';
  END IF;
END $$;

-- Admins/Super Admins can update packages (so "Visible" and "Recommended" toggles can save)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public'
      AND tablename = 'packages'
      AND policyname = 'admins_can_update_packages'
  ) THEN
    EXECUTE 'CREATE POLICY "admins_can_update_packages" ON public.packages FOR UPDATE USING (has_role(auth.uid(), ''admin''::app_role) OR has_role(auth.uid(), ''super_admin''::app_role)) WITH CHECK (has_role(auth.uid(), ''admin''::app_role) OR has_role(auth.uid(), ''super_admin''::app_role))';
  END IF;
END $$;
