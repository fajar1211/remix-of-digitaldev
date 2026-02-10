-- Sync profiles.account_status/payment_active from user_packages changes

CREATE OR REPLACE FUNCTION public.sync_profile_status_from_user_packages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_current boolean;
  is_expired boolean;
BEGIN
  -- Determine whether this package is currently active by timestamps.
  is_current := NEW.activated_at IS NOT NULL
               AND (NEW.expires_at IS NULL OR NEW.expires_at > now());

  is_expired := NEW.expires_at IS NOT NULL AND NEW.expires_at <= now();

  -- If a package becomes current/active, mark profile active + paid.
  IF is_current THEN
    UPDATE public.profiles p
      SET account_status = 'active',
          payment_active = true,
          updated_at = now()
    WHERE p.id = NEW.user_id
      AND p.account_status NOT IN ('suspended', 'blacklisted');

    RETURN NEW;
  END IF;

  -- If a package is expired, mark profile expired (only if currently active).
  IF is_expired THEN
    UPDATE public.profiles p
      SET account_status = 'expired',
          payment_active = false,
          updated_at = now()
    WHERE p.id = NEW.user_id
      AND p.account_status = 'active';

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_status_from_user_packages ON public.user_packages;

CREATE TRIGGER trg_sync_profile_status_from_user_packages
AFTER INSERT OR UPDATE OF activated_at, expires_at
ON public.user_packages
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_status_from_user_packages();


-- Update RLS to stop depending on user_packages.status='active'
DO $$
BEGIN
  -- Old policy name from existing schema
  EXECUTE 'DROP POLICY IF EXISTS authenticated_can_read_own_active_package_ai_tool_rules ON public.package_ai_tool_rules';
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END $$;

CREATE POLICY authenticated_can_read_own_active_package_ai_tool_rules
ON public.package_ai_tool_rules
FOR SELECT
TO authenticated
USING (
  package_id IN (
    SELECT up.package_id
    FROM public.user_packages up
    WHERE up.user_id = auth.uid()
      AND up.activated_at IS NOT NULL
      AND (up.expires_at IS NULL OR up.expires_at > now())
  )
);
