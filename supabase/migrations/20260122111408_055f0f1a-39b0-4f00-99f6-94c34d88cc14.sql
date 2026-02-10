-- Add explicit deny-all RLS policies to satisfy linter (table is internal/service-role only)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'domainduck_api_usage'
      AND policyname = 'deny_all_select'
  ) THEN
    CREATE POLICY deny_all_select
    ON public.domainduck_api_usage
    FOR SELECT
    USING (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'domainduck_api_usage'
      AND policyname = 'deny_all_insert'
  ) THEN
    CREATE POLICY deny_all_insert
    ON public.domainduck_api_usage
    FOR INSERT
    WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'domainduck_api_usage'
      AND policyname = 'deny_all_update'
  ) THEN
    CREATE POLICY deny_all_update
    ON public.domainduck_api_usage
    FOR UPDATE
    USING (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'domainduck_api_usage'
      AND policyname = 'deny_all_delete'
  ) THEN
    CREATE POLICY deny_all_delete
    ON public.domainduck_api_usage
    FOR DELETE
    USING (false);
  END IF;
END$$;
