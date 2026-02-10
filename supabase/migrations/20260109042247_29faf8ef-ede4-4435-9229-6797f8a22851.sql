-- Add BKB content columns to businesses table
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS bkb_content text,
ADD COLUMN IF NOT EXISTS brand_expert_content text,
ADD COLUMN IF NOT EXISTS persona1_content text,
ADD COLUMN IF NOT EXISTS persona1_title text DEFAULT 'My Persona 1',
ADD COLUMN IF NOT EXISTS persona2_content text,
ADD COLUMN IF NOT EXISTS persona2_title text DEFAULT 'My Persona 2',
ADD COLUMN IF NOT EXISTS persona3_content text,
ADD COLUMN IF NOT EXISTS persona3_title text DEFAULT 'My Persona 3';

-- Add task_number column for auto-generated task IDs (T00100, T00101, etc.)
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS task_number integer;

-- Create sequence for task numbers starting at 100
CREATE SEQUENCE IF NOT EXISTS task_number_seq START WITH 100;

-- Create function to auto-generate task number
CREATE OR REPLACE FUNCTION public.set_task_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.task_number IS NULL THEN
    NEW.task_number := nextval('task_number_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to auto-set task number on insert
DROP TRIGGER IF EXISTS set_task_number_trigger ON public.tasks;
CREATE TRIGGER set_task_number_trigger
BEFORE INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.set_task_number();

-- Update existing tasks with task numbers
DO $$
DECLARE
  task_rec RECORD;
  counter INTEGER := 100;
BEGIN
  FOR task_rec IN SELECT id FROM public.tasks WHERE task_number IS NULL ORDER BY created_at LOOP
    UPDATE public.tasks SET task_number = counter WHERE id = task_rec.id;
    counter := counter + 1;
  END LOOP;
  -- Update sequence to start after max task number
  PERFORM setval('task_number_seq', COALESCE((SELECT MAX(task_number) FROM public.tasks), 99) + 1);
END $$;

-- Create task_work_logs table for work tracking
CREATE TABLE IF NOT EXISTS public.task_work_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  time_spent integer, -- in minutes
  work_description text,
  shared_url text,
  file_url text,
  screenshot_url text,
  status text DEFAULT 'in_progress',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on task_work_logs
ALTER TABLE public.task_work_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for task_work_logs
CREATE POLICY "Assists can view all work logs" ON public.task_work_logs
FOR SELECT USING (has_role(auth.uid(), 'assist'::app_role));

CREATE POLICY "Assists can create work logs" ON public.task_work_logs
FOR INSERT WITH CHECK (has_role(auth.uid(), 'assist'::app_role));

CREATE POLICY "Assists can update work logs" ON public.task_work_logs
FOR UPDATE USING (has_role(auth.uid(), 'assist'::app_role));

CREATE POLICY "Users can view their task work logs" ON public.task_work_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.tasks 
    WHERE tasks.id = task_work_logs.task_id 
    AND tasks.user_id = auth.uid()
  )
);

-- Add portfolio columns to profiles table for assists
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS bio text,
ADD COLUMN IF NOT EXISTS portfolio_url text,
ADD COLUMN IF NOT EXISTS skills text[],
ADD COLUMN IF NOT EXISTS experience text,
ADD COLUMN IF NOT EXISTS linkedin_url text,
ADD COLUMN IF NOT EXISTS twitter_url text,
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS location text,
ADD COLUMN IF NOT EXISTS specialization text;