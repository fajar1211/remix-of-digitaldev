-- Create table for Assist AI Tools
CREATE TABLE IF NOT EXISTS public.assist_ai_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT 'Sparkles',
  color text NOT NULL DEFAULT 'bg-primary/10 text-primary',
  json_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  iframe_url text NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Helpful index
CREATE INDEX IF NOT EXISTS idx_assist_ai_tools_created_by ON public.assist_ai_tools(created_by);

-- Enable RLS
ALTER TABLE public.assist_ai_tools ENABLE ROW LEVEL SECURITY;

-- Policies: owner can CRUD their tools
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='assist_ai_tools' AND policyname='Assist can view own AI tools'
  ) THEN
    CREATE POLICY "Assist can view own AI tools"
    ON public.assist_ai_tools
    FOR SELECT
    USING (auth.uid() = created_by);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='assist_ai_tools' AND policyname='Assist can create own AI tools'
  ) THEN
    CREATE POLICY "Assist can create own AI tools"
    ON public.assist_ai_tools
    FOR INSERT
    WITH CHECK (auth.uid() = created_by);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='assist_ai_tools' AND policyname='Assist can update own AI tools'
  ) THEN
    CREATE POLICY "Assist can update own AI tools"
    ON public.assist_ai_tools
    FOR UPDATE
    USING (auth.uid() = created_by)
    WITH CHECK (auth.uid() = created_by);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='assist_ai_tools' AND policyname='Assist can delete own AI tools'
  ) THEN
    CREATE POLICY "Assist can delete own AI tools"
    ON public.assist_ai_tools
    FOR DELETE
    USING (auth.uid() = created_by);
  END IF;
END $$;

-- updated_at trigger
DROP TRIGGER IF EXISTS update_assist_ai_tools_updated_at ON public.assist_ai_tools;
CREATE TRIGGER update_assist_ai_tools_updated_at
BEFORE UPDATE ON public.assist_ai_tools
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
