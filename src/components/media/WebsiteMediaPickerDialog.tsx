import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, ImageIcon, Plus, Upload } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";

type WebsiteMediaPick = {
  url: string;
  name?: string;
  id?: string;
};

type WebsiteMediaItem = {
  id: string;
  name: string;
  url: string;
  media_type: string;
  created_at: string;
};

function safeFileName(name: string) {
  return (name || "file")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

function detectMediaType(file: File): "image" | "video" | "file" {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "file";
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  accept?: string;
  onPick: (pick: WebsiteMediaPick) => void;
};

export function WebsiteMediaPickerDialog({
  open,
  onOpenChange,
  title = "Select media",
  accept = "image/*",
  onPick,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"library" | "upload">("library");

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [items, setItems] = useState<WebsiteMediaItem[]>([]);

  const images = useMemo(() => items.filter((x) => x.media_type === "image"), [items]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("website_media_items")
        .select("id,name,url,media_type,created_at")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      setItems((data ?? []) as WebsiteMediaItem[]);
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Failed to load media",
        description: e?.message || "Something went wrong.",
      });
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadItems();
  }, [open, loadItems]);

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const uid = userData.user?.id;
      if (!uid) throw new Error("You must be logged in.");

      // Upload first selected file (simple picker UX)
      const f = files[0];
      const mediaType = detectMediaType(f);
      const cleaned = safeFileName(f.name);
      const storagePath = `website/${Date.now()}-${cleaned}`;

      const { error: uploadErr } = await supabase.storage.from("user-files").upload(storagePath, f, {
        contentType: f.type || "application/octet-stream",
        upsert: false,
      });
      if (uploadErr) throw uploadErr;

      const { data: publicData } = supabase.storage.from("user-files").getPublicUrl(storagePath);
      const publicUrl = publicData?.publicUrl;
      if (!publicUrl) throw new Error("Failed to create public URL.");

      const { data: inserted, error: insertErr } = await supabase
        .from("website_media_items")
        .insert({
          created_by: uid,
          name: f.name,
          media_type: mediaType,
          mime_type: f.type || "application/octet-stream",
          size: f.size,
          url: publicUrl,
          storage_path: storagePath,
        })
        .select("id,name,url,media_type,created_at")
        .single();

      if (insertErr) throw insertErr;

      toast({ title: "Uploaded", description: "Saved to the Media Library." });
      await loadItems();

      onPick({ url: inserted?.url ?? publicUrl, name: inserted?.name ?? f.name, id: inserted?.id });
      onOpenChange(false);
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: e?.message || "Something went wrong.",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Copied", description: "URL copied to clipboard." });
    } catch {
      toast({ variant: "destructive", title: "Copy failed", description: "Could not copy URL." });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="library">Media Library</TabsTrigger>
            <TabsTrigger value="upload">Upload</TabsTrigger>
          </TabsList>

          <TabsContent value="library" className="mt-4">
            {loading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Loading...</div>
            ) : images.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No images yet.</div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {images.map((it) => (
                  <button
                    type="button"
                    key={it.id}
                    className="group rounded-lg border border-border bg-card text-left overflow-hidden"
                    onClick={() => {
                      onPick({ url: it.url, name: it.name, id: it.id });
                      onOpenChange(false);
                    }}
                  >
                    <div className="aspect-video bg-muted overflow-hidden">
                      <img
                        src={it.url}
                        alt={it.name ? `Preview ${it.name}` : "Preview image"}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                      />
                    </div>
                    <div className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">{it.name}</div>
                          <div className="text-xs text-muted-foreground">{(it.created_at ?? "").slice(0, 10)}</div>
                        </div>
                        <div className="text-muted-foreground">
                          <ImageIcon className="h-4 w-4" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void copyUrl(it.url);
                          }}
                        >
                          <Copy className="h-4 w-4" />
                          Copy URL
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          asChild
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                        >
                          <a href={it.url} target="_blank" rel="noreferrer">
                            <Plus className="h-4 w-4" />
                            Open
                          </a>
                        </Button>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="upload" className="mt-4">
            <div className="space-y-3">
              <Label>Upload file</Label>
              <input ref={fileInputRef} type="file" className="hidden" accept={accept} onChange={handleUpload} />
              <Button type="button" onClick={handleUploadClick} disabled={uploading}>
                <Upload className="h-4 w-4" />
                {uploading ? "Uploading..." : "Choose a file"}
              </Button>
              <p className="text-xs text-muted-foreground">Uploaded files will also appear in the Media Library.</p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
