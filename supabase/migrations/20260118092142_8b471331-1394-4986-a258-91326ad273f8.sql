-- Allow business owners (users) to update their own scheduled content items
-- This matches the existing SELECT policy logic for owners.

CREATE POLICY "content_items_update_owner"
ON public.content_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.businesses b
    WHERE b.id = content_items.business_id
      AND b.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.businesses b
    WHERE b.id = content_items.business_id
      AND b.user_id = auth.uid()
  )
);