-- Ensure RLS is enabled (safe if already enabled)
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- Allow business owners to insert their own business row
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'businesses'
      AND policyname = 'Business owners can insert their business'
  ) THEN
    CREATE POLICY "Business owners can insert their business"
    ON public.businesses
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Allow business owners to update their own business row
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'businesses'
      AND policyname = 'Business owners can update their business'
  ) THEN
    CREATE POLICY "Business owners can update their business"
    ON public.businesses
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;