-- RPC: return only ACTIVE assistants for assignee dropdowns
-- Keeps UI in sync with /dashboard/super-admin/users-assists which is based on profiles.account_status.
CREATE OR REPLACE FUNCTION public.get_active_assist_accounts()
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.id, p.name
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = 'assist'::public.app_role
    AND p.account_status = 'active'::public.account_status
  ORDER BY p.name ASC;
$$;