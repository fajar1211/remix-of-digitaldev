-- Fix onboarding insert/update for businesses: allow the owner to write even when account_status is still 'pending'.
-- Existing restrictive policies include is_account_active(auth.uid()) which blocks onboarding.

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- Replace the restrictive owner INSERT policy
DROP POLICY IF EXISTS "Users can insert own business" ON public.businesses;
CREATE POLICY "Users can insert own business"
ON public.businesses
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Replace the restrictive owner UPDATE policy
DROP POLICY IF EXISTS "Users can update own business" ON public.businesses;
CREATE POLICY "Users can update own business"
ON public.businesses
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);