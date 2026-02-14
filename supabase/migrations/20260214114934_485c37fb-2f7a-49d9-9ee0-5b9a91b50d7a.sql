-- Allow super_admin to update any user_packages row (for setting expire dates etc.)
CREATE POLICY "Super admins can update all user packages"
ON public.user_packages
FOR UPDATE
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Allow admins to update all user_packages row
CREATE POLICY "Admins can update all user packages"
ON public.user_packages
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));