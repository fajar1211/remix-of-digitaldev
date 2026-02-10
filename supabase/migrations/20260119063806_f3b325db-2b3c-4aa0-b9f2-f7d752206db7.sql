-- Persisted website media library (for /dashboard/admin/website/media)

CREATE TABLE IF NOT EXISTS public.website_media_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,

  name TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image','video','file')),
  mime_type TEXT NOT NULL,
  size INTEGER,

  url TEXT NOT NULL,
  storage_path TEXT NOT NULL,

  alt_text TEXT,
  is_published BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER
);

ALTER TABLE public.website_media_items ENABLE ROW LEVEL SECURITY;

-- Admin/Super Admin can manage all
DROP POLICY IF EXISTS "Admins can manage website media" ON public.website_media_items;
CREATE POLICY "Admins can manage website media"
ON public.website_media_items
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Public can read published images (for Home page gallery)
DROP POLICY IF EXISTS "Public can read published website gallery" ON public.website_media_items;
CREATE POLICY "Public can read published website gallery"
ON public.website_media_items
FOR SELECT
USING (is_published = true AND media_type = 'image');

-- updated_at trigger
DROP TRIGGER IF EXISTS update_website_media_items_updated_at ON public.website_media_items;
CREATE TRIGGER update_website_media_items_updated_at
BEFORE UPDATE ON public.website_media_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_website_media_items_created_at ON public.website_media_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_website_media_items_published_sort ON public.website_media_items(is_published, sort_order, created_at DESC);

-- Storage policies for uploads/deletes in user-files bucket under website/
-- Note: bucket user-files is public already; we only need write policies for admins.
DROP POLICY IF EXISTS "Admins can upload website media (user-files)" ON storage.objects;
CREATE POLICY "Admins can upload website media (user-files)"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-files'
  AND name LIKE 'website/%'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
);

DROP POLICY IF EXISTS "Admins can update website media (user-files)" ON storage.objects;
CREATE POLICY "Admins can update website media (user-files)"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'user-files'
  AND name LIKE 'website/%'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
)
WITH CHECK (
  bucket_id = 'user-files'
  AND name LIKE 'website/%'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
);

DROP POLICY IF EXISTS "Admins can delete website media (user-files)" ON storage.objects;
CREATE POLICY "Admins can delete website media (user-files)"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-files'
  AND name LIKE 'website/%'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
);
