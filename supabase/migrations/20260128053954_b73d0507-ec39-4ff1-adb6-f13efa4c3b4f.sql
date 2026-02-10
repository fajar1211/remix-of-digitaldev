-- Ensure newly created ASSIST accounts start as PENDING (not ACTIVE)

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.app_role;
BEGIN
  v_role := COALESCE((NEW.raw_user_meta_data ->> 'role')::public.app_role, 'user'::public.app_role);

  INSERT INTO public.profiles (id, name, email, account_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
    NEW.email,
    CASE
      WHEN v_role IN ('user'::public.app_role, 'assist'::public.app_role) THEN 'pending'::public.account_status
      ELSE 'active'::public.account_status
    END
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    v_role
  );

  RETURN NEW;
END;
$function$;