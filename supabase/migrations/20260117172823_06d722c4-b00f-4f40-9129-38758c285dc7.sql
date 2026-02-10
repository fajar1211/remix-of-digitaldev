-- Soft delete support for content_items
ALTER TABLE public.content_items
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_content_items_deleted_at
ON public.content_items (deleted_at);

CREATE INDEX IF NOT EXISTS idx_content_items_business_deleted
ON public.content_items (business_id, deleted_at);
