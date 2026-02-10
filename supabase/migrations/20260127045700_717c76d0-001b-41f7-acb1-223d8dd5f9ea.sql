-- 1) Update function to stop referencing profiles.status
CREATE OR REPLACE FUNCTION public.get_assist_contacts()
RETURNS TABLE(id uuid, name text, email text, avatar_url text, status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p.id,
    p.name,
    p.email,
    p.avatar_url,
    COALESCE(p.account_status::text, 'active') AS status
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = 'assist'::public.app_role
  ORDER BY p.name ASC;
$$;

-- 2) Drop legacy column (now unused)
ALTER TABLE public.profiles
DROP COLUMN IF EXISTS status;