-- DomainDuck usage tracking (per API key) for CMS display and enforcement

CREATE TABLE IF NOT EXISTS public.domainduck_api_usage (
  key_hash TEXT PRIMARY KEY,
  used_count INTEGER NOT NULL DEFAULT 0,
  usage_limit INTEGER NOT NULL DEFAULT 250,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.domainduck_api_usage ENABLE ROW LEVEL SECURITY;

-- Keep updated_at in sync
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_domainduck_api_usage_updated_at'
  ) THEN
    CREATE TRIGGER update_domainduck_api_usage_updated_at
    BEFORE UPDATE ON public.domainduck_api_usage
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

-- Atomic increment helper (avoids race conditions)
CREATE OR REPLACE FUNCTION public.increment_domainduck_usage(p_key_hash TEXT)
RETURNS TABLE(used_count INTEGER, usage_limit INTEGER, exhausted BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_used INTEGER;
  v_limit INTEGER;
BEGIN
  -- Ensure row exists
  INSERT INTO public.domainduck_api_usage (key_hash)
  VALUES (p_key_hash)
  ON CONFLICT (key_hash) DO NOTHING;

  -- Increment only if still under limit
  UPDATE public.domainduck_api_usage
  SET used_count = used_count + 1
  WHERE key_hash = p_key_hash
    AND used_count < usage_limit;

  SELECT dau.used_count, dau.usage_limit
  INTO v_used, v_limit
  FROM public.domainduck_api_usage dau
  WHERE dau.key_hash = p_key_hash;

  used_count := v_used;
  usage_limit := v_limit;
  exhausted := (v_used >= v_limit);
  RETURN NEXT;
END;
$$;
