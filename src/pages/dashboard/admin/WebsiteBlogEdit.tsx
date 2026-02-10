import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Pencil, Save, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";


import { AuthorPicker } from "@/components/blog/AuthorPicker";
import { CategoriesPanel, type BlogCategoryRow } from "@/components/blog/CategoriesPanel";
import { TagsInput, type BlogTagRow } from "@/components/blog/TagsInput";
import { WebsiteMediaPickerDialog } from "@/components/media/WebsiteMediaPickerDialog";
import { RichTextEditor } from "@/components/dashboard/RichTextEditor";

type BlogPostStatus = "draft" | "pending_review" | "private" | "scheduled" | "published";

type BlogPostDetail = {
  id: string;
  title: string;
  slug: string;
  content_html: string;
  excerpt: string | null;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  status: BlogPostStatus;
  publish_at: string | null;
  meta_title: string | null;
  meta_description: string | null;
  blog_author_id: string | null;
  blog_post_categories: { category_id: string }[];
  blog_post_tags: { tag_id: string }[];
};

const slugify = (input: string) =>
  input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const estimateReadingTimeMinutes = (html: string) => {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return 0;
  const words = text.split(" ").filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
};

function toDatetimeLocalValue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  // Good-enough for admin editing; renders as YYYY-MM-DDTHH:mm
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function AdminWebsiteBlogEdit() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();

  const postId = id ?? null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // system author for RLS (must equal auth.uid())
  const [authorId, setAuthorId] = useState<string | null>(null);
  const [authorDisplay, setAuthorDisplay] = useState<string>("");

  // blog-facing author
  const [blogAuthorId, setBlogAuthorId] = useState<string | null>(null);
  const [blogAuthorLabel, setBlogAuthorLabel] = useState<string>("");

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [contentHtml, setContentHtml] = useState("<p></p>");
  const [excerpt, setExcerpt] = useState("");

  const [featuredImageUrl, setFeaturedImageUrl] = useState("");
  const [featuredImageAlt, setFeaturedImageAlt] = useState("");
  const [featuredPickerOpen, setFeaturedPickerOpen] = useState(false);

  const [status, setStatus] = useState<BlogPostStatus>("draft");
  const [publishAt, setPublishAt] = useState<string>(""); // datetime-local

  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");

  const [categories, setCategories] = useState<BlogCategoryRow[]>([]);
  const [tags, setTags] = useState<BlogTagRow[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const slugFromTitle = useMemo(() => slugify(title), [title]);

  // Keep slug synced only while editing (otherwise treat it as immutable for existing posts)
  useEffect(() => {
    if (!editing) return;
    setSlug(slugFromTitle);
    setMetaTitle((prev) => (prev ? prev : title));
  }, [editing, slugFromTitle, title]);

  const loadCatsTags = async () => {
    const [{ data: cats, error: catsErr }, { data: tagsData, error: tagsErr }] = await Promise.all([
      supabase
        .from("blog_categories")
        .select("id,name,slug,parent_id,is_locked")
        .order("name", { ascending: true }),
      supabase.from("blog_tags").select("id,name,slug").order("name", { ascending: true }),
    ]);

    if (catsErr) throw catsErr;
    if (tagsErr) throw tagsErr;

    setCategories(((cats as any[]) ?? []) as BlogCategoryRow[]);
    setTags(((tagsData as any[]) ?? []) as BlogTagRow[]);
  };

  useEffect(() => {
    void (async () => {
      try {
        if (!postId) {
          toast({ variant: "destructive", title: "Post ID not found" });
          navigate("/dashboard/admin/website/blog", { replace: true });
          return;
        }

        setLoading(true);

        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;

        const uid = userData.user?.id ?? null;
        setAuthorId(uid);

        if (uid) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("name,email")
            .eq("id", uid)
            .maybeSingle();

          setAuthorDisplay(profile?.name || profile?.email || userData.user?.email || uid);
        } else {
          setAuthorDisplay("");
        }

        await loadCatsTags();

        const { data: post, error: postErr } = await supabase
          .from("blog_posts")
          .select(
            "id,title,slug,content_html,excerpt,featured_image_url,featured_image_alt,status,publish_at,meta_title,meta_description,blog_author_id,blog_post_categories(category_id),blog_post_tags(tag_id)"
          )
          .eq("id", postId)
          .single();

        if (postErr) throw postErr;

        const row = post as any as BlogPostDetail;
        setTitle(row.title);
        setSlug(row.slug);
        setContentHtml(row.content_html || "<p></p>");
        setExcerpt(row.excerpt || "");

        setFeaturedImageUrl(row.featured_image_url || "");
        setFeaturedImageAlt(row.featured_image_alt || "");

        setStatus(row.status);
        setPublishAt(toDatetimeLocalValue(row.publish_at));

        setMetaTitle(row.meta_title || row.title);
        setMetaDescription(row.meta_description || "");

        setBlogAuthorId(row.blog_author_id);

        setSelectedCategoryIds((row.blog_post_categories ?? []).map((x) => x.category_id));
        setSelectedTagIds((row.blog_post_tags ?? []).map((x) => x.tag_id));
      } catch (e: any) {
        toast({
          variant: "destructive",
          title: "Failed to load post",
          description: e?.message || "Something went wrong.",
        });
        navigate("/dashboard/admin/website/blog", { replace: true });
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate, postId, toast]);

  const validate = () => {
    if (!authorId) {
      toast({ variant: "destructive", title: "System author not found (please re-login)" });
      return false;
    }
    if (!blogAuthorId) {
      toast({ variant: "destructive", title: "Public author is required" });
      return false;
    }
    if (!title.trim()) {
      toast({ variant: "destructive", title: "Title is required" });
      return false;
    }
    if (!slug.trim()) {
      toast({ variant: "destructive", title: "Slug is required" });
      return false;
    }
    if (!contentHtml || contentHtml.replace(/<[^>]*>/g, "").trim().length < 10) {
      toast({ variant: "destructive", title: "Content is required" });
      return false;
    }
    if (!excerpt.trim()) {
      toast({ variant: "destructive", title: "Excerpt is required" });
      return false;
    }
    if (!metaTitle.trim()) {
      toast({ variant: "destructive", title: "Meta title is required" });
      return false;
    }
    if (!metaDescription.trim()) {
      toast({ variant: "destructive", title: "Meta description is required" });
      return false;
    }
    if (metaDescription.trim().length > 160) {
      toast({ variant: "destructive", title: "Meta description must be 160 characters or less" });
      return false;
    }
    if (status === "scheduled" && !publishAt) {
      toast({ variant: "destructive", title: "Publish date is required for scheduled posts" });
      return false;
    }
    return true;
  };

  const saveChanges = async () => {
    if (!postId) return;
    if (saving) return;
    if (!editing) return;
    if (!validate()) return;

    setSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const publishAtIso = status === "scheduled" ? new Date(publishAt).toISOString() : status === "published" ? nowIso : null;

      const payload: any = {
        author_id: authorId as string,
        blog_author_id: blogAuthorId,
        title: title.trim(),
        slug: slug,
        content_html: contentHtml,
        excerpt: excerpt.trim(),
        featured_image_url: featuredImageUrl.trim() || null,
        featured_image_alt: featuredImageAlt.trim() || null,
        status,
        publish_at: publishAtIso,
        meta_title: metaTitle.trim(),
        meta_description: metaDescription.trim(),
        reading_time_minutes: estimateReadingTimeMinutes(contentHtml),
      };

      const { error: updateErr } = await supabase.from("blog_posts").update(payload).eq("id", postId);
      if (updateErr) throw updateErr;

      // Replace taxonomy links
      const [{ error: delCatsErr }, { error: delTagsErr }] = await Promise.all([
        supabase.from("blog_post_categories").delete().eq("post_id", postId),
        supabase.from("blog_post_tags").delete().eq("post_id", postId),
      ]);
      if (delCatsErr) throw delCatsErr;
      if (delTagsErr) throw delTagsErr;

      if (selectedCategoryIds.length) {
        const { error: catsLinkErr } = await supabase.from("blog_post_categories").insert(
          selectedCategoryIds.map((categoryId) => ({
            post_id: postId,
            category_id: categoryId,
          }))
        );
        if (catsLinkErr) throw catsLinkErr;
      }

      if (selectedTagIds.length) {
        const { error: tagsLinkErr } = await supabase.from("blog_post_tags").insert(
          selectedTagIds.map((tagId) => ({
            post_id: postId,
            tag_id: tagId,
          }))
        );
        if (tagsLinkErr) throw tagsLinkErr;
      }

      toast({ title: "Post updated" });
      setEditing(false);
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Failed to update post",
        description: e?.message || "Something went wrong.",
      });
    } finally {
      setSaving(false);
    }
  };

  const deletePostPermanently = async () => {
    if (!postId) return;
    if (saving) return;

    setSaving(true);
    try {
      // delete relations first (safe even without FK cascades)
      const [{ error: delCatsErr }, { error: delTagsErr }] = await Promise.all([
        supabase.from("blog_post_categories").delete().eq("post_id", postId),
        supabase.from("blog_post_tags").delete().eq("post_id", postId),
      ]);
      if (delCatsErr) throw delCatsErr;
      if (delTagsErr) throw delTagsErr;

      const { error: delPostErr } = await supabase.from("blog_posts").delete().eq("id", postId);
      if (delPostErr) throw delPostErr;

      toast({ title: "Post deleted" });
      navigate("/dashboard/admin/website/blog", { replace: true });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Failed to delete post",
        description: e?.message || "Something went wrong.",
      });
    } finally {
      setSaving(false);
      setDeleteOpen(false);
    }
  };

  if (loading) {
    return <div className="py-8 text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold text-foreground">Post details</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            View the full post. Click Edit to enable fields and update the database.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" disabled={saving}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this post?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the post from the database (including category and tag relations).
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => void deletePostPermanently()} disabled={saving}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {!editing ? (
            <Button type="button" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          ) : (
            <Button type="button" onClick={() => void saveChanges()} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save"}
            </Button>
          )}
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Post details</CardTitle>
        </CardHeader>

        <CardContent className="space-y-8">
          {/* Basics */}
          <section className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Title*</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Post title"
                  disabled={!editing}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Slug / URL*</Label>
                <Input id="slug" value={slug} disabled placeholder="Auto-generated from title" />
                <p className="text-xs text-muted-foreground">Auto-generated from the title (cannot be edited).</p>
              </div>

              <div className={editing ? "" : "pointer-events-none opacity-60"}>
                <AuthorPicker
                  value={blogAuthorId}
                  onChange={(nextId, label) => {
                    setBlogAuthorId(nextId);
                    setBlogAuthorLabel(label);
                  }}
                  label="Public author*"
                  placeholder="Select the author shown publicly"
                />
              </div>

              <div className="space-y-2">
                <Label>Status*</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as BlogPostStatus)} disabled={!editing}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending_review">Pending review</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="publishAt">Publish date & time</Label>
                <Input
                  id="publishAt"
                  type="datetime-local"
                  value={publishAt}
                  onChange={(e) => setPublishAt(e.target.value)}
                  disabled={!editing || status !== "scheduled"}
                />
                <p className="text-xs text-muted-foreground">Only enabled when status is Scheduled.</p>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              System author (login) is used for permissions (RLS) and is hidden. Current user: {authorDisplay || "-"}
            </div>
          </section>

          {/* Taxonomy */}
          <section className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2">
              <div className={editing ? "" : "pointer-events-none opacity-60"}>
                <CategoriesPanel
                  categories={categories}
                  selectedIds={selectedCategoryIds}
                  onSelectedIdsChange={setSelectedCategoryIds}
                  onCreated={() => {
                    void loadCatsTags();
                  }}
                />
              </div>

              <div className={editing ? "" : "pointer-events-none opacity-60"}>
                <TagsInput
                  tags={tags}
                  selectedIds={selectedTagIds}
                  onSelectedIdsChange={setSelectedTagIds}
                  onTagsChange={(next) => setTags(next)}
                />
              </div>
            </div>
          </section>

          {/* Content */}
          <section className="space-y-4">
            <div className="space-y-2">
              <Label>Content*</Label>
              <RichTextEditor
                value={contentHtml}
                onChange={setContentHtml}
                onSave={() => {
                  /* saving handled by top button */
                }}
                title="Content"
                description=""
                icon={Save}
                showTopBar={false}
                showSaveControls={false}
                isEditing={editing}
                enableImageInsert
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="excerpt">Excerpt / summary*</Label>
              <Textarea
                id="excerpt"
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="Short summary used for previews and listings"
                disabled={!editing}
              />
            </div>
          </section>

          {/* Media */}
          <section className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Featured image</Label>

                {editing ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" onClick={() => setFeaturedPickerOpen(true)}>
                      Set featured image
                    </Button>
                    {featuredImageUrl ? (
                      <Button type="button" variant="ghost" onClick={() => setFeaturedImageUrl("")}>
                        Clear
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                {featuredImageUrl ? (
                  <div className="mt-3 overflow-hidden rounded-md border border-border bg-muted">
                    <img
                      src={featuredImageUrl}
                      alt={featuredImageAlt || "Featured image preview"}
                      loading="lazy"
                      className="h-48 w-full object-cover"
                    />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No featured image set.</p>
                )}

                <WebsiteMediaPickerDialog
                  open={featuredPickerOpen}
                  onOpenChange={setFeaturedPickerOpen}
                  title="Set featured image"
                  accept="image/*"
                  onPick={(pick) => {
                    setFeaturedImageUrl(pick.url);
                    if (!featuredImageAlt.trim() && pick.name) setFeaturedImageAlt(pick.name);
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="featuredImageAlt">Featured image alt text</Label>
                <Input
                  id="featuredImageAlt"
                  value={featuredImageAlt}
                  onChange={(e) => setFeaturedImageAlt(e.target.value)}
                  placeholder="Describe the image for SEO and accessibility"
                  disabled={!editing}
                />
              </div>
            </div>
          </section>

          {/* SEO (still stored in DB, even if SEO menu is removed) */}
          <section className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="metaTitle">Meta title*</Label>
                <Input id="metaTitle" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} disabled={!editing} />
                <p className="text-xs text-muted-foreground">Recommended under 60 characters.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="metaDescription">Meta description* (max 160)</Label>
                <Textarea
                  id="metaDescription"
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  placeholder="Short description for Google snippets and social sharing"
                  disabled={!editing}
                />
              </div>
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
