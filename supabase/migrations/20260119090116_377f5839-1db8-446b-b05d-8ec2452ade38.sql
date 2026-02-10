-- FAQ items for public pages (packages/services etc.)
CREATE TABLE IF NOT EXISTS public.website_faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page text NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_website_faqs_page_order
  ON public.website_faqs (page, sort_order, created_at);

ALTER TABLE public.website_faqs ENABLE ROW LEVEL SECURITY;

-- Public read (only published)
DROP POLICY IF EXISTS "Public can read published website faqs" ON public.website_faqs;
CREATE POLICY "Public can read published website faqs"
ON public.website_faqs
FOR SELECT
USING (is_published = true);

-- Admin CRUD
DROP POLICY IF EXISTS "Admins can insert website faqs" ON public.website_faqs;
CREATE POLICY "Admins can insert website faqs"
ON public.website_faqs
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

DROP POLICY IF EXISTS "Admins can update website faqs" ON public.website_faqs;
CREATE POLICY "Admins can update website faqs"
ON public.website_faqs
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

DROP POLICY IF EXISTS "Admins can delete website faqs" ON public.website_faqs;
CREATE POLICY "Admins can delete website faqs"
ON public.website_faqs
FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

-- updated_at trigger
DROP TRIGGER IF EXISTS update_website_faqs_updated_at ON public.website_faqs;
CREATE TRIGGER update_website_faqs_updated_at
BEFORE UPDATE ON public.website_faqs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();