-- Remove legacy RapidAPI → Domainr integration secret (no longer used)
DELETE FROM public.integration_secrets
WHERE provider = 'rapidapi_domainr' AND name = 'api_key';
