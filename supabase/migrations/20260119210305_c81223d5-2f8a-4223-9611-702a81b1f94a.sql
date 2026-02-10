-- Create table for public website inquiries (from /contact)
CREATE TABLE IF NOT EXISTS public.website_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  source text NOT NULL DEFAULT 'contact_form',
  user_agent text NULL,
  ip inet NULL
);

CREATE INDEX IF NOT EXISTS idx_website_inquiries_created_at ON public.website_inquiries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_website_inquiries_status ON public.website_inquiries (status);

ALTER TABLE public.website_inquiries ENABLE ROW LEVEL SECURITY;

-- Recreate policies (Postgres doesn't support CREATE POLICY IF NOT EXISTS)
DROP POLICY IF EXISTS "Anyone can create website inquiries" ON public.website_inquiries;
DROP POLICY IF EXISTS "Admins can read website inquiries" ON public.website_inquiries;
DROP POLICY IF EXISTS "Admins can update website inquiries" ON public.website_inquiries;
DROP POLICY IF EXISTS "Admins can delete website inquiries" ON public.website_inquiries;

CREATE POLICY "Anyone can create website inquiries"
ON public.website_inquiries
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can read website inquiries"
ON public.website_inquiries
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can update website inquiries"
ON public.website_inquiries
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can delete website inquiries"
ON public.website_inquiries
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
