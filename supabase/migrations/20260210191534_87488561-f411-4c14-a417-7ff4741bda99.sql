-- Allow public (anon) read access to active package durations for /packages page
CREATE POLICY "anon_can_read_active_package_durations"
  ON public.package_durations
  FOR SELECT
  TO anon
  USING (is_active = true);