-- Super admin audit logs (service-role write only)
CREATE TABLE IF NOT EXISTS public.super_admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid NOT NULL,
  action text NOT NULL,
  provider text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.super_admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- No access from client roles; edge functions (service role) bypass RLS.
CREATE POLICY "deny_all_select_super_admin_audit_logs"
ON public.super_admin_audit_logs
FOR SELECT
USING (false);

CREATE POLICY "deny_all_insert_super_admin_audit_logs"
ON public.super_admin_audit_logs
FOR INSERT
WITH CHECK (false);

CREATE POLICY "deny_all_update_super_admin_audit_logs"
ON public.super_admin_audit_logs
FOR UPDATE
USING (false);

CREATE POLICY "deny_all_delete_super_admin_audit_logs"
ON public.super_admin_audit_logs
FOR DELETE
USING (false);

CREATE INDEX IF NOT EXISTS idx_super_admin_audit_logs_created_at
ON public.super_admin_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_super_admin_audit_logs_actor
ON public.super_admin_audit_logs (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_super_admin_audit_logs_provider
ON public.super_admin_audit_logs (provider, created_at DESC);