ALTER TABLE public.assist_ai_tools
ADD COLUMN IF NOT EXISTS code_language text NULL,
ADD COLUMN IF NOT EXISTS code_content text NULL;

-- Optional: default empty strings for better UX (keep nullable for backward compatibility)
ALTER TABLE public.assist_ai_tools
ALTER COLUMN code_language SET DEFAULT 'html',
ALTER COLUMN code_content SET DEFAULT '';
