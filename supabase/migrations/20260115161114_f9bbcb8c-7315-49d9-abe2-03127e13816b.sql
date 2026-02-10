-- Fix: allow assists to upload/manage gallery items for any client

-- user_gallery policies
CREATE POLICY "Assists can insert all gallery"
ON public.user_gallery
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'assist'::app_role));

CREATE POLICY "Assists can update all gallery"
ON public.user_gallery
FOR UPDATE
USING (has_role(auth.uid(), 'assist'::app_role))
WITH CHECK (has_role(auth.uid(), 'assist'::app_role));

CREATE POLICY "Assists can delete all gallery"
ON public.user_gallery
FOR DELETE
USING (has_role(auth.uid(), 'assist'::app_role));

-- Storage policies for bucket user-files
CREATE POLICY "Assists can upload to user-files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'user-files'
  AND has_role(auth.uid(), 'assist'::app_role)
);

CREATE POLICY "Assists can update user-files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'user-files'
  AND has_role(auth.uid(), 'assist'::app_role)
)
WITH CHECK (
  bucket_id = 'user-files'
  AND has_role(auth.uid(), 'assist'::app_role)
);

CREATE POLICY "Assists can delete from user-files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'user-files'
  AND has_role(auth.uid(), 'assist'::app_role)
);

CREATE POLICY "Assists can read user-files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'user-files'
  AND has_role(auth.uid(), 'assist'::app_role)
);