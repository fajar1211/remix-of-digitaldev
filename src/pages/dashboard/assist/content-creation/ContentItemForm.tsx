import * as React from "react";

import { ArrowLeft, Type } from "lucide-react";

import ImageFieldCard from "@/components/dashboard/ImageFieldCard";
import { RichTextEditor } from "@/components/dashboard/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import PlatformDropdown from "@/pages/dashboard/assist/content-creation/PlatformDropdown";

type BusinessOption = {
  id: string;
  name: string;
  publicId?: string;
  userId?: string;
};

type ImageSlotState = {
  url: string;
  originalUrl: string;
};

type Props = {
  businesses: BusinessOption[];
  categories: string[];
  contentTypes: string[];
  onCancel: () => void;
  onSave: (payload: {
    businessId: string;
    businessPublicId: string;
    businessName: string;
    category: string;
    contentType: string;
    platform: string;
    title: string;
    description: string;
    scheduledAt: string;
    primaryImageUrl: string;
    secondaryImageUrl: string;
    thirdImageUrl: string;
  }) => void;
};

export default function ContentItemForm({
  businesses,
  categories,
  contentTypes,
  onCancel,
  onSave,
}: Props) {
  const { toast } = useToast();

  const [businessId, setBusinessId] = React.useState<string>("");
  const business = React.useMemo(() => businesses.find((b) => b.id === businessId), [businessId, businesses]);
  const businessName = business?.name ?? "";
  const businessPublicId = business?.publicId ?? businessId;

  const [category, setCategory] = React.useState<string>("");
  const [contentType, setContentType] = React.useState<string>("");
  const [platform, setPlatform] = React.useState<string>("");
  const [title, setTitle] = React.useState<string>("");
  const [description, setDescription] = React.useState<string>("");
  const [scheduledAt, setScheduledAt] = React.useState<string>("");

  React.useEffect(() => {
    const needsPlatform = contentType === "Social Media Posts" || contentType === "Ads Marketing";
    if (!needsPlatform) setPlatform("");
  }, [contentType]);

  const [images, setImages] = React.useState<{
    primary: ImageSlotState;
    secondary: ImageSlotState;
    third: ImageSlotState;
  }>({
    primary: { url: "/placeholder.svg", originalUrl: "/placeholder.svg" },
    secondary: { url: "/placeholder.svg", originalUrl: "/placeholder.svg" },
    third: { url: "/placeholder.svg", originalUrl: "/placeholder.svg" },
  });

  const handleSave = () => {
    const descriptionText = description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

    const missing: string[] = [];
    if (!businessId) missing.push("Business Name");
    if (!category) missing.push("Category");
    if (!contentType) missing.push("Type Content");
    if (!descriptionText) missing.push("Description");

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
      businessPublicId,
      businessName,
      category,
      contentType,
      platform,
      title,
      description,
      scheduledAt,
      primaryImageUrl: images.primary.url,
      secondaryImageUrl: images.secondary.url,
      thirdImageUrl: images.third.url,
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
            <h1 className="text-3xl font-bold text-foreground">Add Content</h1>
            <p className="text-muted-foreground">Upload Images for Client</p>
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
              <Select
                value={contentType || undefined}
                onValueChange={(next) => {
                  setContentType(next);
                  setPlatform("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose Type Content" />
                </SelectTrigger>
                <SelectContent className="z-50">
                  {contentTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <PlatformDropdown contentType={contentType} value={platform} onChange={setPlatform} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Content title..." />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Description*</Label>
              <RichTextEditor
                value={description}
                onChange={setDescription}
                onSave={() => {}}
                isEditing
                saving={false}
                title="Description"
                description="Write the content description."
                icon={Type}
                showTopBar={false}
                showSaveControls={false}
              />
            </div>

            <div className="space-y-2">
              <Label>Scheduled</Label>
              <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-semibold text-foreground">Images</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <ImageFieldCard
                variant="compact"
                label="Primary Image"
                value={images.primary.url}
                originalValue={images.primary.originalUrl}
                onChange={(next) => setImages((p) => ({ ...p, primary: next }))}
                mediaPicker={businessId && business?.userId ? { businessId, userId: business.userId } : null}
              />
              <ImageFieldCard
                variant="compact"
                label="Secondary Image"
                value={images.secondary.url}
                originalValue={images.secondary.originalUrl}
                onChange={(next) => setImages((p) => ({ ...p, secondary: next }))}
                mediaPicker={businessId && business?.userId ? { businessId, userId: business.userId } : null}
              />
              <ImageFieldCard
                variant="compact"
                label="Third Image"
                value={images.third.url}
                originalValue={images.third.originalUrl}
                onChange={(next) => setImages((p) => ({ ...p, third: next }))}
                mediaPicker={businessId && business?.userId ? { businessId, userId: business.userId } : null}
              />
            </div>
          </div>
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
