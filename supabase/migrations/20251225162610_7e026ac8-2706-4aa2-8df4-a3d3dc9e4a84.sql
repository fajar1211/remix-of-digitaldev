-- Create enum for business stage
CREATE TYPE public.business_stage AS ENUM ('new', 'growing');

-- Create enum for package type
CREATE TYPE public.package_type AS ENUM ('starter', 'growth', 'website', 'monthly');

-- Create enum for task status
CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'completed');

-- Create businesses table
CREATE TABLE public.businesses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  business_type TEXT,
  location TEXT,
  stage business_stage,
  has_website BOOLEAN DEFAULT false,
  has_gmb BOOLEAN DEFAULT false,
  has_social_media BOOLEAN DEFAULT false,
  website_url TEXT,
  gmb_link TEXT,
  social_media_links JSONB DEFAULT '[]'::jsonb,
  main_goal TEXT,
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create packages table (available packages)
CREATE TABLE public.packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type package_type NOT NULL UNIQUE,
  description TEXT,
  features JSONB DEFAULT '[]'::jsonb,
  price DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_packages table (user's active packages)
CREATE TABLE public.user_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status task_status DEFAULT 'pending',
  notes TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create messages table
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  file_url TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create invoices table
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id UUID REFERENCES public.packages(id),
  amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending',
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Businesses policies
CREATE POLICY "Users can view their own business" ON public.businesses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own business" ON public.businesses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own business" ON public.businesses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Assists can view all businesses" ON public.businesses FOR SELECT USING (has_role(auth.uid(), 'assist'::app_role));

-- Packages policies (public read)
CREATE POLICY "Anyone can view active packages" ON public.packages FOR SELECT USING (is_active = true);

-- User packages policies
CREATE POLICY "Users can view their own packages" ON public.user_packages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own packages" ON public.user_packages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Assists can view all user packages" ON public.user_packages FOR SELECT USING (has_role(auth.uid(), 'assist'::app_role));

-- Tasks policies
CREATE POLICY "Users can view their own tasks" ON public.tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Assists can view all tasks" ON public.tasks FOR SELECT USING (has_role(auth.uid(), 'assist'::app_role));
CREATE POLICY "Assists can insert tasks" ON public.tasks FOR INSERT WITH CHECK (has_role(auth.uid(), 'assist'::app_role));
CREATE POLICY "Assists can update tasks" ON public.tasks FOR UPDATE USING (has_role(auth.uid(), 'assist'::app_role));

-- Messages policies
CREATE POLICY "Users can view their own messages" ON public.messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can mark messages as read" ON public.messages FOR UPDATE USING (auth.uid() = receiver_id);

-- Invoices policies
CREATE POLICY "Users can view their own invoices" ON public.invoices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Assists can view all invoices" ON public.invoices FOR SELECT USING (has_role(auth.uid(), 'assist'::app_role));
CREATE POLICY "Assists can create invoices" ON public.invoices FOR INSERT WITH CHECK (has_role(auth.uid(), 'assist'::app_role));
CREATE POLICY "Assists can update invoices" ON public.invoices FOR UPDATE USING (has_role(auth.uid(), 'assist'::app_role));

-- Add triggers for updated_at
CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default packages
INSERT INTO public.packages (name, type, description, features, price) VALUES
('Starter Package', 'starter', 'Perfect for new businesses getting started with digital marketing', '["Google Business Profile Setup", "Basic Social Media Setup", "Business Listing Optimization", "1 Month Support"]', 299.00),
('Growth Package', 'growth', 'For active businesses looking to expand their reach', '["Monthly Social Media Posts", "GMB Optimization", "Content Calendar", "Lead Generation Setup", "Monthly Analytics Report"]', 499.00),
('Website Package', 'website', 'Professional website development for your business', '["Custom Website Design", "Mobile Responsive", "SEO Optimization", "Contact Forms", "Google Analytics Setup"]', 799.00),
('Monthly Marketing Assist', 'monthly', 'Ongoing marketing support for your business', '["Dedicated Marketing Assist", "Weekly Content Updates", "Social Media Management", "Performance Tracking", "Priority Support"]', 399.00);