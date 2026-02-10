import * as React from "react";

import { Pencil, Trash2 } from "lucide-react";

import ImageFieldCard from "@/components/dashboard/ImageFieldCard";
import { RichTextEditor } from "@/components/dashboard/RichTextEditor";
import { Button } from "@/components/ui/button";
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

export type ContentItemInlineEditValues = {
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
  categories: string[];
  contentTypes: string[];
  initialValues: ContentItemInlineEditValues;
  saving?: boolean;
  readOnly?: boolean;
  onSave?: (values: ContentItemInlineEditValues) => void;
  onCancel?: () => void;
  onDelete?: () => void;
  mediaPicker?: { userId: string; businessId: string } | null;
};

export default function ContentItemInlineEditor({
  categories,
  contentTypes,
  initialValues,
  saving,
  readOnly = false,
  onSave,
  onCancel,
  onDelete,
  mediaPicker = null,
}: Props) {
  const [values, setValues] = React.useState<ContentItemInlineEditValues>(initialValues);
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
    setValues(initialValues);
    setImages({
      primary: { url: initialValues.primaryImageUrl, originalUrl: initialValues.primaryImageUrl },
      secondary: { url: initialValues.secondaryImageUrl, originalUrl: initialValues.secondaryImageUrl },
      third: { url: initialValues.thirdImageUrl, originalUrl: initialValues.thirdImageUrl },
    });
  }, [initialValues]);

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-foreground">Edit Mode</p>
          {onDelete && (
            <Button type="button" variant="destructive" size="sm" onClick={onDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_4fr]">
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Images</p>
          <div className="grid gap-3">
            <ImageFieldCard
              variant="compact"
              label="Primary Image"
              value={images.primary.url}
              originalValue={images.primary.originalUrl}
              onChange={(next) => setImages((p) => ({ ...p, primary: next }))}
              disabled={readOnly}
              mediaPicker={mediaPicker}
            />
            <ImageFieldCard
              variant="compact"
              label="Secondary Image"
              value={images.secondary.url}
              originalValue={images.secondary.originalUrl}
              onChange={(next) => setImages((p) => ({ ...p, secondary: next }))}
              disabled={readOnly}
              mediaPicker={mediaPicker}
            />
            <ImageFieldCard
              variant="compact"
              label="Third Image"
              value={images.third.url}
              originalValue={images.third.originalUrl}
              onChange={(next) => setImages((p) => ({ ...p, third: next }))}
              disabled={readOnly}
              mediaPicker={mediaPicker}
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
              <Select value={values.category || undefined} onValueChange={(v) => setValues((p) => ({ ...p, category: v }))}>
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
                value={values.contentType || undefined}
                onValueChange={(v) => setValues((p) => ({ ...p, contentType: v, platform: "" }))}
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

            <PlatformDropdown
              contentType={values.contentType}
              value={values.platform}
              onChange={(v) => setValues((p) => ({ ...p, platform: v }))}
              disabled={readOnly}
            />

            <div className="space-y-2">
              <Label>Scheduled</Label>
              <Input
                type="datetime-local"
                value={values.scheduledAt}
                disabled={readOnly}
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
              isEditing={!readOnly}
              saving={false}
              title="Description"
              description="Write the content description."
              icon={Pencil}
              showTopBar={false}
              showSaveControls={false}
            />
          </div>

          {!readOnly && (
            <>
              <Separator />

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={Boolean(saving)}
                  onClick={() =>
                    onSave?.({
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
