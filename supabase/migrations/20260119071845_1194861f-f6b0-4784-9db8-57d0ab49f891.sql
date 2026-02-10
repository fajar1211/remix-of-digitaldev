ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS blog_author_id UUID NULL;

DO $$ BEGIN
  ALTER TABLE public.blog_posts
    ADD CONSTRAINT blog_posts_blog_author_id_fkey
    FOREIGN KEY (blog_author_id) REFERENCES public.blog_authors(id)
    ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_blog_posts_blog_author_id ON public.blog_posts(blog_author_id);
