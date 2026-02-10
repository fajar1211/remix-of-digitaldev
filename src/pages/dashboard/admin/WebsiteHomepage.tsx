import { useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

import {
  defaultHomepagePromoSettings,
  sanitizeHomepagePromoSettings,
  type HomepagePromo,
  type HomepagePromoSettings,
} from "./website-homepage/types";

const SETTINGS_KEY = "homepage_promos";

const TEXT_EFFECT_OPTIONS: Array<{ value: HomepagePromo["textEffect"]; label: string }> = [
  { value: "none", label: "None" },
  { value: "blink", label: "Blink" },
  { value: "pulse", label: "Pulse" },
  { value: "glow", label: "Glow" },
  { value: "shake", label: "Shake" },
  { value: "bounce", label: "Bounce" },
  { value: "slide", label: "Slide" },
  { value: "fade", label: "Fade" },
  { value: "typewriter", label: "Typewriter" },
  { value: "flip", label: "Flip" },
  { value: "marquee", label: "Marquee" },
];

const ALIGN_OPTIONS: Array<{ value: NonNullable<HomepagePromo["titleAlign"]>; label: string }> = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

function toLocalInputValue(iso: string | null | undefined) {
  if (!iso) return "";
  // best-effort for <input type="datetime-local"> (YYYY-MM-DDTHH:mm)
  return String(iso).slice(0, 16);
}

function toIsoFromLocalInput(value: string) {
  if (!value) return null;
  // Treat as local time; store as ISO string so frontend can compare reliably.
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function WebsiteHomepage() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [settings, setSettings] = useState<HomepagePromoSettings>(defaultHomepagePromoSettings);
  const [baseline, setBaseline] = useState<HomepagePromoSettings>(defaultHomepagePromoSettings);

  const canSave = isEditing && !loading && !saving;

  const hasChanges = useMemo(() => {
    try {
      return JSON.stringify(settings) !== JSON.stringify(baseline);
    } catch {
      return true;
    }
  }, [baseline, settings]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("website_settings")
        .select("value")
        .eq("key", SETTINGS_KEY)
        .maybeSingle();

      if (error) {
        console.error("Failed to load homepage promo settings", error);
        setSettings(defaultHomepagePromoSettings);
        setBaseline(defaultHomepagePromoSettings);
      } else {
        const normalized = sanitizeHomepagePromoSettings(data?.value);
        setSettings(normalized);
        setBaseline(normalized);
      }
      setLoading(false);
    })();
  }, []);

  const saveNow = async (nextSettings: HomepagePromoSettings) => {
    setSaving(true);

    const { error } = await (supabase as any)
      .from("website_settings")
      .upsert({ key: SETTINGS_KEY, value: nextSettings }, { onConflict: "key" });

    if (error) {
      toast({ variant: "destructive", title: "Failed to save", description: error.message });
      setSaving(false);
      return false;
    }

    setLastSavedAt(new Date());
    setSaving(false);
    return true;
  };

  const cancelEdit = () => {
    setSettings(baseline);
    setIsEditing(false);
  };

  const finishEdit = async () => {
    const ok = await saveNow(settings);
    if (!ok) return;

    setBaseline(settings);
    setIsEditing(false);
  };

  const addPromo = () => {
    const promo: HomepagePromo = {
      id: crypto.randomUUID(),
      title: "New promo",
      subtitle: "",
      ctaLabel: "View",
      ctaHref: "/packages",
      textEffect: "none",
      titleAlign: "left",
      subtitleAlign: "left",
      startsAt: new Date().toISOString(),
      endsAt: null,
      isPublished: true,
    };

    setSettings((prev) => ({ ...prev, promos: [promo, ...(prev.promos ?? [])] }));
  };

  const removePromo = (id: string) => {
    setSettings((prev) => ({ ...prev, promos: (prev.promos ?? []).filter((p) => p.id !== id) }));
  };

  const updatePromo = (id: string, patch: Partial<HomepagePromo>) => {
    setSettings((prev) => ({
      ...prev,
      promos: (prev.promos ?? []).map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">Homepage</h1>
          <p className="text-sm text-muted-foreground">Manage the promo/banner shown at the top of the homepage.</p>
          <div className="mt-2 text-xs text-muted-foreground">
            {loading ? (
              "Loading..."
            ) : saving ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
              </span>
            ) : lastSavedAt ? (
              <>Saved at {lastSavedAt.toLocaleTimeString()}</>
            ) : (
              "Click Done to save changes."
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={cancelEdit} disabled={saving}>
                <X className="h-4 w-4 mr-2" /> Cancel
              </Button>
              <Button onClick={finishEdit} disabled={saving}>
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
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Promo / Banner</CardTitle>
            <CardDescription>Items show only when they are scheduled (Start/End) and Published.</CardDescription>
          </div>

          <Button type="button" onClick={addPromo} disabled={!canSave}>
            <Plus className="h-4 w-4" /> Add Promo
          </Button>
        </CardHeader>

        <CardContent className="space-y-6">
          {loading ? (
            <div className="py-8 text-sm text-muted-foreground">Loading...</div>
          ) : (settings.promos ?? []).length === 0 ? (
            <div className="py-8 text-sm text-muted-foreground">No promos yet.</div>
          ) : (
            (settings.promos ?? []).map((promo) => (
              <div key={promo.id} className="rounded-lg border border-border bg-card">
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">{promo.title || "(Untitled)"}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {promo.startsAt ? `Start: ${new Date(promo.startsAt).toLocaleString()}` : "Start: -"}
                      {promo.endsAt ? ` • End: ${new Date(promo.endsAt).toLocaleString()}` : " • End: -"}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Published</span>
                      <Switch
                        checked={promo.isPublished !== false}
                        onCheckedChange={(v) => updatePromo(promo.id, { isPublished: v })}
                        disabled={!canSave}
                      />
                    </div>

                    <Button type="button" variant="outline" size="sm" onClick={() => removePromo(promo.id)} disabled={!canSave}>
                      <Trash2 className="h-4 w-4" /> Delete
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 p-4 md:grid-cols-2">
                  <div className="grid gap-2 md:col-span-2">
                    <Label>Title</Label>
                    <Input value={promo.title} onChange={(e) => updatePromo(promo.id, { title: e.target.value })} disabled={!canSave} />
                  </div>

                  <div className="grid gap-2 md:col-span-2">
                    <Label>Subtitle</Label>
                    <Textarea
                      value={promo.subtitle ?? ""}
                      onChange={(e) => updatePromo(promo.id, { subtitle: e.target.value })}
                      disabled={!canSave}
                      rows={2}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Text effect</Label>
                    <Select
                      value={(promo.textEffect ?? "none") as any}
                      onValueChange={(v) => updatePromo(promo.id, { textEffect: v as any })}
                      disabled={!canSave}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select effect" />
                      </SelectTrigger>
                      <SelectContent>
                        {TEXT_EFFECT_OPTIONS.map((opt) => (
                          <SelectItem key={String(opt.value)} value={String(opt.value)}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Title alignment</Label>
                    <Select
                      value={(promo.titleAlign ?? "left") as any}
                      onValueChange={(v) => updatePromo(promo.id, { titleAlign: v as any })}
                      disabled={!canSave}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select alignment" />
                      </SelectTrigger>
                      <SelectContent>
                        {ALIGN_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Subtitle alignment</Label>
                    <Select
                      value={(promo.subtitleAlign ?? "left") as any}
                      onValueChange={(v) => updatePromo(promo.id, { subtitleAlign: v as any })}
                      disabled={!canSave}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select alignment" />
                      </SelectTrigger>
                      <SelectContent>
                        {ALIGN_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>CTA Label</Label>
                    <Input
                      value={promo.ctaLabel ?? ""}
                      onChange={(e) => updatePromo(promo.id, { ctaLabel: e.target.value })}
                      disabled={!canSave}
                      placeholder="View offer"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>CTA Link</Label>
                    <Input
                      value={promo.ctaHref ?? ""}
                      onChange={(e) => updatePromo(promo.id, { ctaHref: e.target.value })}
                      disabled={!canSave}
                      placeholder="/packages"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Start (schedule)</Label>
                    <Input
                      type="datetime-local"
                      value={toLocalInputValue(promo.startsAt ?? null)}
                      onChange={(e) => updatePromo(promo.id, { startsAt: toIsoFromLocalInput(e.target.value) })}
                      disabled={!canSave}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>End (schedule)</Label>
                    <Input
                      type="datetime-local"
                      value={toLocalInputValue(promo.endsAt ?? null)}
                      onChange={(e) => updatePromo(promo.id, { endsAt: toIsoFromLocalInput(e.target.value) })}
                      disabled={!canSave}
                    />
                    <p className="text-xs text-muted-foreground">Leave End empty if the promo has no end date.</p>
                  </div>
                </div>
              </div>
            ))
          )}

          {isEditing && !loading && (
            <div className="text-xs text-muted-foreground">{hasChanges ? "Changes not saved." : "No changes."}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
