-- Sync auth.users.email -> public.profiles.email and public.businesses.email
-- This ensures when a user confirms a new email address, our app tables stay consistent.

CREATE OR REPLACE FUNCTION public.sync_user_email_to_app_tables()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Only act when email actually changes
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles
    SET email = NEW.email,
        updated_at = now()
    WHERE id = NEW.id;

    UPDATE public.businesses
    SET email = NEW.email,
        updated_at = now()
    WHERE user_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  -- Replace trigger if it already exists
  IF EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_sync_user_email_to_app_tables'
  ) THEN
    DROP TRIGGER trg_sync_user_email_to_app_tables ON auth.users;
  END IF;
END$$;

CREATE TRIGGER trg_sync_user_email_to_app_tables
AFTER UPDATE OF email ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_email_to_app_tables();
