-- Add columns to businesses table for BKB data
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS bkb_content text,
ADD COLUMN IF NOT EXISTS brand_expert_content text,
ADD COLUMN IF NOT EXISTS persona1_title text DEFAULT 'My Persona 1',
ADD COLUMN IF NOT EXISTS persona1_content text,
ADD COLUMN IF NOT EXISTS persona2_title text DEFAULT 'My Persona 2',
ADD COLUMN IF NOT EXISTS persona2_content text,
ADD COLUMN IF NOT EXISTS persona3_title text DEFAULT 'My Persona 3',
ADD COLUMN IF NOT EXISTS persona3_content text;