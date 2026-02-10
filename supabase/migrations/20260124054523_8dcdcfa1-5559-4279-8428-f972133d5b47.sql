-- Set current logged-in user's latest package to pending so UI shows "Awaiting Approval"
UPDATE public.user_packages
SET status = 'pending',
    expires_at = NULL
WHERE user_id = 'dfdca796-0ce3-4043-91ec-fd9064548e51'
  AND id = '6e003482-8d80-4d2a-8684-b591076f4e49';
