-- Allow public (anon) read access to active package add-ons for order pages
CREATE POLICY "anon_can_read_active_package_add_ons"
  ON public.package_add_ons
  FOR SELECT
  TO anon
  USING (is_active = true);