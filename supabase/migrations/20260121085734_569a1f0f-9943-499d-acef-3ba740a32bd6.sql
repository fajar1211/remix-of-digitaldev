-- Create package menu rules to control dashboard visibility by package
CREATE TABLE IF NOT EXISTS public.package_menu_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  menu_key TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (package_id, menu_key)
);

ALTER TABLE public.package_menu_rules ENABLE ROW LEVEL SECURITY;

-- Super admins can manage all rules
CREATE POLICY "super_admin_manage_package_menu_rules"
ON public.package_menu_rules
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- Authenticated users can read rules (menu config is not sensitive)
CREATE POLICY "authenticated_can_read_package_menu_rules"
ON public.package_menu_rules
FOR SELECT
TO authenticated
USING (true);

-- Keep updated_at current
DROP TRIGGER IF EXISTS update_package_menu_rules_updated_at ON public.package_menu_rules;
CREATE TRIGGER update_package_menu_rules_updated_at
BEFORE UPDATE ON public.package_menu_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_package_menu_rules_package_id ON public.package_menu_rules(package_id);
CREATE INDEX IF NOT EXISTS idx_package_menu_rules_menu_key ON public.package_menu_rules(menu_key);
