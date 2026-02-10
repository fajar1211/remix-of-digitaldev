-- Allow authenticated users to read AI tool rules for their own active package
-- This enables per-tool gating in /dashboard/user/ai-agents and /dashboard/assist/ai-agents

CREATE POLICY "authenticated_can_read_own_active_package_ai_tool_rules"
ON public.package_ai_tool_rules
FOR SELECT
TO authenticated
USING (
  package_id IN (
    SELECT up.package_id
    FROM public.user_packages up
    WHERE up.user_id = auth.uid()
      AND up.status = 'active'
  )
);
