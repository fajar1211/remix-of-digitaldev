-- Add Marketing Setup fields to businesses
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS marketing_goal_type text,
ADD COLUMN IF NOT EXISTS marketing_goal_text text,
ADD COLUMN IF NOT EXISTS primary_service text,
ADD COLUMN IF NOT EXISTS secondary_services jsonb NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS service_short_description text,
ADD COLUMN IF NOT EXISTS service_area text;

-- Optional indexes for filtering/searching later
CREATE INDEX IF NOT EXISTS businesses_marketing_goal_type_idx ON public.businesses (marketing_goal_type);
CREATE INDEX IF NOT EXISTS businesses_primary_service_idx ON public.businesses (primary_service);