-- Add show_on_public flag to packages for controlling public /packages visibility
ALTER TABLE public.packages
ADD COLUMN IF NOT EXISTS show_on_public boolean NOT NULL DEFAULT true;

-- Replace public SELECT policy to also require show_on_public=true
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'packages'
      AND policyname = 'Anyone can view active packages'
  ) THEN
    EXECUTE 'DROP POLICY "Anyone can view active packages" ON public.packages';
  END IF;
END $$;

CREATE POLICY "Anyone can view active public packages"
ON public.packages
FOR SELECT
USING (is_active = true AND show_on_public = true);
