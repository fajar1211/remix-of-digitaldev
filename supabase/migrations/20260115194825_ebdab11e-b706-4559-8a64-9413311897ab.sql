-- Add new task status values to align with app standards
DO $$
BEGIN
  -- Add 'assigned'
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'task_status'
      AND e.enumlabel = 'assigned'
  ) THEN
    ALTER TYPE public.task_status ADD VALUE 'assigned' AFTER 'pending';
  END IF;

  -- Add 'ready_for_review'
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'task_status'
      AND e.enumlabel = 'ready_for_review'
  ) THEN
    ALTER TYPE public.task_status ADD VALUE 'ready_for_review' BEFORE 'completed';
  END IF;
END$$;