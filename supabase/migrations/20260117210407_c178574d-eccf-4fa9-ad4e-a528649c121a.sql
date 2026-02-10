-- Fix: Postgres does not support CREATE POLICY IF NOT EXISTS. Also fix FK reference.

-- Create tables for Media Library categories/types (separate from Content Management)
CREATE TABLE IF NOT EXISTS public.media_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.media_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.media_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_types ENABLE ROW LEVEL SECURITY;

-- Recreate policies (idempotent via DROP)
DROP POLICY IF EXISTS media_categories_select_authenticated ON public.media_categories;
DROP POLICY IF EXISTS media_categories_mutate_assist_admin ON public.media_categories;
DROP POLICY IF EXISTS media_types_select_authenticated ON public.media_types;
DROP POLICY IF EXISTS media_types_mutate_assist_admin ON public.media_types;

CREATE POLICY media_categories_select_authenticated
ON public.media_categories
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY media_types_select_authenticated
ON public.media_types
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY media_categories_mutate_assist_admin
ON public.media_categories
FOR ALL
USING (
  has_role(auth.uid(), 'assist'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'assist'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY media_types_mutate_assist_admin
ON public.media_types
FOR ALL
USING (
  has_role(auth.uid(), 'assist'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'assist'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Extend user_gallery with media category/type
ALTER TABLE public.user_gallery
  ADD COLUMN IF NOT EXISTS media_category_id UUID NULL,
  ADD COLUMN IF NOT EXISTS media_type_id UUID NULL;

-- Foreign keys (optional columns)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_gallery_media_category_id_fkey'
  ) THEN
    ALTER TABLE public.user_gallery
      ADD CONSTRAINT user_gallery_media_category_id_fkey
      FOREIGN KEY (media_category_id) REFERENCES public.media_categories(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_gallery_media_type_id_fkey'
  ) THEN
    ALTER TABLE public.user_gallery
      ADD CONSTRAINT user_gallery_media_type_id_fkey
      FOREIGN KEY (media_type_id) REFERENCES public.media_types(id)
      ON DELETE SET NULL;
  END IF;
END$$;