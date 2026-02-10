-- Insert the Growing Business packages (Optimize, Scale, Dominate)
INSERT INTO packages (name, type, description, price, features, is_active)
VALUES
  ('Optimize', 'optimize', 'For businesses already listed on Google Maps', 400, 
   '["Google Maps audit & optimization", "Category, service & description optimization", "4 GMB posts / month", "Call-to-action optimization", "Review response strategy", "Monthly performance summary"]'::jsonb, true),
  ('Scale', 'scale', 'For businesses ready to grow faster', 600,
   '["Everything in Optimize", "8 GMB posts / month", "Review management (response + request strategy)", "Basic local SEO signals", "Conversion-focused website optimization (existing site)", "Monthly support & reporting"]'::jsonb, true),
  ('Dominate', 'dominate', 'For competitive local markets', 900,
   '["Everything in Scale", "Advanced Google Maps optimization", "Competitor monitoring", "Local SEO content (4 pieces / month)", "Website content expansion & CRO", "Priority support", "Monthly strategy call"]'::jsonb, true);