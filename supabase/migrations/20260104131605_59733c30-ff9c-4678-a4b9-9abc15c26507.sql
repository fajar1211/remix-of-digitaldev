-- Create content type enum
CREATE TYPE public.content_type AS ENUM ('blog', 'social_media', 'email_marketing', 'others');

-- Create social media platform enum
CREATE TYPE public.social_media_platform AS ENUM ('facebook', 'instagram', 'x', 'threads', 'linkedin');

-- Create task type enum
CREATE TYPE public.task_type AS ENUM ('blog', 'social_media', 'email_marketing', 'ads', 'others');

-- Create user_content table
CREATE TABLE public.user_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content_type content_type NOT NULL,
  platform social_media_platform,
  idea TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on user_content
ALTER TABLE public.user_content ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_content
CREATE POLICY "Users can view their own content"
ON public.user_content FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own content"
ON public.user_content FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own content"
ON public.user_content FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own content"
ON public.user_content FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Assists can view all content"
ON public.user_content FOR SELECT
USING (has_role(auth.uid(), 'assist'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_user_content_updated_at
BEFORE UPDATE ON public.user_content
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create user_gallery table
CREATE TABLE public.user_gallery (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on user_gallery
ALTER TABLE public.user_gallery ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_gallery
CREATE POLICY "Users can view their own gallery"
ON public.user_gallery FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert to their own gallery"
ON public.user_gallery FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete from their own gallery"
ON public.user_gallery FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Assists can view all gallery"
ON public.user_gallery FOR SELECT
USING (has_role(auth.uid(), 'assist'::app_role));

-- Create storage bucket for user files
INSERT INTO storage.buckets (id, name, public) VALUES ('user-files', 'user-files', true);

-- Storage policies
CREATE POLICY "Users can upload their own files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'user-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own files"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
USING (bucket_id = 'user-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public can view user files"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-files');

-- Add new columns to tasks table
ALTER TABLE public.tasks 
ADD COLUMN type task_type,
ADD COLUMN platform social_media_platform,
ADD COLUMN file_url TEXT,
ADD COLUMN deadline TIMESTAMP WITH TIME ZONE;