import { useEffect, useMemo, useState } from "react";
import { Eye, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type BlogStatus = "draft" | "pending_review" | "private" | "scheduled" | "published";

type BlogPostRow = {
  id: string;
  title: string;
  author: string;
  categories: string[];
  tags: string[];
  date: string;
  status: BlogStatus;
};

const statusLabel: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending review",
  private: "Private",
  scheduled: "Scheduled",
  published: "Published",
};

function formatDate(iso?: string | null) {
  if (!iso) return "-";
  // keep it simple (YYYY-MM-DD)
  return iso.slice(0, 10);
}

export default function AdminWebsiteBlog() {
  const navigate = useNavigate();

  const [filter, setFilter] = useState<"all" | "published" | "scheduled" | "draft">("all");
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<BlogPostRow[]>([]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("blog_posts")
          .select(
            "id,title,status,created_at,publish_at,blog_author_id,blog_authors(name),blog_post_categories(blog_categories(name)),blog_post_tags(blog_tags(name))"
          )
          .order("created_at", { ascending: false });

        if (error) throw error;

        const mapped = (data ?? []).map((row: any): BlogPostRow => {
          const author = row?.blog_authors?.name ?? "-";
          const categories = (row?.blog_post_categories ?? [])
            .map((x: any) => x?.blog_categories?.name)
            .filter(Boolean);
          const tags = (row?.blog_post_tags ?? []).map((x: any) => x?.blog_tags?.name).filter(Boolean);

          return {
            id: row.id,
            title: row.title,
            status: row.status,
            author,
            categories,
            tags,
            date: formatDate(row.publish_at ?? row.created_at),
          };
        });

        setPosts(mapped);
      } catch {
        setPosts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return posts;

    // "Drafts" tab shows anything not published or scheduled
    if (filter === "draft") {
      return posts.filter((p) => p.status !== "published" && p.status !== "scheduled");
    }

    return posts.filter((p) => p.status === filter);
  }, [filter, posts]);

  const handleAddNewPost = () => {
    navigate("/dashboard/admin/website/blog/new");
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">Posts</h1>
          <p className="text-sm text-muted-foreground">Manage blog posts: create, review, and publish.</p>
        </div>

        <Button type="button" onClick={handleAddNewPost}>
          <Plus className="h-4 w-4" />
          Add New
        </Button>
      </header>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">All Blog Posts</CardTitle>

            <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="published">Published</TabsTrigger>
                <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
                <TabsTrigger value="draft">Drafts</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Categories</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No posts found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((post) => (
                    <TableRow key={post.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span className="truncate">{post.title}</span>
                          <Badge variant="secondary" className="shrink-0">
                            {statusLabel[String(post.status)] ?? String(post.status)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>{post.author}</TableCell>
                      <TableCell className="text-muted-foreground">{post.categories.join(", ") || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{post.tags.join(", ") || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{post.date}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/dashboard/admin/website/blog/${post.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
