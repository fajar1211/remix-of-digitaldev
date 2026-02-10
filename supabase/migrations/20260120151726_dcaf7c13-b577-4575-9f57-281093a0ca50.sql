-- Allow any authenticated user to view active AI tools
-- (prevents anon/public access by requiring auth.uid() is not null)
CREATE POLICY "Authenticated users can view active AI tools"
ON public.assist_ai_tools
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND is_active = true
);
