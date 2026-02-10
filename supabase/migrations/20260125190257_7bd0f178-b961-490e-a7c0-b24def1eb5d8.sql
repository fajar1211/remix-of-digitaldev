-- Enable admin users to update tasks
-- First, check if policy exists and drop it if needed
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'tasks' 
    AND policyname = 'Admin can update all tasks'
  ) THEN
    DROP POLICY "Admin can update all tasks" ON public.tasks;
  END IF;
END $$;

-- Create policy for admin to update tasks
CREATE POLICY "Admin can update all tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'super_admin')
  )
);

-- Also ensure admin can delete tasks
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'tasks' 
    AND policyname = 'Admin can delete tasks'
  ) THEN
    DROP POLICY "Admin can delete tasks" ON public.tasks;
  END IF;
END $$;

CREATE POLICY "Admin can delete tasks"
ON public.tasks
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'super_admin')
  )
);