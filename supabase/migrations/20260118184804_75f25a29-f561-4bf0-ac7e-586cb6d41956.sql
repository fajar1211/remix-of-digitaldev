-- Allow admin & super_admin to view user package assignments (needed for admin business-users list)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_packages' AND policyname='Admins can view all user packages'
  ) THEN
    CREATE POLICY "Admins can view all user packages"
    ON public.user_packages
    FOR SELECT
    USING (has_role(auth.uid(), 'admin'::public.app_role) OR has_role(auth.uid(), 'super_admin'::public.app_role));
  END IF;
END $$;