-- Add per-package AI tool visibility rules
CREATE TABLE IF NOT EXISTS public.package_ai_tool_rules (
  package_id uuid NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  tool_id uuid NOT NULL REFERENCES public.assist_ai_tools(id) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT package_ai_tool_rules_pkey PRIMARY KEY (package_id, tool_id)
);

-- Enable RLS
ALTER TABLE public.package_ai_tool_rules ENABLE ROW LEVEL SECURITY;

-- Reusable trigger function (create if missing)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_package_ai_tool_rules_updated_at ON public.package_ai_tool_rules;
CREATE TRIGGER update_package_ai_tool_rules_updated_at
BEFORE UPDATE ON public.package_ai_tool_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Policies: super_admin only
DROP POLICY IF EXISTS "Super admins can read package_ai_tool_rules" ON public.package_ai_tool_rules;
CREATE POLICY "Super admins can read package_ai_tool_rules"
ON public.package_ai_tool_rules
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
  )
);

DROP POLICY IF EXISTS "Super admins can insert package_ai_tool_rules" ON public.package_ai_tool_rules;
CREATE POLICY "Super admins can insert package_ai_tool_rules"
ON public.package_ai_tool_rules
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
  )
);

DROP POLICY IF EXISTS "Super admins can update package_ai_tool_rules" ON public.package_ai_tool_rules;
CREATE POLICY "Super admins can update package_ai_tool_rules"
ON public.package_ai_tool_rules
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
  )
);

DROP POLICY IF EXISTS "Super admins can delete package_ai_tool_rules" ON public.package_ai_tool_rules;
CREATE POLICY "Super admins can delete package_ai_tool_rules"
ON public.package_ai_tool_rules
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
  )
);

-- Helpful index
CREATE INDEX IF NOT EXISTS idx_package_ai_tool_rules_package
ON public.package_ai_tool_rules(package_id);
