-- Add missing fields requested by View Details UI
ALTER TABLE public.content_items
ADD COLUMN IF NOT EXISTS platform TEXT,
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- Optional indexes for filtering/sorting
CREATE INDEX IF NOT EXISTS idx_content_items_scheduled_at ON public.content_items (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_content_items_platform ON public.content_items (platform);
