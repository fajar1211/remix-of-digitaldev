-- Ensure task_number auto-generation starts at 101 (T00101) and is unique, and allow users to create/update their own tasks.

-- 1) Sequence for task numbers
CREATE SEQUENCE IF NOT EXISTS public.task_number_seq START WITH 101;

-- If the sequence already exists, align it to be > current max(task_number) and at least 101
DO $$
DECLARE
  next_val bigint;
BEGIN
  SELECT GREATEST(COALESCE((SELECT MAX(task_number) FROM public.tasks), 100) + 1, 101) INTO next_val;
  PERFORM setval('public.task_number_seq', next_val, false);
END $$;

-- 2) Trigger function to set task_number if missing
CREATE OR REPLACE FUNCTION public.set_task_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.task_number IS NULL THEN
    NEW.task_number := nextval('public.task_number_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3) Trigger on insert
DROP TRIGGER IF EXISTS set_task_number_trigger ON public.tasks;
CREATE TRIGGER set_task_number_trigger
BEFORE INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.set_task_number();

-- 4) Backfill any existing NULL task_number values (if any)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.tasks WHERE task_number IS NULL ORDER BY created_at LOOP
    UPDATE public.tasks
    SET task_number = nextval('public.task_number_seq')
    WHERE id = r.id;
  END LOOP;
END $$;

-- 5) Enforce uniqueness at the database level
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tasks_task_number_unique'
      AND conrelid = 'public.tasks'::regclass
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_task_number_unique UNIQUE (task_number);
  END IF;
END $$;

-- 6) RLS: allow authenticated users to create/update their own tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Insert policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tasks'
      AND policyname = 'Users can insert own tasks'
  ) THEN
    CREATE POLICY "Users can insert own tasks"
    ON public.tasks
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Update policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tasks'
      AND policyname = 'Users can update own tasks'
  ) THEN
    CREATE POLICY "Users can update own tasks"
    ON public.tasks
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
