import { useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Save, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { PageMetaCard } from "./website-pages/PageMetaCard";

import { blobToRows, PAGE_META_SETTINGS_KEY, rowsToBlob, type PageMetaRow } from "./website-pages/types";

export default function AdminWebsitePages() {
  const { toast } = useToast();

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activePickerFor, setActivePickerFor] = useState<string | null>(null);

  // Default: minimized per page card (ringkas) supaya tampilan utama tidak panjang.
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set());

  const [rows, setRows] = useState<PageMetaRow[]>(() => blobToRows(null, origin));
  const [baseline, setBaseline] = useState<PageMetaRow[]>(() => blobToRows(null, origin));

  const hasChanges = useMemo(() => {
    try {
      return JSON.stringify(rows) !== JSON.stringify(baseline);
    } catch {
      return true;
    }
  }, [baseline, rows]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("website_settings")
        .select("value")
        .eq("key", PAGE_META_SETTINGS_KEY)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        toast({ variant: "destructive", title: "Failed to load", description: error.message });
        const defaults = blobToRows(null, origin);
        setRows(defaults);
        setBaseline(defaults);
        setLoading(false);
        return;
      }

      const loaded = blobToRows(data?.value, origin);
      setRows(loaded);
      setBaseline(loaded);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [origin, toast]);

  const updateRow = (key: string, patch: Partial<PageMetaRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const cancelEdit = () => {
    setRows(baseline);
    setIsEditing(false);
  };

  const saveNow = async () => {
    if (saving) return;
    setSaving(true);
    const payload = rowsToBlob(rows);

    const { error } = await (supabase as any)
      .from("website_settings")
      .upsert({ key: PAGE_META_SETTINGS_KEY, value: payload }, { onConflict: "key" });

    if (error) {
      toast({ variant: "destructive", title: "Failed to save", description: error.message });
      setSaving(false);
      return;
    }

    setBaseline(rows);
    setIsEditing(false);
    setSaving(false);
    toast({ title: "Saved", description: "SEO / Meta Settings updated." });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">Pages</h1>
          <p className="text-sm text-muted-foreground">SEO / Meta Settings for each main page.</p>
          <div className="mt-2 text-xs text-muted-foreground">
            {loading ? (
              "Loading..."
            ) : saving ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
              </span>
            ) : isEditing ? (
              hasChanges ? (
                "Changes not saved."
              ) : (
                "No changes."
              )
            ) : (
              "Click Edit to modify settings."
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={cancelEdit} disabled={saving}>
                <X className="h-4 w-4 mr-2" /> Cancel
              </Button>
              <Button onClick={() => void saveNow()} disabled={saving || !hasChanges}>
                <Save className="h-4 w-4 mr-2" /> Done
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)} disabled={loading}>
              <Pencil className="h-4 w-4 mr-2" /> Edit
            </Button>
          )}
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Meta settings</CardTitle>
          <CardDescription>
            Meta Title, Meta Description, Canonical URL, and Open Graph image (FB/LinkedIn/WhatsApp).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {loading ? (
            <div className="py-8 text-sm text-muted-foreground">Loading...</div>
          ) : (
            rows.map((row) => (
              <PageMetaCard
                key={row.key}
                row={row}
                origin={origin}
                isEditing={isEditing}
                isOpen={openKeys.has(row.key)}
                onOpenChange={(open) => {
                  setOpenKeys((prev) => {
                    const next = new Set(prev);
                    if (open) next.add(row.key);
                    else next.delete(row.key);
                    return next;
                  });
                }}
                activePickerFor={activePickerFor}
                setActivePickerFor={setActivePickerFor}
                updateRow={updateRow}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
