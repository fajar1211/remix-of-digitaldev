import * as React from "react";

import { Trash2, Pencil } from "lucide-react";

import ImageFieldCard from "@/components/dashboard/ImageFieldCard";
import { RichTextEditor } from "@/components/dashboard/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

export type ContentItemEditValues = {
  title: string;
  description: string;
  category: string;
  contentType: string;
  platform: string;
  scheduledAt: string; // datetime-local
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
  initialValues: ContentItemEditValues;
  saving?: boolean;
  onSave: (values: ContentItemEditValues) => void;
  onDelete?: () => void;
  mediaPicker?: { userId: string; businessId: string } | null;
};

export default function ContentItemEditDialog({
  open,
  onOpenChange,
  categories,
  contentTypes,
  initialValues,
  saving,
  onSave,
  onDelete,
  mediaPicker = null,
}: Props) {
  const [values, setValues] = React.useState<ContentItemEditValues>(initialValues);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Edit Content</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Images</p>
              {onDelete ? (
                <Button type="button" variant="destructive" size="sm" onClick={onDelete}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Hapus
                </Button>
              ) : null}
            </div>

            <div className="grid gap-3">
              <ImageFieldCard
                variant="compact"
                label="Primary Image"
                value={images.primary.url}
                originalValue={images.primary.originalUrl}
                onChange={(next) => {
                  setImages((p) => ({ ...p, primary: next }));
                }}
                mediaPicker={mediaPicker}
              />
              <ImageFieldCard
                variant="compact"
                label="Secondary Image"
                value={images.secondary.url}
                originalValue={images.secondary.originalUrl}
                onChange={(next) => {
                  setImages((p) => ({ ...p, secondary: next }));
                }}
                mediaPicker={mediaPicker}
              />
              <ImageFieldCard
                variant="compact"
                label="Third Image"
                value={images.third.url}
                originalValue={images.third.originalUrl}
                onChange={(next) => {
                  setImages((p) => ({ ...p, third: next }));
                }}
                mediaPicker={mediaPicker}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Title</Label>
                <Input value={values.title} onChange={(e) => setValues((p) => ({ ...p, title: e.target.value }))} />
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={values.category || undefined} onValueChange={(v) => setValues((p) => ({ ...p, category: v }))}>
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
                <Label>Type Content</Label>
                <Select
                  value={values.contentType || undefined}
                  onValueChange={(v) =>
                    setValues((p) => ({
                      ...p,
                      contentType: v,
                      platform: "",
                    }))
                  }
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

              <PlatformDropdown contentType={values.contentType} value={values.platform} onChange={(v) => setValues((p) => ({ ...p, platform: v }))} />

              <div className="space-y-2">
                <Label>Scheduled</Label>
                <Input
                  type="datetime-local"
                  value={values.scheduledAt}
                  onChange={(e) => setValues((p) => ({ ...p, scheduledAt: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <RichTextEditor
                value={values.description}
                onChange={(v) => setValues((p) => ({ ...p, description: v }))}
                onSave={() => {}}
                isEditing
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
                disabled={Boolean(saving)}
                onClick={() =>
                  onSave({
                    ...values,
                    primaryImageUrl: images.primary.url,
                    secondaryImageUrl: images.secondary.url,
                    thirdImageUrl: images.third.url,
                  })
                }
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
