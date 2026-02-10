-- Create work log delete request table
CREATE TABLE IF NOT EXISTS public.work_log_delete_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_log_id uuid NOT NULL,
  task_id uuid NOT NULL,
  requester_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  decided_by uuid NULL,
  decided_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.work_log_delete_requests ENABLE ROW LEVEL SECURITY;

-- Ensure updated_at is maintained
DROP TRIGGER IF EXISTS update_work_log_delete_requests_updated_at ON public.work_log_delete_requests;
CREATE TRIGGER update_work_log_delete_requests_updated_at
BEFORE UPDATE ON public.work_log_delete_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: Assists can create requests (only for themselves)
DROP POLICY IF EXISTS "Assists can create work log delete requests" ON public.work_log_delete_requests;
CREATE POLICY "Assists can create work log delete requests"
ON public.work_log_delete_requests
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'assist'::public.app_role)
  AND auth.uid() = requester_id
);

-- RLS: Requester (assist) can view their own requests
DROP POLICY IF EXISTS "Requesters can view their own delete requests" ON public.work_log_delete_requests;
CREATE POLICY "Requesters can view their own delete requests"
ON public.work_log_delete_requests
FOR SELECT
USING (auth.uid() = requester_id);

-- RLS: Owner (business user) can view requests for their tasks
DROP POLICY IF EXISTS "Owners can view delete requests for their tasks" ON public.work_log_delete_requests;
CREATE POLICY "Owners can view delete requests for their tasks"
ON public.work_log_delete_requests
FOR SELECT
USING (auth.uid() = owner_id);

-- RLS: Owner can approve/reject
DROP POLICY IF EXISTS "Owners can decide delete requests" ON public.work_log_delete_requests;
CREATE POLICY "Owners can decide delete requests"
ON public.work_log_delete_requests
FOR UPDATE
USING (auth.uid() = owner_id)
WITH CHECK (
  auth.uid() = owner_id
  AND status IN ('approved','rejected')
  AND decided_by = auth.uid()
);

-- Allow business owner to delete work logs that belong to their tasks
ALTER TABLE public.task_work_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can delete their task work logs" ON public.task_work_logs;
CREATE POLICY "Owners can delete their task work logs"
ON public.task_work_logs
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.tasks
    WHERE tasks.id = task_work_logs.task_id
      AND tasks.user_id = auth.uid()
  )
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_work_log_delete_requests_owner_id ON public.work_log_delete_requests (owner_id);
CREATE INDEX IF NOT EXISTS idx_work_log_delete_requests_work_log_id ON public.work_log_delete_requests (work_log_id);
CREATE INDEX IF NOT EXISTS idx_work_log_delete_requests_status ON public.work_log_delete_requests (status);
