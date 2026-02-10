import * as React from "react";

import { ArrowLeft, Copy, Download, Eye, ImageUp, Pencil, Trash2 } from "lucide-react";

import { FileThumbnail, UniversalFilePreview } from "@/components/media/UniversalFilePreview";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export type MediaDetailsItem = {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number | null;
  createdAt: string;
  categoryName: string;
  mediaTypeName: string;
};

type CategoryOption = { id: string; name: string };

type MediaTypeOption = { id: string; name: string; key: string };

type Props = {
  businessName: string;
  userId: string;
  categories: string[];
  categoryOptions: CategoryOption[];
  mediaTypes: MediaTypeOption[];
  initialCategory?: string;
  onBack: () => void;
};

function extFromName(name: string) {
  const n = (name ?? "").trim();
  const dot = n.lastIndexOf(".");
  return dot >= 0 ? n.slice(dot).toLowerCase() : "";
}

function isOfficeExt(ext: string) {
  return ext === ".doc" || ext === ".docx" || ext === ".xls" || ext === ".xlsx";
}

function isTextLike(type: string, ext: string) {
  const t = (type ?? "").toLowerCase();
  return t.startsWith("text/") || ext === ".txt";
}

function isPdfLike(type: string, ext: string) {
  const t = (type ?? "").toLowerCase();
  return t === "application/pdf" || ext === ".pdf";
}

function parseStoragePathFromPublicUrl(url: string) {
  // expected: .../storage/v1/object/public/user-files/<path>
  const marker = "/storage/v1/object/public/user-files/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}


export default function MediaDetailsView({
  businessName,
  userId,
  categories,
  categoryOptions,
  mediaTypes,
  initialCategory,
  onBack,
}: Props) {
  const { toast } = useToast();

  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<MediaDetailsItem[]>([]);

  const [sortCategory, setSortCategory] = React.useState<string>(initialCategory && initialCategory !== "All" ? initialCategory : "");
  const [sortTypeContent, setSortTypeContent] = React.useState<string>("");

  const [previewItem, setPreviewItem] = React.useState<MediaDetailsItem | null>(null);
  const [previewText, setPreviewText] = React.useState<string>("");
  const [previewLoading, setPreviewLoading] = React.useState(false);

  const [deleteItem, setDeleteItem] = React.useState<MediaDetailsItem | null>(null);

  const [changeConfirmItem, setChangeConfirmItem] = React.useState<MediaDetailsItem | null>(null);
  const [changingItem, setChangingItem] = React.useState<MediaDetailsItem | null>(null);
  const pendingFilePickRef = React.useRef(false);

  const [renameItem, setRenameItem] = React.useState<MediaDetailsItem | null>(null);
  const [renameDraft, setRenameDraft] = React.useState<string>("");
  const [renameSaving, setRenameSaving] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const categoryNameToId = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categoryOptions) map.set(c.name, c.id);
    return map;
  }, [categoryOptions]);

  const mediaTypeNameToId = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const t of mediaTypes) map.set(t.name, t.id);
    return map;
  }, [mediaTypes]);

  const mediaTypeIdToName = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const t of mediaTypes) map.set(t.id, t.name);
    return map;
  }, [mediaTypes]);

  const categoryIdToName = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categoryOptions) map.set(c.id, c.name);
    return map;
  }, [categoryOptions]);

  const fetchItems = React.useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("user_gallery")
      .select("id, name, url, type, size, created_at, media_category_id, media_type_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (sortCategory) {
      const categoryId = categoryNameToId.get(sortCategory);
      if (categoryId) query = query.eq("media_category_id", categoryId);
    }

    if (sortTypeContent) {
      const typeId = mediaTypeNameToId.get(sortTypeContent);
      if (typeId) query = query.eq("media_type_id", typeId);
    }

    const { data, error } = await query.limit(1000);

    if (error) {
      setItems([]);
      setLoading(false);
      toast({ variant: "destructive", title: "Failed to load", description: error.message });
      return;
    }

    const next: MediaDetailsItem[] = ((data ?? []) as any[]).map((d) => {
      const categoryName = d.media_category_id ? categoryIdToName.get(d.media_category_id) ?? "" : "";
      const mediaTypeName = d.media_type_id ? mediaTypeIdToName.get(d.media_type_id) ?? "" : "";
      return {
        id: d.id as string,
        name: (d.name ?? "") as string,
        url: (d.url ?? "") as string,
        type: (d.type ?? "") as string,
        size: (d.size ?? null) as number | null,
        createdAt: (d.created_at ?? "") as string,
        categoryName,
        mediaTypeName,
      };
    });

    setItems(next);
    setLoading(false);
  }, [userId, sortCategory, sortTypeContent, categoryNameToId, mediaTypeNameToId, categoryIdToName, mediaTypeIdToName, toast]);

  React.useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!previewItem) {
        setPreviewText("");
        setPreviewLoading(false);
        return;
      }

      const ext = extFromName(previewItem.name);
      if (!isTextLike(previewItem.type, ext)) {
        setPreviewText("");
        setPreviewLoading(false);
        return;
      }

      try {
        setPreviewLoading(true);
        const res = await fetch(previewItem.url);
        const txt = await res.text();
        if (!cancelled) setPreviewText(txt.slice(0, 20000));
      } catch {
        if (!cancelled) setPreviewText("");
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [previewItem]);

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Copied", description: "URL copied to clipboard." });
    } catch {
      toast({ variant: "destructive", title: "Copy failed", description: "Clipboard permission denied." });
    }
  };

  const downloadFile = async (item: MediaDetailsItem) => {
    try {
      const res = await fetch(item.url);
      if (!res.ok) throw new Error("Failed to download file");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = item.name || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Download failed", description: e?.message ?? "Unknown error" });
    }
  };

  const requestChange = (item: MediaDetailsItem) => {
    setChangeConfirmItem(item);
  };

  React.useEffect(() => {
    if (!changingItem) return;
    if (!pendingFilePickRef.current) return;

    pendingFilePickRef.current = false;
    fileInputRef.current?.click();
  }, [changingItem]);

  const handleChangeFile = async (file: File | null) => {
    if (!changingItem || !file) return;

    try {
      const dot = file.name.lastIndexOf(".");
      const ext = dot >= 0 ? file.name.slice(dot) : "";
      const baseName = (changingItem.name || `media-${changingItem.id}`).replace(/\.[^/.]+$/, "");
      const safeBase = baseName
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9_-]/g, "")
        .slice(0, 80);

      const path = `${userId}/media/${changingItem.id}/${safeBase}${ext}`;

      const { error: uploadError } = await supabase.storage.from("user-files").upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from("user-files").getPublicUrl(path);

      const { error: updateError } = await supabase
        .from("user_gallery")
        .update({ url: publicData.publicUrl, type: file.type, size: file.size, name: `${safeBase}${ext}` })
        .eq("id", changingItem.id);

      if (updateError) throw updateError;

      toast({ title: "Updated", description: "Media updated." });
      setChangingItem(null);
      await fetchItems();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Update failed", description: e?.message ?? "Unknown error" });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const confirmDelete = async () => {
    if (!deleteItem) return;

    try {
      // Best-effort remove from storage
      const path = parseStoragePathFromPublicUrl(deleteItem.url);
      if (path) {
        await supabase.storage.from("user-files").remove([path]);
      }

      const { error } = await supabase.from("user_gallery").delete().eq("id", deleteItem.id);
      if (error) throw error;

      toast({ title: "Deleted", description: "Media deleted." });
      setDeleteItem(null);
      await fetchItems();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Delete failed", description: e?.message ?? "Unknown error" });
      setDeleteItem(null);
    }
  };

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept={(() => {
          const ext = extFromName(changingItem?.name ?? "");
          const t = (changingItem?.type ?? "").toLowerCase();
          if (t.startsWith("image/")) return "image/*";
          if (t.startsWith("video/")) return "video/*";
          if (isOfficeExt(ext) || ext === ".pdf" || ext === ".txt") return ".pdf,.txt,.doc,.docx,.xls,.xlsx";
          return "image/*,video/*,.pdf,.txt,.doc,.docx,.xls,.xlsx";
        })()}
        className="hidden"
        onChange={(e) => handleChangeFile(e.target.files?.[0] ?? null)}
      />

      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <Button type="button" variant="ghost" size="icon" className="mt-0.5" onClick={onBack} aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-foreground">View Details</h1>
            <p className="text-muted-foreground">{businessName}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            value={sortCategory || "all"}
            onValueChange={(v) => {
              const next = v === "all" ? "" : v;
              setSortCategory(next);
            }}
          >
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Sort by Category" />
            </SelectTrigger>
            <SelectContent className="z-50">
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={sortTypeContent || "all"}
            onValueChange={(v) => {
              const next = v === "all" ? "" : v;
              setSortTypeContent(next);
            }}
          >
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Sort by Type Content" />
            </SelectTrigger>
            <SelectContent className="z-50">
              <SelectItem value="all">All Types</SelectItem>
              {mediaTypes.map((t) => (
                <SelectItem key={t.id} value={t.name}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Media Items</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : null}

          {!loading && items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No media found for the selected filters.</p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const isImage = (item.type ?? "").toLowerCase().startsWith("image/");
              const isVideo = (item.type ?? "").toLowerCase().startsWith("video/");
              const createdLabel = item.createdAt ? new Date(item.createdAt).toLocaleString("en-US") : "-";

              return (
                <Card key={item.id} className="group overflow-hidden">
                  <div className="relative aspect-video w-full bg-muted">
                    {isImage ? (
                      <img src={item.url} alt={item.name || "Media preview"} className="h-full w-full object-cover" loading="lazy" />
                    ) : isVideo ? (
                      <video src={item.url} className="h-full w-full object-cover" controls />
                    ) : (
                      <FileThumbnail name={item.name || "file"} mimeType={item.type} />
                    )}

                    {/* overlay actions */}
                    <div className="absolute inset-0 flex items-start justify-end gap-2 p-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button type="button" size="icon" variant="secondary" className="h-8 w-8" onClick={() => setPreviewItem(item)} aria-label="Preview">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="icon" variant="secondary" className="h-8 w-8" onClick={() => void copyUrl(item.url)} aria-label="Copy URL">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="icon" variant="secondary" className="h-8 w-8" onClick={() => void downloadFile(item)} aria-label="Download">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8"
                        onClick={() => {
                          setRenameItem(item);
                          setRenameDraft(item.name ?? "");
                        }}
                        aria-label="Edit name"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="icon" variant="secondary" className="h-8 w-8" onClick={() => requestChange(item)} aria-label="Change file">
                        <ImageUp className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="icon" variant="secondary" className="h-8 w-8" onClick={() => setDeleteItem(item)} aria-label="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <CardContent className="space-y-1 p-3">
                    <p className="text-sm font-semibold text-foreground break-all">{item.name || "(no name)"}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.categoryName || "-"} • {item.mediaTypeName || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground">{createdLabel}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Preview dialog */}
      <Dialog open={Boolean(previewItem)} onOpenChange={(open) => (!open ? setPreviewItem(null) : null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Preview</DialogTitle>
            <DialogDescription className="sr-only">Preview media</DialogDescription>
          </DialogHeader>

          {previewItem ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground break-all">{previewItem.name}</p>
              <div className="aspect-video w-full overflow-hidden rounded-md bg-muted">
                <UniversalFilePreview
                  source={{ kind: "remote", name: previewItem.name, mimeType: previewItem.type, url: previewItem.url }}
                  className="h-full w-full"
                />
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Change file confirmation */}
      <AlertDialog open={Boolean(changeConfirmItem)} onOpenChange={(open) => (!open ? setChangeConfirmItem(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change file?</AlertDialogTitle>
            <AlertDialogDescription>
              Replace file for <span className="font-medium">{changeConfirmItem?.name}</span>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!changeConfirmItem) return;
                pendingFilePickRef.current = true;
                setChangingItem(changeConfirmItem);
                setChangeConfirmItem(null);
              }}
            >
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename dialog */}
      <Dialog open={Boolean(renameItem)} onOpenChange={(open) => (!open ? setRenameItem(null) : null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit name</DialogTitle>
            <DialogDescription>Change the media name only (no file upload).</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Name</p>
            <Input value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)} placeholder="Media name" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenameItem(null)} disabled={renameSaving}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (!renameItem) return;
                const nextName = renameDraft.trim();
                if (!nextName) {
                  toast({ variant: "destructive", title: "Invalid name", description: "Name cannot be empty." });
                  return;
                }

                try {
                  setRenameSaving(true);
                  const { error } = await supabase.from("user_gallery").update({ name: nextName }).eq("id", renameItem.id);
                  if (error) throw error;

                  toast({ title: "Saved", description: "Name updated." });
                  setRenameItem(null);
                  await fetchItems();
                } catch (e: any) {
                  toast({ variant: "destructive", title: "Save failed", description: e?.message ?? "Unknown error" });
                } finally {
                  setRenameSaving(false);
                }
              }}
              disabled={renameSaving}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={Boolean(deleteItem)} onOpenChange={(open) => (!open ? setDeleteItem(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete media?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-medium">{deleteItem?.name}</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>Yes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

