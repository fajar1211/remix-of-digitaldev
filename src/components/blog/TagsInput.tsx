import { useMemo, useState } from "react";
import { X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type BlogTagRow = {
  id: string;
  name: string;
  slug: string;
};

const slugify = (input: string) =>
  input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

type Props = {
  tags: BlogTagRow[];
  selectedIds: string[];
  onSelectedIdsChange: (next: string[]) => void;
  onTagsChange?: (next: BlogTagRow[]) => void;
};

export function TagsInput({ tags, selectedIds, onSelectedIdsChange, onTagsChange }: Props) {
  const [input, setInput] = useState("");
  const selectedTags = useMemo(() => tags.filter((t) => selectedIds.includes(t.id)), [tags, selectedIds]);

  const remove = (id: string) => onSelectedIdsChange(selectedIds.filter((x) => x !== id));

  const addByName = async (raw: string) => {
    const name = raw.trim();
    if (!name) return;

    const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase()) ?? null;
    if (existing) {
      if (!selectedIds.includes(existing.id)) onSelectedIdsChange([...selectedIds, existing.id]);
      return;
    }

    const payload = { name, slug: slugify(name) };
    const { data, error } = await supabase
      .from("blog_tags")
      .insert(payload)
      .select("id,name,slug")
      .single();

    if (error) throw error;

    const created = data as BlogTagRow;
    onTagsChange?.([...tags, created]);
    onSelectedIdsChange([...selectedIds, created.id]);
  };

  const commit = async () => {
    const tokens = input
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    if (!tokens.length) return;
    setInput("");

    for (const t of tokens) {
      // eslint-disable-next-line no-await-in-loop
      await addByName(t);
    }
  };

  return (
    <div className="space-y-2">
      <Label>Tags</Label>
      <div className="rounded-md border border-border p-3 space-y-2">
        <div className="flex flex-wrap gap-2">
          {selectedTags.map((t) => (
            <Badge key={t.id} variant="secondary" className="gap-1">
              {t.name}
              <button
                type="button"
                className="ml-1 inline-flex items-center"
                onClick={() => remove(t.id)}
                aria-label={`Remove tag ${t.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>

        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add new tag"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void commit();
            }
            if (e.key === ",") {
              e.preventDefault();
              void commit();
            }
          }}
          onBlur={() => {
            if (input.trim()) void commit();
          }}
        />
        <p className="text-xs text-muted-foreground">Separate with commas or the Enter key.</p>
      </div>
    </div>
  );
}
