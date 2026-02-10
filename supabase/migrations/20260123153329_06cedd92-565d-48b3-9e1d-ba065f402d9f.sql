-- 1) Extend enum for account statuses (cannot remove existing values)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'account_status'
      AND e.enumlabel = 'pending'
  ) THEN
    ALTER TYPE public.account_status ADD VALUE 'pending';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'account_status'
      AND e.enumlabel = 'approved'
  ) THEN
    ALTER TYPE public.account_status ADD VALUE 'approved';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'account_status'
      AND e.enumlabel = 'suspended'
  ) THEN
    ALTER TYPE public.account_status ADD VALUE 'suspended';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'account_status'
      AND e.enumlabel = 'expired'
  ) THEN
    ALTER TYPE public.account_status ADD VALUE 'expired';
  END IF;
END $$;

-- 2) Update handle_new_user() so role=user defaults to pending
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
      WHEN v_role = 'user'::public.app_role THEN 'pending'::public.account_status
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
$$;