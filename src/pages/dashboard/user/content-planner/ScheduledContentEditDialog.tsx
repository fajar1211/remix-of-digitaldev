import * as React from "react";

import { Pencil } from "lucide-react";

import ImageFieldCard from "@/components/dashboard/ImageFieldCard";
import { RichTextEditor } from "@/components/dashboard/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import PlatformDropdown from "@/pages/dashboard/assist/content-creation/PlatformDropdown";

export type ScheduledContentEditValues = {
  title: string;
  description: string;
  categoryName: string;
  contentTypeName: string;
  platform: string;
  primaryImageUrl: string;
  secondaryImageUrl: string;
  thirdImageUrl: string;
};

type ImageSlotState = { url: string; originalUrl: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: string[];
  contentTypes: string[];
  initialValues: ScheduledContentEditValues;
  saving?: boolean;
  onSave: (values: ScheduledContentEditValues) => void;
  mediaPicker?: { userId: string; businessId: string } | null;
  readOnly?: boolean;
};

export default function ScheduledContentEditDialog({
  open,
  onOpenChange,
  categories,
  contentTypes,
  initialValues,
  saving,
  onSave,
  mediaPicker = null,
  readOnly = false,
}: Props) {
  const [values, setValues] = React.useState<ScheduledContentEditValues>(initialValues);
  const [images, setImages] = React.useState<{
    primary: ImageSlotState;
    secondary: ImageSlotState;
    third: ImageSlotState;
  }>({
    primary: { url: initialValues.primaryImageUrl, originalUrl: initialValues.primaryImageUrl },
    secondary: { url: initialValues.secondaryImageUrl, originalUrl: initialValues.secondaryImageUrl },
    third: { url: initialValues.thirdImageUrl, originalUrl: initialValues.thirdImageUrl },
  });

  React.useEffect(() => {
    if (!open) return;
    setValues(initialValues);
    setImages({
      primary: { url: initialValues.primaryImageUrl, originalUrl: initialValues.primaryImageUrl },
      secondary: { url: initialValues.secondaryImageUrl, originalUrl: initialValues.secondaryImageUrl },
      third: { url: initialValues.thirdImageUrl, originalUrl: initialValues.thirdImageUrl },
    });
  }, [open, initialValues]);

  React.useEffect(() => {
    const needsPlatform =
      values.contentTypeName === "Social Media Posts" || values.contentTypeName === "Ads Marketing";
    if (!needsPlatform && values.platform) {
      setValues((p) => ({ ...p, platform: "" }));
    }
  }, [values.contentTypeName, values.platform]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-6xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{readOnly ? "View Scheduled Content" : "Edit Scheduled Content"}</DialogTitle>
          <DialogDescription>
            {readOnly
              ? "Editing is disabled for your current package."
              : "Update your scheduled content details and images."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Images</p>

            <div className="grid gap-3">
              <ImageFieldCard
                variant="compact"
                label="Primary Image"
                value={images.primary.url}
                originalValue={images.primary.originalUrl}
                onChange={(next) => setImages((p) => ({ ...p, primary: next }))}
                mediaPicker={mediaPicker}
                disabled={readOnly}
              />
              <ImageFieldCard
                variant="compact"
                label="Secondary Image"
                value={images.secondary.url}
                originalValue={images.secondary.originalUrl}
                onChange={(next) => setImages((p) => ({ ...p, secondary: next }))}
                mediaPicker={mediaPicker}
                disabled={readOnly}
              />
              <ImageFieldCard
                variant="compact"
                label="Third Image"
                value={images.third.url}
                originalValue={images.third.originalUrl}
                onChange={(next) => setImages((p) => ({ ...p, third: next }))}
                mediaPicker={mediaPicker}
                disabled={readOnly}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Title</Label>
                <Input
                  value={values.title}
                  disabled={readOnly}
                  onChange={(e) => setValues((p) => ({ ...p, title: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={values.categoryName || undefined}
                  onValueChange={(v) => setValues((p) => ({ ...p, categoryName: v }))}
                >
                  <SelectTrigger disabled={readOnly}>
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
                <Label>Type Content</Label>
                <Select
                  value={values.contentTypeName || undefined}
                  onValueChange={(v) =>
                    setValues((p) => ({
                      ...p,
                      contentTypeName: v,
                      platform: "",
                    }))
                  }
                >
                  <SelectTrigger disabled={readOnly}>
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

              <div className="sm:col-span-2">
                <PlatformDropdown
                  contentType={values.contentTypeName}
                  value={values.platform}
                  onChange={(v) => setValues((p) => ({ ...p, platform: v }))}
                  disabled={readOnly}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <RichTextEditor
                value={values.description}
                onChange={(v) => setValues((p) => ({ ...p, description: v }))}
                onSave={() => {}}
                isEditing={!readOnly}
                saving={false}
                title="Description"
                description="Write the content description."
                icon={Pencil}
                showTopBar={false}
                showSaveControls={false}
              />
            </div>

            <Separator />

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={readOnly || Boolean(saving)}
                onClick={() =>
                  onSave({
                    ...values,
                    primaryImageUrl: images.primary.url,
                    secondaryImageUrl: images.secondary.url,
                    thirdImageUrl: images.third.url,
                  })
                }
              >
                {readOnly ? "Editing disabled" : saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
