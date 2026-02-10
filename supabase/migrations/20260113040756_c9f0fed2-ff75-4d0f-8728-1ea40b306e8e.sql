-- Add social_links column to profiles table for assist social media storage
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '[]'::jsonb;