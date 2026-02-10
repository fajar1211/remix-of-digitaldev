-- Enable Realtime for tables that /packages page listens to
ALTER PUBLICATION supabase_realtime ADD TABLE public.package_durations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.packages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.package_add_ons;