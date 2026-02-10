-- Tighten public INSERT policy (avoid WITH CHECK (true))
DROP POLICY IF EXISTS "Anyone can create website inquiries" ON public.website_inquiries;

CREATE POLICY "Anyone can create website inquiries"
ON public.website_inquiries
FOR INSERT
WITH CHECK (
  char_length(trim(name)) BETWEEN 1 AND 100
  AND char_length(trim(email)) BETWEEN 3 AND 255
  AND position('@' in email) > 1
  AND char_length(trim(subject)) BETWEEN 1 AND 200
  AND char_length(trim(message)) BETWEEN 1 AND 2000
);
