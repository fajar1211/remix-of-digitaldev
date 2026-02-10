import * as React from "react";

import { Eye, Copy, Link2, Upload, RotateCcw, Loader2 } from "lucide-react";

import MediaImagePickerDialog from "@/components/media/MediaImagePickerDialog";
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
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  label: string;
  value: string;
  originalValue: string;
  onChange: (next: { url: string; originalUrl: string }) => void;
  variant?: "default" | "compact";
  disabled?: boolean;
  mediaPicker?: { userId: string; businessId: string } | null;
};

function IconActionButton({
  label,
  onClick,
  icon,
  disabled,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export default function ImageFieldCard({
  label,
  value,
  originalValue,
  onChange,
  variant = "default",
  disabled = false,
  mediaPicker = null,
}: Props) {
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [uploading, setUploading] = React.useState(false);

  const [urlDialogOpen, setUrlDialogOpen] = React.useState(false);
  const [mediaDialogOpen, setMediaDialogOpen] = React.useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = React.useState(false);
  const [draftUrl, setDraftUrl] = React.useState(value);

  React.useEffect(() => {
    setDraftUrl(value);
  }, [value]);

  const preview = () => {
    if (!value) return;
    setPreviewDialogOpen(true);
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: "Copied", description: "URL copied to clipboard." });
    } catch {
      toast({ title: "Failed", description: "Unable to copy the URL in this browser." });
    }
  };

  const reset = () => {
    onChange({ url: originalValue, originalUrl: originalValue });
    toast({ title: "Reset", description: `${label} reverted to the original.` });
  };

  const openFilePicker = () => {
    if (disabled || uploading) return;
    fileInputRef.current?.click();
  };

  const onPickFile: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    if (disabled || uploading) return;

    const file = e.target.files?.[0];
    if (!file) return;

    // allow picking the same file again
    e.target.value = "";

    void (async () => {
      setUploading(true);
      try {
        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        const userId = userRes.user?.id;
        if (!userId) throw new Error("Not authenticated");

        const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const filePath = `content-images/${userId}/${Date.now()}-${safeFileName}`;

        const { error: uploadError } = await supabase.storage.from("user-files").upload(filePath, file, {
          upsert: true,
          cacheControl: "3600",
          contentType: file.type,
        });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("user-files").getPublicUrl(filePath);
        const publicUrl = urlData.publicUrl;

        onChange({ url: publicUrl, originalUrl: originalValue });
        toast({ title: "Image uploaded", description: `${label} was uploaded and is ready to save.` });
      } catch (err: any) {
        toast({ variant: "destructive", title: "Upload failed", description: err?.message ?? "Unknown error" });
      } finally {
        setUploading(false);
      }
    })();
  };

  const saveUrl = () => {
    const next = draftUrl.trim();
    if (!next) return;
    onChange({ url: next, originalUrl: originalValue });
    setUrlDialogOpen(false);
    toast({ title: "Image updated", description: `${label} updated via URL.` });
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle className={variant === "compact" ? "text-sm" : "text-base"}>{label}</CardTitle>
      </CardHeader>

      <CardContent className={variant === "compact" ? "space-y-2" : "space-y-3"}>
        <div className="overflow-hidden rounded-md border">
          <button
            type="button"
            onClick={preview}
            disabled={!value}
            className="block w-full disabled:cursor-not-allowed"
            aria-label={`Preview ${label}`}
          >
            <img
              src={value || "/placeholder.svg"}
              alt={`${label} image preview`}
              loading="lazy"
              className={variant === "compact" ? "h-24 w-full object-cover cursor-zoom-in" : "h-48 w-full object-cover cursor-zoom-in"}
            />
          </button>
        </div>

        <TooltipProvider delayDuration={150}>
          <div className="flex flex-wrap gap-2">
            <IconActionButton
              label="Preview"
              onClick={preview}
              icon={<Eye className="h-4 w-4" />}
              disabled={!value || uploading}
            />
            <IconActionButton
              label="Copy URL"
              onClick={() => void copyUrl()}
              icon={<Copy className="h-4 w-4" />}
              disabled={!value || uploading}
            />
            <IconActionButton
              label="Change Image"
              onClick={() => {
                if (disabled || uploading) return;

                if (mediaPicker?.userId && mediaPicker?.businessId) {
                  setMediaDialogOpen(true);
                  return;
                }

                setUrlDialogOpen(true);
              }}
              icon={<Link2 className="h-4 w-4" />}
              disabled={disabled || uploading}
            />
            <IconActionButton
              label={uploading ? "Uploading..." : "Add From Computer"}
              onClick={openFilePicker}
              icon={uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              disabled={disabled || uploading}
            />
            <IconActionButton
              label="Reset to Original"
              onClick={reset}
              icon={<RotateCcw className="h-4 w-4" />}
              disabled={disabled || uploading}
            />
          </div>
        </TooltipProvider>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPickFile}
          disabled={disabled}
        />
      </CardContent>

      {mediaPicker?.userId && mediaPicker?.businessId ? (
        <MediaImagePickerDialog
          open={mediaDialogOpen}
          onOpenChange={setMediaDialogOpen}
          userId={mediaPicker.userId}
          businessId={mediaPicker.businessId}
          onPick={(url) => {
            onChange({ url, originalUrl: originalValue });
            toast({ title: "Image selected", description: `${label} updated from Media Library.` });
          }}
        />
      ) : null}

      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{label} Preview</DialogTitle>
            <DialogDescription>Preview the current image.</DialogDescription>
          </DialogHeader>
          <div className="overflow-hidden rounded-md border">
            <img
              src={value || "/placeholder.svg"}
              alt={`${label} full preview`}
              className="max-h-[70vh] w-full object-contain"
              loading="lazy"
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={urlDialogOpen} onOpenChange={setUrlDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Change Image URL</DialogTitle>
            <DialogDescription>Paste a new image URL for {label}.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Image URL</Label>
            <Input value={draftUrl} onChange={(e) => setDraftUrl(e.target.value)} placeholder="https://..." />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setUrlDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveUrl}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
