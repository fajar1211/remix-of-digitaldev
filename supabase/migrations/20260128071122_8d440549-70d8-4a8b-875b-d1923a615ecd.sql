-- Fix duplicate task_number (108,107) then ensure unique sequence

-- Ensure sequence exists and set to next available value
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'S'
      AND c.relname = 'task_number_seq'
      AND n.nspname = 'public'
  ) THEN
    EXECUTE format(
      'CREATE SEQUENCE public.task_number_seq START WITH %s INCREMENT BY 1 MINVALUE 1;',
      (SELECT COALESCE(MAX(task_number), 99) + 1 FROM public.tasks)
    );
  ELSE
    -- Reset sequence to next safe value
    EXECUTE format(
      'SELECT setval(''public.task_number_seq'', %s, false);',
      (SELECT COALESCE(MAX(task_number), 99) + 1 FROM public.tasks)
    );
  END IF;
END $$;

-- Backfill NULL task_numbers
UPDATE public.tasks
SET task_number = nextval('public.task_number_seq')
WHERE task_number IS NULL;

-- Re-number duplicates: keep earliest created row, re-number extras
WITH ranked AS (
  SELECT id,
         task_number,
         row_number() OVER (PARTITION BY task_number ORDER BY created_at, id) AS rn
  FROM public.tasks
  WHERE task_number IS NOT NULL
)
UPDATE public.tasks t
SET task_number = nextval('public.task_number_seq')
FROM ranked r
WHERE t.id = r.id
  AND r.rn > 1;

-- Now create unique index (no more duplicates exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'tasks_task_number_unique'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX tasks_task_number_unique ON public.tasks (task_number) WHERE task_number IS NOT NULL;';
  END IF;
END $$;

-- Ensure trigger exists (auto-assign task_number on insert)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_task_number_before_insert'
  ) THEN
    EXECUTE 'CREATE TRIGGER set_task_number_before_insert BEFORE INSERT ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_task_number();';
  END IF;
END $$;
