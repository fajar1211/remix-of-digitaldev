-- Allow admin & super_admin to view admin dashboard data safely

-- PROFILES: add SELECT policy for admin/super_admin
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles' AND policyname='Admins can view all profiles'
  ) THEN
    CREATE POLICY "Admins can view all profiles"
    ON public.profiles
    FOR SELECT
    USING (has_role(auth.uid(), 'admin'::public.app_role) OR has_role(auth.uid(), 'super_admin'::public.app_role));
  END IF;
END $$;

-- BUSINESSES: add SELECT policy for admin/super_admin
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='businesses' AND policyname='Admins can view all businesses'
  ) THEN
    CREATE POLICY "Admins can view all businesses"
    ON public.businesses
    FOR SELECT
    USING (has_role(auth.uid(), 'admin'::public.app_role) OR has_role(auth.uid(), 'super_admin'::public.app_role));
  END IF;
END $$;

-- USER_ROLES: add SELECT policy for admin/super_admin (needed to list assistants/users)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_roles' AND policyname='Admins can view all user roles'
  ) THEN
    CREATE POLICY "Admins can view all user roles"
    ON public.user_roles
    FOR SELECT
    USING (has_role(auth.uid(), 'admin'::public.app_role) OR has_role(auth.uid(), 'super_admin'::public.app_role));
  END IF;
END $$;