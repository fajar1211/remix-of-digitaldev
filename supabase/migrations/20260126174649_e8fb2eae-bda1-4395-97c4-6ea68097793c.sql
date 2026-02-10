-- 1) Add max quantity limit per add-on (nullable = unlimited)
ALTER TABLE public.package_add_ons
ADD COLUMN IF NOT EXISTS max_quantity integer;

COMMENT ON COLUMN public.package_add_ons.max_quantity IS 'Maximum quantity selectable for this add-on during onboarding (NULL = unlimited).';

-- 2) Store user selections during onboarding
CREATE TABLE IF NOT EXISTS public.onboarding_add_on_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  add_on_id uuid NOT NULL REFERENCES public.package_add_ons(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, add_on_id)
);

COMMENT ON TABLE public.onboarding_add_on_selections IS 'Selected add-ons and quantities chosen by a user during onboarding.';

-- Validate quantity is non-negative
CREATE OR REPLACE FUNCTION public.validate_onboarding_add_on_quantity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.quantity IS NULL OR NEW.quantity < 0 THEN
    RAISE EXCEPTION 'quantity must be >= 0';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_onboarding_add_on_quantity ON public.onboarding_add_on_selections;
CREATE TRIGGER trg_validate_onboarding_add_on_quantity
BEFORE INSERT OR UPDATE ON public.onboarding_add_on_selections
FOR EACH ROW
EXECUTE FUNCTION public.validate_onboarding_add_on_quantity();

-- updated_at trigger (uses existing helper)
DROP TRIGGER IF EXISTS update_onboarding_add_on_selections_updated_at ON public.onboarding_add_on_selections;
CREATE TRIGGER update_onboarding_add_on_selections_updated_at
BEFORE UPDATE ON public.onboarding_add_on_selections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_onboarding_add_on_selections_user_id
ON public.onboarding_add_on_selections(user_id);

CREATE INDEX IF NOT EXISTS idx_onboarding_add_on_selections_add_on_id
ON public.onboarding_add_on_selections(add_on_id);

-- 3) RLS
ALTER TABLE public.onboarding_add_on_selections ENABLE ROW LEVEL SECURITY;

-- Users manage their own selections
DROP POLICY IF EXISTS users_select_own_onboarding_add_on_selections ON public.onboarding_add_on_selections;
CREATE POLICY users_select_own_onboarding_add_on_selections
ON public.onboarding_add_on_selections
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS users_insert_own_onboarding_add_on_selections ON public.onboarding_add_on_selections;
CREATE POLICY users_insert_own_onboarding_add_on_selections
ON public.onboarding_add_on_selections
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS users_update_own_onboarding_add_on_selections ON public.onboarding_add_on_selections;
CREATE POLICY users_update_own_onboarding_add_on_selections
ON public.onboarding_add_on_selections
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS users_delete_own_onboarding_add_on_selections ON public.onboarding_add_on_selections;
CREATE POLICY users_delete_own_onboarding_add_on_selections
ON public.onboarding_add_on_selections
FOR DELETE
USING (auth.uid() = user_id);

-- Super admin can manage all
DROP POLICY IF EXISTS super_admin_manage_onboarding_add_on_selections ON public.onboarding_add_on_selections;
CREATE POLICY super_admin_manage_onboarding_add_on_selections
ON public.onboarding_add_on_selections
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::public.app_role));
