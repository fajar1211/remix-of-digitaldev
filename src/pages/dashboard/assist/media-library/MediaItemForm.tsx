import * as React from "react";

import { ArrowLeft } from "lucide-react";

import MultiImageUpload, { type UploadItem } from "@/pages/dashboard/assist/media-library/MultiImageUpload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type BusinessOption = {
  id: string;
  name: string;
  publicId: string;
};

type Props = {
  businesses: BusinessOption[];
  categories: string[];
  mediaTypes: string[];
  onCancel: () => void;
  onSave: (payload: {
    businessId: string;
    businessName: string;
    category: string;
    mediaType: string;
    imageName: string;
    files: File[];
    generatedNames: string[];
  }) => void;
};

export default function MediaItemForm({ businesses, categories, mediaTypes, onCancel, onSave }: Props) {
  const { toast } = useToast();

  const [businessId, setBusinessId] = React.useState<string>("");
  const business = React.useMemo(() => businesses.find((b) => b.id === businessId), [businessId, businesses]);
  const businessName = business?.name ?? "";
  const businessPublicId = business?.publicId ?? "";

  const [category, setCategory] = React.useState<string>("");
  const [mediaType, setMediaType] = React.useState<string>("");
  const [imageName, setImageName] = React.useState<string>("");

  const [uploads, setUploads] = React.useState<UploadItem[]>([]);

  const uploadAccept = React.useMemo(() => {
    const t = mediaType.trim().toLowerCase();

    // Files / documents
    if (t === "files" || t.includes("file") || t.includes("doc") || t.includes("document")) {
      return [
        ".pdf",
        ".txt",
        ".doc",
        ".docx",
        ".xls",
        ".xlsx",
        "application/pdf",
        "text/plain",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ].join(",");
    }

    // Video
    if (t.includes("video")) return "video/*";

    // Default: images
    return "image/*";
  }, [mediaType]);

  const generatedNames = React.useMemo(() => {
    const base = imageName.trim();
    if (!base) return uploads.map(() => "");
    return uploads.map((_, idx) => (idx === 0 ? base : `${base}${idx}`));
  }, [uploads, imageName]);

  const handleSave = () => {
    const missing: string[] = [];
    if (!businessId) missing.push("Business Name");
    if (!category) missing.push("Category");
    if (!mediaType) missing.push("Type Content");
    if (!imageName.trim()) missing.push("Media Title");
    if (uploads.length === 0) missing.push("File Upload");

    if (missing.length > 0) {
      toast({
        variant: "destructive",
        title: "Missing required fields",
        description: `Please fill: ${missing.join(", ")}.`,
      });
      return;
    }

    onSave({
      businessId,
      businessName,
      category,
      mediaType,
      imageName: imageName.trim(),
      files: uploads.map((u) => u.file),
      generatedNames,
    });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-0.5"
            onClick={onCancel}
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-foreground">Add Media</h1>
            <p className="text-muted-foreground">Upload new media files for a client.</p>
          </div>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Content Details</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Business Name*</Label>
              <Select value={businessId || undefined} onValueChange={setBusinessId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose Business Name" />
                </SelectTrigger>
                <SelectContent className="z-50">
                  {businesses.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Business ID</Label>
              <Input value={businessPublicId} disabled />
            </div>

            <div className="space-y-2">
              <Label>Category*</Label>
              <Select value={category || undefined} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose Category" />
                </SelectTrigger>
                <SelectContent className="z-50">
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Type Content*</Label>
              <Select value={mediaType || undefined} onValueChange={setMediaType}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose Type Content" />
                </SelectTrigger>
                <SelectContent className="z-50">
                  {mediaTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Media Title*</Label>
              <Input value={imageName} onChange={(e) => setImageName(e.target.value)} placeholder="e.g. test" />
              {uploads.length > 0 && imageName.trim() ? (
                <p className="text-xs text-muted-foreground">
                  Generated names: {generatedNames.filter(Boolean).join(", ")}
                </p>
              ) : null}
            </div>
          </div>

          <MultiImageUpload baseName={imageName} accept={uploadAccept} items={uploads} onChange={setUploads} />
        </CardContent>

        <Separator />

        <CardFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save
          </Button>
        </CardFooter>
      </Card>
    </div>
  );

}
