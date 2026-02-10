-- Blog CMS tables

-- 1) Enums
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'blog_post_status') THEN
    CREATE TYPE public.blog_post_status AS ENUM (
      'draft',
      'pending_review',
      'private',
      'scheduled',
      'published'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'blog_visibility') THEN
    CREATE TYPE public.blog_visibility AS ENUM ('public', 'private');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'blog_content_type') THEN
    CREATE TYPE public.blog_content_type AS ENUM ('article', 'news', 'update');
  END IF;
END $$;

-- 2) Core table
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,

  title text NOT NULL,
  slug text NOT NULL,
  content_html text NOT NULL,
  excerpt text NULL,

  status public.blog_post_status NOT NULL DEFAULT 'draft',
  visibility public.blog_visibility NOT NULL DEFAULT 'public',
  publish_at timestamptz NULL,
  featured boolean NOT NULL DEFAULT false,
  allow_comments boolean NOT NULL DEFAULT false,
  language text NULL,
  content_type public.blog_content_type NOT NULL DEFAULT 'article',

  featured_image_url text NULL,
  featured_image_alt text NULL,

  meta_title text NULL,
  meta_description text NULL,
  focus_keyword text NULL,
  canonical_url text NULL,
  no_index boolean NOT NULL DEFAULT false,

  reading_time_minutes int NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

-- Ensure unique slug (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_slug_unique_ci
ON public.blog_posts (lower(slug))
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS blog_posts_status_publish_at_idx
ON public.blog_posts (status, publish_at DESC);

CREATE INDEX IF NOT EXISTS blog_posts_author_idx
ON public.blog_posts (author_id);

-- 3) Categories + join
CREATE TABLE IF NOT EXISTS public.blog_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  is_locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS blog_categories_slug_unique_ci
ON public.blog_categories (lower(slug));

CREATE TABLE IF NOT EXISTS public.blog_post_categories (
  post_id uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.blog_categories(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, category_id)
);

CREATE INDEX IF NOT EXISTS blog_post_categories_category_idx
ON public.blog_post_categories (category_id);

-- 4) Tags + join
CREATE TABLE IF NOT EXISTS public.blog_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS blog_tags_slug_unique_ci
ON public.blog_tags (lower(slug));

CREATE TABLE IF NOT EXISTS public.blog_post_tags (
  post_id uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.blog_tags(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, tag_id)
);

CREATE INDEX IF NOT EXISTS blog_post_tags_tag_idx
ON public.blog_post_tags (tag_id);

-- 5) updated_at trigger
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_blog_posts_updated_at'
  ) THEN
    CREATE TRIGGER trg_blog_posts_updated_at
    BEFORE UPDATE ON public.blog_posts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- 6) RLS
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_post_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_post_tags ENABLE ROW LEVEL SECURITY;

-- Helper: treat admin + super_admin as CMS admins
-- Public can read only published & public & not deleted
DROP POLICY IF EXISTS "Public can read published blog posts" ON public.blog_posts;
CREATE POLICY "Public can read published blog posts"
ON public.blog_posts
FOR SELECT
USING (
  deleted_at IS NULL
  AND status = 'published'::public.blog_post_status
  AND visibility = 'public'::public.blog_visibility
  AND (publish_at IS NULL OR publish_at <= now())
  AND no_index = false
);

-- CMS admins can read all
DROP POLICY IF EXISTS "Admins can read all blog posts" ON public.blog_posts;
CREATE POLICY "Admins can read all blog posts"
ON public.blog_posts
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

-- CMS admins can insert/update/delete
DROP POLICY IF EXISTS "Admins can insert blog posts" ON public.blog_posts;
CREATE POLICY "Admins can insert blog posts"
ON public.blog_posts
FOR INSERT
WITH CHECK (
  (public.has_role(auth.uid(), 'admin'::public.app_role)
   OR public.has_role(auth.uid(), 'super_admin'::public.app_role))
  AND author_id = auth.uid()
);

DROP POLICY IF EXISTS "Admins can update blog posts" ON public.blog_posts;
CREATE POLICY "Admins can update blog posts"
ON public.blog_posts
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

DROP POLICY IF EXISTS "Admins can delete blog posts" ON public.blog_posts;
CREATE POLICY "Admins can delete blog posts"
ON public.blog_posts
FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

-- Categories/tags: public read, admins write
DROP POLICY IF EXISTS "Public can read blog categories" ON public.blog_categories;
CREATE POLICY "Public can read blog categories"
ON public.blog_categories
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can manage blog categories" ON public.blog_categories;
CREATE POLICY "Admins can manage blog categories"
ON public.blog_categories
FOR ALL
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

DROP POLICY IF EXISTS "Public can read blog tags" ON public.blog_tags;
CREATE POLICY "Public can read blog tags"
ON public.blog_tags
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can manage blog tags" ON public.blog_tags;
CREATE POLICY "Admins can manage blog tags"
ON public.blog_tags
FOR ALL
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

-- Join tables: admins only
DROP POLICY IF EXISTS "Admins can manage blog_post_categories" ON public.blog_post_categories;
CREATE POLICY "Admins can manage blog_post_categories"
ON public.blog_post_categories
FOR ALL
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

DROP POLICY IF EXISTS "Admins can manage blog_post_tags" ON public.blog_post_tags;
CREATE POLICY "Admins can manage blog_post_tags"
ON public.blog_post_tags
FOR ALL
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);
