-- Update packages for New Business onboarding
UPDATE packages SET
  description = 'For brand-new businesses getting found on Google Maps',
  price = 300,
  features = '["Google Maps (GMB) setup & basic optimization", "Business info optimization (hours, services, call button)", "Local keyword targeting (service + city)", "2 GMB posts / month", "Basic call setup (click-to-call)", "Monthly basic support"]'::jsonb
WHERE type = 'starter';

UPDATE packages SET
  description = 'For new businesses ready to get consistent calls',
  price = 400,
  features = '["Everything in Starter", "4 GMB posts / month", "Call-to-action optimization", "Review management (response + request strategy)", "Basic local SEO signals", "2 social media posts / month", "Monthly support & performance summary"]'::jsonb
WHERE type = 'growth';

UPDATE packages SET
  description = 'For new businesses ready to build assets and scale',
  price = 600,
  features = '["Everything in Growth", "8 GMB posts / month", "Conversion-focused website (1–3 pages)", "Local SEO content (2 pieces / month)", "4 social media posts / month", "Priority support", "Monthly performance summary"]'::jsonb
WHERE type = 'pro';