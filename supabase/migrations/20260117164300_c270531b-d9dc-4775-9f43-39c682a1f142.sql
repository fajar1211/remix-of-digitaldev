ALTER TABLE public.content_categories
ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

ALTER TABLE public.content_types
ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_content_categories_is_locked ON public.content_categories (is_locked);
CREATE INDEX IF NOT EXISTS idx_content_types_is_locked ON public.content_types (is_locked);