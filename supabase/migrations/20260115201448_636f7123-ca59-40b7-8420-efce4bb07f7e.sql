-- Create a SECURITY DEFINER function to return assist directory (id + name)
-- This bypasses RLS on profiles/user_roles safely because it only exposes minimal fields.

CREATE OR REPLACE FUNCTION public.get_assist_accounts()
RETURNS TABLE (id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = 'assist'::public.app_role
  ORDER BY p.name ASC;
$$;

REVOKE ALL ON FUNCTION public.get_assist_accounts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_assist_accounts() TO authenticated;