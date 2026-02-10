-- Add attachment metadata to support tickets (website_inquiries)
ALTER TABLE public.website_inquiries
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_mime text,
  ADD COLUMN IF NOT EXISTS attachment_size bigint;

-- Helpful indexes for sorting/filtering
CREATE INDEX IF NOT EXISTS website_inquiries_created_at_idx ON public.website_inquiries (created_at DESC);
CREATE INDEX IF NOT EXISTS website_inquiries_source_idx ON public.website_inquiries (source);
CREATE INDEX IF NOT EXISTS website_inquiries_status_idx ON public.website_inquiries (status);