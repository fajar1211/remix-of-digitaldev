import { useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

import {
  defaultDashboardBannerSettings,
  sanitizeDashboardBannerSettings,
  type DashboardBanner,
  type DashboardBannerSettings,
} from "./dashboard-banners/types";

const SETTINGS_KEY = "dashboard_banners";

function toLocalInputValue(iso: string | null | undefined) {
  if (!iso) return "";
  return String(iso).slice(0, 16);
}

function toIsoFromLocalInput(value: string) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function DashboardBanners() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [settings, setSettings] = useState<DashboardBannerSettings>(defaultDashboardBannerSettings);
  const [baseline, setBaseline] = useState<DashboardBannerSettings>(defaultDashboardBannerSettings);

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
        console.error("Failed to load dashboard banners", error);
        setSettings(defaultDashboardBannerSettings);
        setBaseline(defaultDashboardBannerSettings);
      } else {
        const normalized = sanitizeDashboardBannerSettings(data?.value);
        setSettings(normalized);
        setBaseline(normalized);
      }
      setLoading(false);
    })();
  }, []);

  const saveNow = async (nextSettings: DashboardBannerSettings) => {
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

  const addBanner = () => {
    const banner: DashboardBanner = {
      id: crypto.randomUUID(),
      title: "New event",
      subtitle: "",
      titleAlign: "left",
      subtitleAlign: "left",
      textEffect: "marquee",
      ctaLabel: null,
      ctaHref: null,
      startsAt: new Date().toISOString(),
      endsAt: null,
      isPublished: true,
      showOnUserOverview: true,
      showOnAssistOverview: true,
    };
    setSettings((prev) => ({ ...prev, banners: [banner, ...(prev.banners ?? [])] }));
  };

  const removeBanner = (id: string) => {
    setSettings((prev) => ({ ...prev, banners: (prev.banners ?? []).filter((b) => b.id !== id) }));
  };

  const updateBanner = (id: string, patch: Partial<DashboardBanner>) => {
    setSettings((prev) => ({
      ...prev,
      banners: (prev.banners ?? []).map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">Dashboard Banners</h1>
          <p className="text-sm text-muted-foreground">
            Manage scheduled event banners shown on User Overview and Assist Overview.
          </p>
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
            <CardTitle>Event Banners</CardTitle>
            <CardDescription>Items show only when they are scheduled (Start/End) and Published.</CardDescription>
          </div>
          <Button type="button" onClick={addBanner} disabled={!canSave}>
            <Plus className="h-4 w-4" /> Add Banner
          </Button>
        </CardHeader>

        <CardContent className="space-y-6">
          {loading ? (
            <div className="py-8 text-sm text-muted-foreground">Loading...</div>
          ) : (settings.banners ?? []).length === 0 ? (
            <div className="py-8 text-sm text-muted-foreground">No banners yet.</div>
          ) : (
            (settings.banners ?? []).map((banner) => (
              <div key={banner.id} className="rounded-lg border border-border bg-card">
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">{banner.title || "(Untitled)"}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {banner.startsAt ? `Start: ${new Date(banner.startsAt).toLocaleString()}` : "Start: -"}
                      {banner.endsAt ? ` • End: ${new Date(banner.endsAt).toLocaleString()}` : " • End: -"}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Published</span>
                      <Switch
                        checked={banner.isPublished !== false}
                        onCheckedChange={(v) => updateBanner(banner.id, { isPublished: v })}
                        disabled={!canSave}
                      />
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeBanner(banner.id)}
                      disabled={!canSave}
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 p-4 md:grid-cols-2">
                  <div className="grid gap-2 md:col-span-2">
                    <Label>Title</Label>
                    <Input value={banner.title} onChange={(e) => updateBanner(banner.id, { title: e.target.value })} disabled={!canSave} />
                  </div>

                  <div className="grid gap-2 md:col-span-2">
                    <Label>Subtitle</Label>
                    <Textarea
                      value={banner.subtitle ?? ""}
                      onChange={(e) => updateBanner(banner.id, { subtitle: e.target.value })}
                      disabled={!canSave}
                      rows={2}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Title alignment</Label>
                    <Select
                      value={banner.titleAlign ?? "left"}
                      onValueChange={(v) => updateBanner(banner.id, { titleAlign: v as any })}
                      disabled={!canSave}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Left" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="center">Center</SelectItem>
                        <SelectItem value="right">Right</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Subtitle alignment</Label>
                    <Select
                      value={banner.subtitleAlign ?? "left"}
                      onValueChange={(v) => updateBanner(banner.id, { subtitleAlign: v as any })}
                      disabled={!canSave}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Left" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="center">Center</SelectItem>
                        <SelectItem value="right">Right</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Text effect</Label>
                    <Select
                      value={banner.textEffect ?? "marquee"}
                      onValueChange={(v) => updateBanner(banner.id, { textEffect: v as any })}
                      disabled={!canSave}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose effect" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="marquee">Marquee</SelectItem>
                        <SelectItem value="blink">Blink</SelectItem>
                        <SelectItem value="pulse">Pulse</SelectItem>
                        <SelectItem value="glow">Glow</SelectItem>
                        <SelectItem value="shake">Shake</SelectItem>
                        <SelectItem value="bounce">Bounce</SelectItem>
                        <SelectItem value="slide">Slide</SelectItem>
                        <SelectItem value="fade">Fade</SelectItem>
                        <SelectItem value="typewriter">Typewriter</SelectItem>
                        <SelectItem value="flip">Flip</SelectItem>
                        <SelectItem value="none">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>CTA Label</Label>
                    <Input
                      value={banner.ctaLabel ?? ""}
                      onChange={(e) => updateBanner(banner.id, { ctaLabel: e.target.value })}
                      disabled={!canSave}
                      placeholder="Open"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>CTA Link</Label>
                    <Input
                      value={banner.ctaHref ?? ""}
                      onChange={(e) => updateBanner(banner.id, { ctaHref: e.target.value })}
                      disabled={!canSave}
                      placeholder="/dashboard/user/overview"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Start (schedule)</Label>
                    <Input
                      type="datetime-local"
                      value={toLocalInputValue(banner.startsAt ?? null)}
                      onChange={(e) => updateBanner(banner.id, { startsAt: toIsoFromLocalInput(e.target.value) })}
                      disabled={!canSave}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>End (schedule)</Label>
                    <Input
                      type="datetime-local"
                      value={toLocalInputValue(banner.endsAt ?? null)}
                      onChange={(e) => updateBanner(banner.id, { endsAt: toIsoFromLocalInput(e.target.value) })}
                      disabled={!canSave}
                    />
                    <p className="text-xs text-muted-foreground">Leave End empty if the banner has no end date.</p>
                  </div>

                  <div className="grid gap-3 md:col-span-2">
                    <Label>Show on</Label>
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={banner.showOnUserOverview === true}
                          onCheckedChange={(v) => updateBanner(banner.id, { showOnUserOverview: v })}
                          disabled={!canSave}
                        />
                        <span className="text-sm text-foreground">User Overview</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={banner.showOnAssistOverview === true}
                          onCheckedChange={(v) => updateBanner(banner.id, { showOnAssistOverview: v })}
                          disabled={!canSave}
                        />
                        <span className="text-sm text-foreground">Assist Overview</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Tip: turn off both to hide without deleting.</p>
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
