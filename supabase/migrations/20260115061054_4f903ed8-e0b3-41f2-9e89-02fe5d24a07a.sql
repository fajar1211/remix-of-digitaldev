-- Add business_address and hours columns to businesses table
ALTER TABLE public.businesses
ADD COLUMN business_address text,
ADD COLUMN hours jsonb DEFAULT '[]'::jsonb;

-- Add business_address and hours columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN business_address text,
ADD COLUMN hours jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.businesses.business_address IS 'Physical business address';
COMMENT ON COLUMN public.businesses.hours IS 'Business operating hours stored as array of {day, opens_at, closes_at}';
COMMENT ON COLUMN public.profiles.business_address IS 'Physical business address';
COMMENT ON COLUMN public.profiles.hours IS 'Business operating hours stored as array of {day, opens_at, closes_at}';