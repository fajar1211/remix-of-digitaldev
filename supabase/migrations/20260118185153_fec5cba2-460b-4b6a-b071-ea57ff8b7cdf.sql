-- Allow admin & super_admin to view tasks (admin dashboard)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='tasks' AND policyname='Admins can view all tasks'
  ) THEN
    CREATE POLICY "Admins can view all tasks"
    ON public.tasks
    FOR SELECT
    USING (has_role(auth.uid(), 'admin'::public.app_role) OR has_role(auth.uid(), 'super_admin'::public.app_role));
  END IF;
END $$;