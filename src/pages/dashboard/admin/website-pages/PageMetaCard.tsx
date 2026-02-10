import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { WebsiteMediaPickerDialog } from "@/components/media/WebsiteMediaPickerDialog";
import type { PageMetaRow } from "./types";

type Props = {
  row: PageMetaRow;
  origin: string;
  isEditing: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  activePickerFor: string | null;
  setActivePickerFor: (key: string | null) => void;
  updateRow: (key: string, patch: Partial<PageMetaRow>) => void;
};

export function PageMetaCard({
  row,
  origin,
  isEditing,
  isOpen,
  onOpenChange,
  activePickerFor,
  setActivePickerFor,
  updateRow,
}: Props) {
  const descriptionLen = row.metaDescription.trim().length;
  const shortSummary = row.metaTitle?.trim() || "—";

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange}>
      <div className="rounded-lg border border-border bg-card">
        <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="text-left font-medium text-foreground hover:underline focus:outline-none"
                  aria-label={isOpen ? `Minimize ${row.label}` : `Expand ${row.label}`}
                >
                  {row.label}
                </button>
              </CollapsibleTrigger>
              {!isOpen ? (
                <span className="text-xs text-muted-foreground truncate max-w-[52ch]">{shortSummary}</span>
              ) : null}
            </div>
            <div className="text-xs text-muted-foreground truncate">{row.path}</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={row.path} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" /> Open
              </a>
            </Button>
            <CollapsibleTrigger asChild>
              <Button variant="secondary" size="sm" type="button">
                {isOpen ? "Minimize" : "Edit"}
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        <CollapsibleContent>
          <Separator />

          <div className="grid gap-4 p-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Meta Title</Label>
              <Input
                value={row.metaTitle}
                onChange={(e) => updateRow(row.key, { metaTitle: e.target.value })}
                disabled={!isEditing}
                placeholder="Under 60 characters"
              />
            </div>

            <div className="grid gap-2">
              <Label>Canonical URL</Label>
              <Input
                value={row.canonicalUrl}
                onChange={(e) => updateRow(row.key, { canonicalUrl: e.target.value })}
                disabled={!isEditing}
                placeholder={`${origin}${row.path}`}
              />
            </div>

            <div className="grid gap-2 md:col-span-2">
              <Label>Meta Description</Label>
              <Textarea
                value={row.metaDescription}
                onChange={(e) => updateRow(row.key, { metaDescription: e.target.value })}
                disabled={!isEditing}
                placeholder="Max 160 characters"
                rows={3}
              />
              <div className="text-xs text-muted-foreground">{descriptionLen}/160</div>
            </div>

            <div className="grid gap-2">
              <Label>Open Graph Image</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActivePickerFor(row.key)}
                  disabled={!isEditing}
                >
                  Choose image
                </Button>
                {row.ogImageUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => updateRow(row.key, { ogImageUrl: "", ogImageAlt: "" })}
                    disabled={!isEditing}
                  >
                    Clear
                  </Button>
                ) : null}
              </div>
              {row.ogImageUrl ? (
                <div className="mt-2 overflow-hidden rounded-md border border-border bg-muted">
                  <img
                    src={row.ogImageUrl}
                    alt={row.ogImageAlt || `OG image for ${row.label}`}
                    loading="lazy"
                    className="h-40 w-full object-cover"
                  />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No image set.</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Open Graph Image Alt</Label>
              <Input
                value={row.ogImageAlt}
                onChange={(e) => updateRow(row.key, { ogImageAlt: e.target.value })}
                disabled={!isEditing}
                placeholder="Describe the image"
              />
            </div>
          </div>

          <WebsiteMediaPickerDialog
            open={activePickerFor === row.key}
            onOpenChange={(open) => setActivePickerFor(open ? row.key : null)}
            title={`Set OG image for ${row.label}`}
            accept="image/*"
            onPick={(pick) => {
              updateRow(row.key, {
                ogImageUrl: pick.url,
                ogImageAlt: row.ogImageAlt || pick.name || row.label,
              });
            }}
          />
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
