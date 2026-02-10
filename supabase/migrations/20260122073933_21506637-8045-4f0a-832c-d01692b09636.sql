-- Cleanup legacy integration secrets (remove master key + generic encrypted keys)
DELETE FROM public.integration_secrets
WHERE NOT (provider = 'domainr' AND name = 'api_key');

-- Ensure Domainr key (if present) is stored as plaintext for the new flow
UPDATE public.integration_secrets
SET iv = 'plain'
WHERE provider = 'domainr' AND name = 'api_key' AND iv IS DISTINCT FROM 'plain';