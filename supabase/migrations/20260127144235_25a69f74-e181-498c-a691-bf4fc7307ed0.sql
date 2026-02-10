-- Fix: Postgres doesn't support CREATE POLICY IF NOT EXISTS
-- Ensure admins/super_admins can INSERT into tasks

DROP POLICY IF EXISTS "Admins can insert tasks" ON public.tasks;

CREATE POLICY "Admins can insert tasks"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::public.app_role)
  OR has_role(auth.uid(), 'super_admin'::public.app_role)
);
