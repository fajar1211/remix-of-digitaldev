-- First deactivate all existing packages
UPDATE packages SET is_active = false;

-- Insert new packages with correct types
INSERT INTO packages (name, type, description, price, features, is_active) VALUES
('Starter', 'starter', 'For brand-new businesses getting found on Google Maps', 300, '["Google Maps (GMB) setup & basic optimization", "Business info optimization (hours, services, call button)", "Local keyword targeting (service + city)", "2 GMB posts / month", "Basic call setup (click-to-call)", "Monthly basic support"]'::jsonb, true),
('Growth', 'growth', 'For new businesses ready to get consistent calls', 400, '["Everything in Starter", "4 GMB posts / month", "Call-to-action optimization", "Review management (response + request strategy)", "Basic local SEO signals", "2 social media posts / month", "Monthly support & performance summary"]'::jsonb, true),
('Pro', 'pro', 'For new businesses ready to build assets and scale', 600, '["Everything in Growth", "8 GMB posts / month", "Conversion-focused website (1–3 pages)", "Local SEO content (2 pieces / month)", "4 social media posts / month", "Priority support", "Monthly performance summary"]'::jsonb, true);