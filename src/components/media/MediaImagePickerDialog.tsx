import * as React from "react";

import { Check, Search } from "lucide-react";

import { UniversalFilePreview } from "@/components/media/UniversalFilePreview";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

type PickerItem = {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number | null;
  createdAt: string;
  mediaCategoryId: string | null;
  mediaTypeId: string | null;
};

type OptionRow = { id: string; name: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  businessId: string;
  onPick: (url: string, item: PickerItem) => void;
};

function parseStoragePathFromPublicUrl(url: string) {
  const marker = "/storage/v1/object/public/user-files/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

function isImageLike(mime: string, name: string) {
  const t = (mime ?? "").toLowerCase();
  if (t.startsWith("image/")) return true;
  const n = (name ?? "").toLowerCase();
  return n.endsWith(".png") || n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".webp") || n.endsWith(".gif") || n.endsWith(".svg");
}

export default function MediaImagePickerDialog({ open, onOpenChange, userId, businessId, onPick }: Props) {
  const [loadingFilters, setLoadingFilters] = React.useState(false);
  const [loadingItems, setLoadingItems] = React.useState(false);

  const [categories, setCategories] = React.useState<OptionRow[]>([]);
  const [types, setTypes] = React.useState<OptionRow[]>([]);

  // draft filters (applied only when clicking Show)
  const [draftCategoryId, setDraftCategoryId] = React.useState<string>("all");
  const [draftTypeId, setDraftTypeId] = React.useState<string>("all");

  // applied filters
  const [appliedCategoryId, setAppliedCategoryId] = React.useState<string>("all");
  const [appliedTypeId, setAppliedTypeId] = React.useState<string>("all");

  const [items, setItems] = React.useState<PickerItem[]>([]);

  React.useEffect(() => {
    if (!open) return;

    setDraftCategoryId("all");
    setDraftTypeId("all");
    setAppliedCategoryId("all");
    setAppliedTypeId("all");
    setItems([]);

    let cancelled = false;
    void (async () => {
      setLoadingFilters(true);
      try {
        const [{ data: catData, error: catErr }, { data: typeData, error: typeErr }] = await Promise.all([
          supabase.from("media_categories").select("id, name").order("name", { ascending: true }),
          supabase.from("media_types").select("id, name").order("name", { ascending: true }),
        ]);

        if (catErr) throw catErr;
        if (typeErr) throw typeErr;

        if (cancelled) return;

        setCategories((catData ?? []).map((c: any) => ({ id: c.id as string, name: c.name as string })));
        setTypes((typeData ?? []).map((t: any) => ({ id: t.id as string, name: t.name as string })));
      } finally {
        if (!cancelled) setLoadingFilters(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const fetchItems = React.useCallback(async () => {
    setLoadingItems(true);
    try {
      let q = supabase
        .from("user_gallery")
        .select("id, name, url, type, size, created_at, media_category_id, media_type_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(300);

      if (appliedCategoryId !== "all") q = q.eq("media_category_id", appliedCategoryId);
      if (appliedTypeId !== "all") q = q.eq("media_type_id", appliedTypeId);

      const { data, error } = await q;
      if (error) throw error;

      const filtered = ((data ?? []) as any[])
        .map(
          (d): PickerItem => ({
            id: d.id as string,
            name: d.name as string,
            url: d.url as string,
            type: d.type as string,
            size: (d.size ?? null) as number | null,
            createdAt: d.created_at as string,
            mediaCategoryId: (d.media_category_id ?? null) as string | null,
            mediaTypeId: (d.media_type_id ?? null) as string | null,
          }),
        )
        .filter((it) => {
          if (!isImageLike(it.type, it.name)) return false;
          const storagePath = parseStoragePathFromPublicUrl(it.url);
          if (!storagePath) return false;
          return storagePath.startsWith(`${userId}/${businessId}/`);
        });

      setItems(filtered);
    } catch {
      setItems([]);
    } finally {
      setLoadingItems(false);
    }
  }, [appliedCategoryId, appliedTypeId, businessId, userId]);

  // Auto-refetch when applied filters change (after clicking Show)
  React.useEffect(() => {
    if (!open) return;
    void fetchItems();
  }, [open, fetchItems]);

  const applyAndShow = () => {
    setAppliedCategoryId(draftCategoryId);
    setAppliedTypeId(draftTypeId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Select Image from Media</DialogTitle>
          <DialogDescription>
            Filter by Category & Type Content, click <span className="font-medium">Show</span>, then select an image.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Category</p>
            <Select value={draftCategoryId} onValueChange={setDraftCategoryId}>
              <SelectTrigger disabled={loadingFilters}>
                <SelectValue placeholder={loadingFilters ? "Loading..." : "All Categories"} />
              </SelectTrigger>
              <SelectContent className="z-50">
                <SelectItem value="all">All</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Type Content</p>
            <Select value={draftTypeId} onValueChange={setDraftTypeId}>
              <SelectTrigger disabled={loadingFilters}>
                <SelectValue placeholder={loadingFilters ? "Loading..." : "All Types"} />
              </SelectTrigger>
              <SelectContent className="z-50">
                <SelectItem value="all">All</SelectItem>
                {types.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Button type="button" onClick={applyAndShow} disabled={loadingFilters}>
              <Search className="mr-2 h-4 w-4" />
              Show
            </Button>
          </div>
        </div>

        <div className="min-h-[260px]">
          {loadingItems ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Loading images...</div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No images found for this business.</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => {
                    onPick(it.url, it);
                    onOpenChange(false);
                  }}
                  className="group overflow-hidden rounded-lg border text-left"
                >
                  <div className="relative aspect-video w-full bg-muted">
                    <UniversalFilePreview
                      source={{ kind: "remote", url: it.url, name: it.name, mimeType: it.type }}
                      className="h-full w-full"
                    />
                    <div className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100 bg-background/40" />
                    <div className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md border bg-background/80 px-2 py-1 text-xs text-foreground opacity-0 transition-opacity group-hover:opacity-100">
                      <Check className="h-3 w-3" />
                      Select
                    </div>
                  </div>
                  <div className="p-2">
                    <p className="truncate text-xs font-medium text-foreground">{it.name}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
