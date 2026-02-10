DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'blog_authors'
      AND policyname = 'Public can read blog authors'
  ) THEN
    EXECUTE 'CREATE POLICY "Public can read blog authors" ON public.blog_authors FOR SELECT USING (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'blog_post_categories'
      AND policyname = 'Public can read published blog post categories'
  ) THEN
    EXECUTE 'CREATE POLICY "Public can read published blog post categories" '
      || 'ON public.blog_post_categories FOR SELECT USING ('
      || 'EXISTS (SELECT 1 FROM public.blog_posts p '
      || 'WHERE p.id = blog_post_categories.post_id '
      || 'AND p.deleted_at IS NULL '
      || 'AND p.status = ''published''::public.blog_post_status '
      || 'AND p.visibility = ''public''::public.blog_visibility '
      || 'AND (p.publish_at IS NULL OR p.publish_at <= now()) '
      || 'AND p.no_index = false)'
      || ')';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'blog_post_tags'
      AND policyname = 'Public can read published blog post tags'
  ) THEN
    EXECUTE 'CREATE POLICY "Public can read published blog post tags" '
      || 'ON public.blog_post_tags FOR SELECT USING ('
      || 'EXISTS (SELECT 1 FROM public.blog_posts p '
      || 'WHERE p.id = blog_post_tags.post_id '
      || 'AND p.deleted_at IS NULL '
      || 'AND p.status = ''published''::public.blog_post_status '
      || 'AND p.visibility = ''public''::public.blog_visibility '
      || 'AND (p.publish_at IS NULL OR p.publish_at <= now()) '
      || 'AND p.no_index = false)'
      || ')';
  END IF;
END
$do$;