import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, CalendarDays, ExternalLink, Link as LinkIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ImageFieldCard from "@/components/dashboard/ImageFieldCard";
import PlatformDropdown from "@/pages/dashboard/assist/content-creation/PlatformDropdown";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type ScheduledContentItem = {
  id: string;
  title: string;
  description: string | null;
  scheduledAt: string; // ISO
  contentTypeId: string;
  contentTypeName: string;
  categoryId: string;
  categoryName: string;
  platform: string | null;
  businessName: string | null;
  businessId: string;
  businessUserId: string; // owner of business (client)
  imagePrimaryUrl: string;
  imageSecondUrl: string;
  imageThirdUrl: string;
};

function toDateTimeLocalValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export default function AssistScheduledContentView() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<ScheduledContentItem | null>(null);

  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [contentTypes, setContentTypes] = useState<Array<{ id: string; name: string }>>([]);

  const viewUrl = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/dashboard/assist/calendar/view/${id ?? ""}`;
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    const loadMetaAndItem = async () => {
      if (!id) {
        setLoading(false);
        setItem(null);
        return;
      }

      setLoading(true);
      try {
        const [{ data: catData, error: catErr }, { data: typeData, error: typeErr }, { data, error }] =
          await Promise.all([
            supabase.from("content_categories").select("id, name").order("name", { ascending: true }),
            supabase.from("content_types").select("id, name").order("name", { ascending: true }),
            supabase
              .from("content_items")
              .select(
                "id, title, description, business_id, category_id, content_type_id, image_primary_url, image_second_url, image_third_url, scheduled_at, platform, businesses(business_name, user_id), content_types(name), content_categories(name)",
              )
              .eq("id", id)
              .maybeSingle(),
          ]);

        if (cancelled) return;
        if (catErr) throw catErr;
        if (typeErr) throw typeErr;
        if (error) throw error;
        if (!data) {
          setItem(null);
          return;
        }

        setCategories((catData ?? []).map((c: any) => ({ id: c.id as string, name: c.name as string })));
        setContentTypes((typeData ?? []).map((t: any) => ({ id: t.id as string, name: t.name as string })));

        setItem({
          id: data.id as string,
          title: (data.title ?? "Untitled") as string,
          description: (data.description ?? null) as string | null,
          scheduledAt: (data.scheduled_at ?? new Date().toISOString()) as string,
          contentTypeId: (data.content_type_id ?? "") as string,
          contentTypeName: (((data as any).content_types?.name ?? "") as string),
          categoryId: (data.category_id ?? "") as string,
          categoryName: (((data as any).content_categories?.name ?? "") as string),
          platform: (data.platform ?? null) as string | null,
          businessName: (((data as any).businesses?.business_name ?? null) as string | null),
          businessId: (data.business_id ?? "") as string,
          businessUserId: (((data as any).businesses?.user_id ?? "") as string),
          imagePrimaryUrl: (data.image_primary_url ?? "") as string,
          imageSecondUrl: (data.image_second_url ?? "") as string,
          imageThirdUrl: (data.image_third_url ?? "") as string,
        });
      } catch (e: any) {
        if (!cancelled) {
          toast({
            variant: "destructive",
            title: "Failed to load content",
            description: e?.message ?? "Unknown error",
          });
          setItem(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadMetaAndItem();

    return () => {
      cancelled = true;
    };
  }, [id, toast]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <CalendarDays className="h-8 w-8 text-primary" />
            View Content
          </h1>
          <p className="text-muted-foreground">Read-only view (no Edit).</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(viewUrl);
                toast({ title: "Copied", description: "View Content URL copied." });
              } catch {
                toast({ variant: "destructive", title: "Copy failed", description: "Please copy manually." });
              }
            }}
          >
            <LinkIcon className="h-4 w-4" />
            Copy URL
          </Button>
          <Button type="button" variant="secondary" onClick={() => window.open(viewUrl, "_blank")}> 
            <ExternalLink className="h-4 w-4" />
            Open
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle>Scheduled Content</CardTitle>
          <CardDescription>
            {loading
              ? "Loading…"
              : item
                ? format(new Date(item.scheduledAt), "EEEE, dd MMM yyyy • HH:mm")
                : "Not found"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="view-url">View URL</Label>
            <Input id="view-url" value={viewUrl} readOnly />
          </div>

          {!item ? (
            <div className="text-sm text-muted-foreground">Content item not available.</div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-1">
                  <Label htmlFor="sc-title">Title</Label>
                  <Input id="sc-title" value={item.title} disabled />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="sc-description">Description</Label>
                  <Textarea id="sc-description" value={item.description ?? ""} disabled rows={4} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="sc-category">Category</Label>
                    <Select value={item.categoryId} onValueChange={() => {}} disabled>
                      <SelectTrigger id="sc-category">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent className="z-50">
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="sc-type">Type Content</Label>
                    <Select value={item.contentTypeId} onValueChange={() => {}} disabled>
                      <SelectTrigger id="sc-type">
                        <SelectValue placeholder="Select a content type" />
                      </SelectTrigger>
                      <SelectContent className="z-50">
                        {contentTypes.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="sc-scheduled">Scheduled At</Label>
                    <Input id="sc-scheduled" type="datetime-local" value={toDateTimeLocalValue(item.scheduledAt)} disabled />
                  </div>

                  <div className="space-y-1">
                    <PlatformDropdown
                      contentType={item.contentTypeName}
                      value={item.platform ?? ""}
                      onChange={() => {}}
                      disabled
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border border-border p-3">
                    <div className="text-xs text-muted-foreground">Business</div>
                    <div className="text-sm font-medium text-foreground truncate">{item.businessName ?? "-"}</div>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <div className="text-xs text-muted-foreground">Current Type</div>
                    <div className="text-sm font-medium text-foreground truncate">{item.contentTypeName || "-"}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium text-foreground">Images</div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <ImageFieldCard
                      label="Primary"
                      value={item.imagePrimaryUrl}
                      originalValue={item.imagePrimaryUrl}
                      onChange={() => void 0}
                      variant="compact"
                      disabled
                      mediaPicker={{ userId: item.businessUserId, businessId: item.businessId }}
                    />
                    <ImageFieldCard
                      label="Second"
                      value={item.imageSecondUrl}
                      originalValue={item.imageSecondUrl}
                      onChange={() => void 0}
                      variant="compact"
                      disabled
                      mediaPicker={{ userId: item.businessUserId, businessId: item.businessId }}
                    />
                    <ImageFieldCard
                      label="Third"
                      value={item.imageThirdUrl}
                      originalValue={item.imageThirdUrl}
                      onChange={() => void 0}
                      variant="compact"
                      disabled
                      mediaPicker={{ userId: item.businessUserId, businessId: item.businessId }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
