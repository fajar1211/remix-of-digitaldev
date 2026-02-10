-- Provide a secure, RLS-safe way for normal users to fetch assist contacts for messaging.
-- This avoids directly selecting from public.profiles (which may be restricted by RLS).

CREATE OR REPLACE FUNCTION public.get_assist_contacts()
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  avatar_url text,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.name,
    p.email,
    p.avatar_url,
    COALESCE(p.status, 'active')::text AS status
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = 'assist'::public.app_role
  ORDER BY p.name ASC;
$$;

REVOKE ALL ON FUNCTION public.get_assist_contacts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_assist_contacts() TO authenticated;