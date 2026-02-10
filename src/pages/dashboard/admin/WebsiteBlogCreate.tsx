import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Eye, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
import { RichTextEditor } from "@/components/dashboard/RichTextEditor";

import { AuthorPicker } from "@/components/blog/AuthorPicker";
import { CategoriesPanel, type BlogCategoryRow } from "@/components/blog/CategoriesPanel";
import { TagsInput, type BlogTagRow } from "@/components/blog/TagsInput";
import { WebsiteMediaPickerDialog } from "@/components/media/WebsiteMediaPickerDialog";


type BlogPostStatus = "draft" | "pending_review" | "private" | "scheduled" | "published";

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

export default function AdminWebsiteBlogCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // system author for RLS (must equal auth.uid())
  const [authorId, setAuthorId] = useState<string | null>(null);
  const [authorDisplay, setAuthorDisplay] = useState<string>("");

  // blog-facing author (managed in blog_authors table)
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

  useEffect(() => {
    // slug harus selalu auto-sync dari title dan tidak editable
    setSlug(slugFromTitle);
    setMetaTitle((prev) => (prev ? prev : title));
  }, [slugFromTitle, title]);

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
      } catch (e: any) {
        toast({
          variant: "destructive",
          title: "Failed to load data",
          description: e?.message || "Something went wrong.",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

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

  const savePost = async (nextStatus: BlogPostStatus) => {
    if (saving) return;
    if (!validate()) return;

    setSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const publishAtIso =
        nextStatus === "scheduled"
          ? new Date(publishAt).toISOString()
          : nextStatus === "published"
            ? nowIso
            : null;

      const insertPayload: any = {
        author_id: authorId as string, // required by RLS
        blog_author_id: blogAuthorId,
        title: title.trim(),
        slug: slug,
        content_html: contentHtml,
        excerpt: excerpt.trim(),
        featured_image_url: featuredImageUrl.trim() || null,
        featured_image_alt: featuredImageAlt.trim() || null,
        status: nextStatus,
        publish_at: publishAtIso,
        meta_title: metaTitle.trim(),
        meta_description: metaDescription.trim(),
        reading_time_minutes: estimateReadingTimeMinutes(contentHtml),
      };

      const { data: inserted, error: insertErr } = await supabase
        .from("blog_posts")
        .insert(insertPayload)
        .select("id")
        .single();

      if (insertErr) throw insertErr;

      const postId = inserted?.id as string | undefined;
      if (!postId) throw new Error("Failed to read the new post ID.");

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

      toast({ title: "Post saved", description: `Status: ${nextStatus}` });
      navigate("/dashboard/admin/website/blog", { replace: true });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Failed to save post",
        description: e?.message || "Something went wrong.",
      });
    } finally {
      setSaving(false);
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
            <h1 className="text-3xl font-bold text-foreground">Add New Post</h1>
          </div>
          <p className="text-sm text-muted-foreground">Create a blog post for your public website.</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button type="button" variant="outline" onClick={() => void savePost("draft")} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save draft"}
          </Button>
          <Button type="button" onClick={() => void savePost(status)} disabled={saving}>
            <Eye className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : status === "published" ? "Publish" : status === "scheduled" ? "Schedule" : "Save"}
          </Button>
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
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Post title" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Slug / URL*</Label>
                <Input id="slug" value={slug} disabled placeholder="Auto-generated from title" />
                <p className="text-xs text-muted-foreground">Auto-generated from the title (cannot be edited).</p>
              </div>

              {/* System Author (login) is still used for RLS, but hidden from the UI */}

              <AuthorPicker
                value={blogAuthorId}
                onChange={(id, label) => {
                  setBlogAuthorId(id);
                  setBlogAuthorLabel(label);
                }}
                label="Public author*"
                placeholder="Select the author shown publicly"
              />

              <div className="space-y-2">
                <Label>Status*</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as BlogPostStatus)}>
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
                  disabled={status !== "scheduled"}
                />
                <p className="text-xs text-muted-foreground">Only enabled when status is Scheduled.</p>
              </div>
            </div>
          </section>

          {/* Taxonomy */}
          <section className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2">
              <CategoriesPanel
                categories={categories}
                selectedIds={selectedCategoryIds}
                onSelectedIdsChange={setSelectedCategoryIds}
                onCreated={() => {
                  void loadCatsTags();
                }}
                onDeleted={() => {
                  void loadCatsTags();
                }}
              />

              <TagsInput
                tags={tags}
                selectedIds={selectedTagIds}
                onSelectedIdsChange={setSelectedTagIds}
                onTagsChange={(next) => setTags(next)}
              />
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
                  /* saving handled by top buttons */
                }}
                title="Content"
                description=""
                icon={Save}
                showTopBar={false}
                showSaveControls={false}
                isEditing
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
              />
            </div>
          </section>

          {/* Media */}
          <section className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Featured image</Label>
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
                />
              </div>
            </div>
          </section>

          {/* SEO */}
          <section className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="metaTitle">Meta title*</Label>
                <Input id="metaTitle" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} />
                <p className="text-xs text-muted-foreground">Recommended under 60 characters.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="metaDescription">Meta description* (max 160)</Label>
                <Textarea
                  id="metaDescription"
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  placeholder="Short description for Google snippets and social sharing"
                />
                <div className="text-xs text-muted-foreground">{metaDescription.trim().length}/160</div>
              </div>
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
