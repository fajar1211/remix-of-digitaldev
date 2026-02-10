-- Per-user chat clear markers (hides chat locally without deleting messages)
CREATE TABLE IF NOT EXISTS public.chat_clears (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  peer_id uuid NOT NULL,
  cleared_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_clears_user_peer_unique UNIQUE (user_id, peer_id),
  CONSTRAINT chat_clears_user_not_peer CHECK (user_id <> peer_id)
);

ALTER TABLE public.chat_clears ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  -- SELECT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chat_clears' AND policyname = 'Users can read own chat clears'
  ) THEN
    CREATE POLICY "Users can read own chat clears"
    ON public.chat_clears
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  -- INSERT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chat_clears' AND policyname = 'Users can create own chat clears'
  ) THEN
    CREATE POLICY "Users can create own chat clears"
    ON public.chat_clears
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  -- UPDATE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chat_clears' AND policyname = 'Users can update own chat clears'
  ) THEN
    CREATE POLICY "Users can update own chat clears"
    ON public.chat_clears
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END
$policy$;

DROP TRIGGER IF EXISTS update_chat_clears_updated_at ON public.chat_clears;
CREATE TRIGGER update_chat_clears_updated_at
BEFORE UPDATE ON public.chat_clears
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_chat_clears_user_peer ON public.chat_clears (user_id, peer_id);
CREATE INDEX IF NOT EXISTS idx_chat_clears_user_cleared_at ON public.chat_clears (user_id, cleared_at DESC);