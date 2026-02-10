-- Fix ambiguous column reference inside increment_domainduck_usage (used_count clashes with OUT param)
CREATE OR REPLACE FUNCTION public.increment_domainduck_usage(p_key_hash text)
RETURNS TABLE(used_count integer, usage_limit integer, exhausted boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_used INTEGER;
  v_limit INTEGER;
BEGIN
  INSERT INTO public.domainduck_api_usage (key_hash)
  VALUES (p_key_hash)
  ON CONFLICT (key_hash) DO NOTHING;

  UPDATE public.domainduck_api_usage dau
  SET used_count = dau.used_count + 1
  WHERE dau.key_hash = p_key_hash
    AND dau.used_count < dau.usage_limit;

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