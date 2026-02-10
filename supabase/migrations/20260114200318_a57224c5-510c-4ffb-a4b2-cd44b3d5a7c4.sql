-- Allow assists to view all businesses for task assignment
CREATE POLICY "Assists can view all businesses"
ON public.businesses
FOR SELECT
USING (has_role(auth.uid(), 'assist'::app_role));