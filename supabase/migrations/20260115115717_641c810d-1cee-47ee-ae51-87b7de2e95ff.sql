-- Enable assists to edit client business + profile data from /dashboard/assist/clients

-- Businesses: allow assists to UPDATE any business row
CREATE POLICY "Assists can update all businesses"
ON public.businesses
FOR UPDATE
USING (has_role(auth.uid(), 'assist'::public.app_role))
WITH CHECK (has_role(auth.uid(), 'assist'::public.app_role));

-- Businesses: allow assists to INSERT business rows (needed if a client has no business row yet)
CREATE POLICY "Assists can insert businesses"
ON public.businesses
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'assist'::public.app_role));

-- Profiles: allow assists to UPDATE profile rows (name/phone etc.)
CREATE POLICY "Assists can update all profiles"
ON public.profiles
FOR UPDATE
USING (has_role(auth.uid(), 'assist'::public.app_role))
WITH CHECK (has_role(auth.uid(), 'assist'::public.app_role));
