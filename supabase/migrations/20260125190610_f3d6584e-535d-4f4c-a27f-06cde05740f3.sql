-- Enable assist users to update tasks (assigned to them or created by them)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'tasks' 
    AND policyname = 'Assist can update assigned tasks'
  ) THEN
    DROP POLICY "Assist can update assigned tasks" ON public.tasks;
  END IF;
END $$;

-- Assist can update tasks assigned to them
CREATE POLICY "Assist can update assigned tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('assist', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('assist', 'super_admin')
  )
);

-- Also ensure assist can delete tasks
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'tasks' 
    AND policyname = 'Assist can delete tasks'
  ) THEN
    DROP POLICY "Assist can delete tasks" ON public.tasks;
  END IF;
END $$;

CREATE POLICY "Assist can delete tasks"
ON public.tasks
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('assist', 'super_admin')
  )
);