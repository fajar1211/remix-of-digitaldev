-- Update existing packages with new pricing and features
UPDATE packages 
SET 
  name = 'Starter',
  description = 'For brand-new businesses getting found on Google Maps',
  price = 300.00,
  features = '["Google Maps (GMB) setup & basic optimization", "Business info optimization (hours, services, call button)", "Local keyword targeting (service + city)", "2 GMB posts / month", "Basic call setup (click-to-call)", "Monthly basic support"]',
  is_active = true
WHERE type = 'starter';

UPDATE packages 
SET 
  name = 'Growth',
  description = 'For new businesses ready to get consistent calls',
  price = 400.00,
  features = '["Everything in Starter", "4 GMB posts / month", "Call-to-action optimization", "Review management (response + request strategy)", "Basic local SEO signals", "2 social media posts / month", "Monthly support & performance summary"]',
  is_active = true
WHERE type = 'growth';

-- Deactivate website package (replaced by Pro)
UPDATE packages SET is_active = false WHERE type = 'website';

-- Insert Pro package
INSERT INTO packages (name, type, description, price, features, is_active) VALUES
(
  'Pro',
  'pro',
  'For new businesses ready to build assets and scale',
  600.00,
  '["Everything in Growth", "8 GMB posts / month", "Conversion-focused website (1-3 pages)", "Local SEO content (2 pieces / month)", "4 social media posts / month", "Priority support", "Monthly performance summary"]',
  true
);