-- Add optional secondary contact fields (max 2 emails + 2 phone numbers)

ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS email_secondary text;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone_secondary text;