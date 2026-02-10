-- Enable RLS already true; add policies for media_categories + media_types

DO $$ BEGIN
  -- media_categories
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='media_categories' AND policyname='media_categories_select_authenticated'
  ) THEN
    CREATE POLICY media_categories_select_authenticated
    ON public.media_categories
    FOR SELECT
    USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='media_categories' AND policyname='media_categories_mutate_assist_admin'
  ) THEN
    CREATE POLICY media_categories_mutate_assist_admin
    ON public.media_categories
    FOR ALL
    USING (
      has_role(auth.uid(), 'assist'::public.app_role)
      OR has_role(auth.uid(), 'admin'::public.app_role)
      OR has_role(auth.uid(), 'super_admin'::public.app_role)
    )
    WITH CHECK (
      has_role(auth.uid(), 'assist'::public.app_role)
      OR has_role(auth.uid(), 'admin'::public.app_role)
      OR has_role(auth.uid(), 'super_admin'::public.app_role)
    );
  END IF;

  -- media_types
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='media_types' AND policyname='media_types_select_authenticated'
  ) THEN
    CREATE POLICY media_types_select_authenticated
    ON public.media_types
    FOR SELECT
    USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='media_types' AND policyname='media_types_mutate_assist_admin'
  ) THEN
    CREATE POLICY media_types_mutate_assist_admin
    ON public.media_types
    FOR ALL
    USING (
      has_role(auth.uid(), 'assist'::public.app_role)
      OR has_role(auth.uid(), 'admin'::public.app_role)
      OR has_role(auth.uid(), 'super_admin'::public.app_role)
    )
    WITH CHECK (
      has_role(auth.uid(), 'assist'::public.app_role)
      OR has_role(auth.uid(), 'admin'::public.app_role)
      OR has_role(auth.uid(), 'super_admin'::public.app_role)
    );
  END IF;
END $$;