import { useMemo, useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";

export type BlogCategoryRow = {
  id: string;
  name: string;
  slug: string;
  parent_id?: string | null;
  is_locked?: boolean;
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
  categories: BlogCategoryRow[];
  selectedIds: string[];
  onSelectedIdsChange: (next: string[]) => void;
  onCreated?: (newCategory: BlogCategoryRow) => void;
  onDeleted?: (deletedId: string) => void;
};

export function CategoriesPanel({
  categories,
  selectedIds,
  onSelectedIdsChange,
  onCreated,
  onDeleted,
}: Props) {
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const parents = useMemo(() => categories, [categories]);

  const toggle = (id: string) => {
    onSelectedIdsChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  };

  const createCategory = async () => {
    const nm = name.trim();
    if (!nm) return;
    setSaving(true);
    try {
      const payload: any = { name: nm, slug: slugify(nm) };
      if (parentId) payload.parent_id = parentId;

      const { data, error } = await supabase
        .from("blog_categories")
        .insert(payload)
        .select("id,name,slug,parent_id,is_locked")
        .single();
      if (error) throw error;

      const created = data as BlogCategoryRow;
      onCreated?.(created);
      setName("");
      setParentId(null);
      setAdding(false);
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Failed to create category",
        description: e?.message || "Something went wrong.",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (cat: BlogCategoryRow) => {
    if (cat.is_locked) return;
    const ok = window.confirm(`Delete category "${cat.name}"?`);
    if (!ok) return;

    setDeletingId(cat.id);
    try {
      const { error } = await supabase.from("blog_categories").delete().eq("id", cat.id);
      if (error) throw error;

      // remove from selection
      if (selectedIds.includes(cat.id)) {
        onSelectedIdsChange(selectedIds.filter((x) => x !== cat.id));
      }

      onDeleted?.(cat.id);
      toast({ title: "Category deleted" });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Failed to delete category",
        description: e?.message || "Something went wrong.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-2">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center justify-between">
          <Label>Categories</Label>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label="Toggle categories">
              <ChevronDown className={"h-4 w-4 transition-transform " + (open ? "rotate-180" : "")} />
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="rounded-md border border-border p-3 space-y-2 max-h-52 overflow-auto">
            {categories.length ? (
              categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm min-w-0">
                    <Checkbox checked={selectedIds.includes(c.id)} onCheckedChange={() => toggle(c.id)} />
                    <span className="text-foreground truncate">{c.name}</span>
                  </label>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    disabled={!!c.is_locked || deletingId === c.id}
                    onClick={() => void deleteCategory(c)}
                    aria-label={`Delete category ${c.name}`}
                    title={c.is_locked ? "Category is locked" : "Delete"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">No categories yet.</div>
            )}

            <div className="pt-1">
              <Button type="button" variant="link" className="px-0 h-auto" onClick={() => setAdding((v) => !v)}>
                Add New Category
              </Button>
            </div>

            {adding ? (
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">NEW CATEGORY NAME</div>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Category name" />
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">PARENT CATEGORY</div>
                  <Select value={parentId ?? "__none"} onValueChange={(v) => setParentId(v === "__none" ? null : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="— Parent Category —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— Parent Category —</SelectItem>
                      {parents.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button type="button" onClick={() => void createCategory()} disabled={saving}>
                  {saving ? "Saving..." : "Add New Category"}
                </Button>
              </div>
            ) : null}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

