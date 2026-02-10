import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, Clock } from "lucide-react";
import { format } from "date-fns";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { applySeoMeta } from "@/lib/seo";

type BlogPostRow = {
  id: string;
  title: string;
  slug: string;
  content_html: string;
  excerpt: string | null;
  created_at: string;
  publish_at: string | null;
  reading_time_minutes: number | null;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  author: string;
  categories: string[];
  tags: string[];
  meta_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
};

export default function BlogPost() {
  const { slug } = useParams();
  const [post, setPost] = useState<BlogPostRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setNotFound(false);

      const { data, error } = await supabase
        .from("blog_posts")
        .select(
          "id,title,slug,content_html,excerpt,created_at,publish_at,reading_time_minutes,featured_image_url,featured_image_alt,meta_title,meta_description,canonical_url,blog_authors(name),blog_post_categories(blog_categories(name)),blog_post_tags(blog_tags(name))"
        )
        .eq("slug", slug)
        .eq("status", "published")
        .eq("visibility", "public")
        .is("deleted_at", null)
        .eq("no_index", false)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("Failed to load blog post", error);
        setPost(null);
        setNotFound(true);
      } else if (!data) {
        setPost(null);
        setNotFound(true);
      } else {
        const row: any = data;
        const author = row?.blog_authors?.name ?? "-";
        const categories = (row?.blog_post_categories ?? [])
          .map((x: any) => x?.blog_categories?.name)
          .filter(Boolean);
        const tags = (row?.blog_post_tags ?? []).map((x: any) => x?.blog_tags?.name).filter(Boolean);

        setPost({
          id: row.id,
          title: row.title,
          slug: row.slug,
          content_html: row.content_html,
          excerpt: row.excerpt,
          created_at: row.created_at,
          publish_at: row.publish_at,
          reading_time_minutes: row.reading_time_minutes,
          featured_image_url: row.featured_image_url,
          featured_image_alt: row.featured_image_alt,
          author,
          categories,
          tags,
          meta_title: row.meta_title,
          meta_description: row.meta_description,
          canonical_url: row.canonical_url,
        });
      }

      setLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!post) return;

    const title = post.meta_title || post.title;
    const description = post.meta_description || post.excerpt || "";
    const canonicalHref = post.canonical_url || `${window.location.origin}/blog/${post.slug}`;

    applySeoMeta({
      title,
      description,
      canonicalUrl: canonicalHref,
      og: {
        type: "article",
        title,
        description,
        url: canonicalHref,
        imageUrl: post.featured_image_url,
        imageAlt: post.featured_image_alt || post.title,
      },
    });
  }, [post]);

  const publishedDate = useMemo(() => {
    if (!post) return null;
    return post.publish_at ?? post.created_at;
  }, [post]);

  const dateLabel = useMemo(() => {
    if (!publishedDate) return "";
    return format(new Date(publishedDate), "MMM d, yyyy");
  }, [publishedDate]);

  const readTimeLabel = useMemo(() => {
    if (!post?.reading_time_minutes) return "";
    return `${post.reading_time_minutes} min read`;
  }, [post?.reading_time_minutes]);

  return (
    <PublicLayout>
      <section className="py-10 md:py-14">
        <div className="container">
          <Button asChild variant="ghost" className="mb-6">
            <Link to="/blog">
              <ArrowLeft />
              Back to Blog
            </Link>
          </Button>

          {loading ? (
            <Card className="shadow-soft">
              <div className="aspect-video bg-muted animate-pulse" />
              <CardHeader className="space-y-3">
                <div className="h-5 w-24 rounded bg-muted animate-pulse" />
                <div className="h-8 w-4/5 rounded bg-muted animate-pulse" />
                <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-4 w-full rounded bg-muted animate-pulse" />
                <div className="mt-2 h-4 w-11/12 rounded bg-muted animate-pulse" />
                <div className="mt-2 h-4 w-10/12 rounded bg-muted animate-pulse" />
              </CardContent>
            </Card>
          ) : notFound ? (
            <Card className="shadow-soft">
              <CardHeader>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Post not found</h1>
                <p className="text-muted-foreground">
                  This article was not found or has not been published yet.
                </p>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link to="/blog">Back to blog</Link>
                </Button>
              </CardContent>
            </Card>
          ) : post ? (
            <article>
              <header className="mx-auto max-w-3xl">
                <div className="flex flex-wrap gap-2">
                  {(post.categories.length ? post.categories : ["Uncategorized"]).slice(0, 3).map((c) => (
                    <Badge key={c} variant="secondary" className="w-fit text-xs">
                      {c}
                    </Badge>
                  ))}
                </div>
                <h1 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                  {post.title}
                </h1>

                <div className="mt-3 text-sm text-muted-foreground">By {post.author}</div>

                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  {dateLabel ? (
                    <span className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {dateLabel}
                    </span>
                  ) : null}
                  {readTimeLabel ? (
                    <span className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {readTimeLabel}
                    </span>
                  ) : null}
                </div>

                {post.tags.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {post.tags.slice(0, 10).map((t) => (
                      <Badge key={t} variant="outline" className="text-xs">
                        {t}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </header>

              <section className="container mt-10 md:mt-14">
                <div
                  className="rte-content max-w-3xl mx-auto"
                  dangerouslySetInnerHTML={{ __html: post.content_html }}
                />
              </section>
            </article>
          ) : null}
        </div>
      </section>
    </PublicLayout>
  );
}
