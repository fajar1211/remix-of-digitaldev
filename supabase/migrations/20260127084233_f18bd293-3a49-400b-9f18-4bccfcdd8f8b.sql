-- Allow authenticated users to upload support attachments into the public user-files bucket
-- NOTE: We scope to the `support-attachments/` prefix to avoid granting broad upload access.

-- Create policy: authenticated can upload support attachments
CREATE POLICY "authenticated_can_upload_support_attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-files'
  AND name LIKE 'support-attachments/%'
);

-- Optional: allow authenticated users to update metadata for their uploaded support attachments (kept narrow)
CREATE POLICY "authenticated_can_update_support_attachments"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'user-files'
  AND name LIKE 'support-attachments/%'
)
WITH CHECK (
  bucket_id = 'user-files'
  AND name LIKE 'support-attachments/%'
);

-- Optional: allow authenticated users to delete their uploaded support attachments (kept narrow)
CREATE POLICY "authenticated_can_delete_support_attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-files'
  AND name LIKE 'support-attachments/%'
);