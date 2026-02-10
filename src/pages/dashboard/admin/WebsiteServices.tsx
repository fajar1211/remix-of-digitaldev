import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

import {
  defaultServicesSettings,
  sanitizeServicesSettings,
  type ServiceIconKey,
  type ServiceItem,
  type ServicesPageSettings,
} from "./website-services/types";

const SETTINGS_KEY = "services_page";

const iconOptions: { value: ServiceIconKey; label: string }[] = [
  { value: "globe", label: "Globe" },
  { value: "message", label: "Chat" },
  { value: "code", label: "Code" },
  { value: "file", label: "File" },
  { value: "handshake", label: "Handshake" },
];

function featuresToTextarea(features: string[]) {
  return (features ?? []).join("\n");
}

function textareaToFeatures(value: string) {
  return value
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

export default function WebsiteServices() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});

  const [settings, setSettings] = useState<ServicesPageSettings>(defaultServicesSettings);
  const [baseline, setBaseline] = useState<ServicesPageSettings>(defaultServicesSettings);

  const serviceCount = settings.services.length;

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
        console.error("Failed to load services settings", error);
        setSettings(defaultServicesSettings);
        setBaseline(defaultServicesSettings);
      } else {
        const normalized = sanitizeServicesSettings(data?.value);
        setSettings(normalized);
        setBaseline(normalized);
      }
      setLoading(false);
    })();
  }, []);


  const saveNow = async (nextSettings: ServicesPageSettings) => {
    setSaving(true);
    const payload = { key: SETTINGS_KEY, value: nextSettings };

    const { error } = await (supabase as any)
      .from("website_settings")
      .upsert(payload, { onConflict: "key" });

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

  const updateHero = (patch: Partial<Pick<ServicesPageSettings, "heroTitle" | "heroSubtitle" | "ctaTitle" | "ctaSubtitle">>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  const updateService = (index: number, patch: Partial<ServiceItem>) => {
    setSettings((prev) => {
      const next = [...prev.services];
      next[index] = { ...next[index], ...patch };
      return { ...prev, services: next };
    });
  };

  const removeService = (index: number) => {
    setSettings((prev) => ({ ...prev, services: prev.services.filter((_, i) => i !== index) }));
  };

  const addService = () => {
    setSettings((prev) => ({
      ...prev,
      services: [
        ...prev.services,
        { icon: "globe", title: "New Service", description: "", features: ["One key feature"] },
      ],
    }));
  };

  const moveService = (from: number, to: number) => {
    setSettings((prev) => {
      const next = [...prev.services];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return { ...prev, services: next };
    });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">Services Page</h1>
          <p className="text-sm text-muted-foreground">Edit content for the public /services page.</p>
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
        <CardHeader>
          <CardTitle>Hero</CardTitle>
          <CardDescription>Title and subtitle at the top of the /services page.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label>Hero Title</Label>
            <Input
              value={settings.heroTitle}
              onChange={(e) => updateHero({ heroTitle: e.target.value })}
              disabled={!canSave}
              placeholder="Marketing Services That Actually Help"
            />
          </div>
          <div className="grid gap-2">
            <Label>Hero Subtitle</Label>
            <Textarea
              value={settings.heroSubtitle}
              onChange={(e) => updateHero({ heroSubtitle: e.target.value })}
              disabled={!canSave}
              rows={3}
              placeholder="No fluff, no jargon..."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Services</CardTitle>
            <CardDescription>{serviceCount} service items (order here = public order).</CardDescription>
          </div>

          <Button type="button" onClick={addService} disabled={!canSave}>
            <Plus className="h-4 w-4" /> Add Service
          </Button>
        </CardHeader>

        <CardContent className="space-y-6">
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
          ) : settings.services.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No services yet.</div>
          ) : (
            settings.services.map((svc, index) => {
              const isCollapsed = collapsed[index] ?? true;

              return (
                <Collapsible
                  key={`${svc.title}-${index}`}
                  open={!isCollapsed}
                  onOpenChange={(open) => setCollapsed((p) => ({ ...p, [index]: !open }))}
                  className="rounded-lg border border-border bg-card"
                >
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <CollapsibleTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={!canSave}
                          aria-label={isCollapsed ? "Expand service" : "Collapse service"}
                        >
                          {isCollapsed ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <div className="min-w-0">
                        <div className="font-medium text-foreground truncate">{svc.title || "(Untitled)"}</div>
                        <div className="text-xs text-muted-foreground truncate">{svc.description || "No description"}</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => moveService(index, Math.max(0, index - 1))}
                        disabled={!canSave || index === 0}
                      >
                        Up
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => moveService(index, Math.min(settings.services.length - 1, index + 1))}
                        disabled={!canSave || index === settings.services.length - 1}
                      >
                        Down
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeService(index)}
                        disabled={!canSave}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>

                  <CollapsibleContent>
                    <Separator />

                    <div className="grid gap-4 p-4 md:grid-cols-2">
                      <div className="grid gap-2">
                        <Label>Icon</Label>
                        <Select
                          value={svc.icon}
                          onValueChange={(v) => updateService(index, { icon: v as ServiceIconKey })}
                          disabled={!canSave}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select icon" />
                          </SelectTrigger>
                          <SelectContent>
                            {iconOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label>Title</Label>
                        <Input
                          value={svc.title}
                          onChange={(e) => updateService(index, { title: e.target.value })}
                          disabled={!canSave}
                          placeholder="Service name"
                        />
                      </div>

                      <div className="grid gap-2 md:col-span-2">
                        <Label>Description</Label>
                        <Textarea
                          value={svc.description}
                          onChange={(e) => updateService(index, { description: e.target.value })}
                          disabled={!canSave}
                          rows={2}
                          placeholder="Short description"
                        />
                      </div>

                      <div className="grid gap-2 md:col-span-2">
                        <Label>Features (one per line)</Label>
                        <Textarea
                          value={featuresToTextarea(svc.features)}
                          onChange={(e) => updateService(index, { features: textareaToFeatures(e.target.value) })}
                          disabled={!canSave}
                          rows={5}
                          placeholder="Feature A\nFeature B\nFeature C"
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })
          )}

          {isEditing && !loading && (
            <div className="text-xs text-muted-foreground">
              {hasChanges ? "Changes not saved." : "No changes."}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>CTA</CardTitle>
          <CardDescription>Call-to-action section at the bottom (the button still links to /packages).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label>CTA Title</Label>
            <Input value={settings.ctaTitle} onChange={(e) => updateHero({ ctaTitle: e.target.value })} disabled={!canSave} />
          </div>
          <div className="grid gap-2">
            <Label>CTA Subtitle</Label>
            <Textarea
              value={settings.ctaSubtitle}
              onChange={(e) => updateHero({ ctaSubtitle: e.target.value })}
              disabled={!canSave}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
