import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, RefreshCcw, Save, Trash2 } from "lucide-react";

type PlanRow = {
  years: number;
  label: string;
  is_active: boolean;
  sort_order: number;
};

const SETTINGS_SUBSCRIPTION_PLANS_KEY = "order_subscription_plans";

function asNumber(v: unknown, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function WebsiteSubscriptionPlans() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState<PlanRow[]>([]);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const { data: row } = await (supabase as any)
        .from("website_settings")
        .select("value")
        .eq("key", SETTINGS_SUBSCRIPTION_PLANS_KEY)
        .maybeSingle();

      const v = row?.value;
      const parsed = Array.isArray(v)
        ? (v as any[])
            .map((r) => ({
              years: asNumber(r?.years),
              label: String(r?.label ?? "").trim(),
              is_active: typeof r?.is_active === "boolean" ? r.is_active : true,
              sort_order: asNumber(r?.sort_order),
            }))
            .filter((r) => r.years > 0)
        : [];

      setPlans(
        parsed.length
          ? parsed.map((p) => ({
              ...p,
              label: p.label || `${p.years} Years`,
              sort_order: p.sort_order || p.years,
            }))
          : [
              { years: 1, label: "1 Year", is_active: true, sort_order: 1 },
              { years: 2, label: "2 Years", is_active: true, sort_order: 2 },
              { years: 3, label: "3 Years", is_active: true, sort_order: 3 },
            ],
      );
    } catch (e: any) {
      console.error(e);
      const msg = e?.message || "Unable to load subscription plans";
      if (String(msg).toLowerCase().includes("unauthorized")) {
        navigate("/admin/login", { replace: true });
        return;
      }
      toast({ variant: "destructive", title: "Error", description: msg });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const savePlans = async () => {
    setSaving(true);
    try {
      const payload = plans
        .map((p) => ({
          years: asNumber(p.years),
          label: String(p.label ?? "").trim() || `${asNumber(p.years)} Years`,
          is_active: p.is_active !== false,
          sort_order: asNumber(p.sort_order, asNumber(p.years)),
        }))
        .filter((p) => p.years > 0);

      const { error } = await (supabase as any)
        .from("website_settings")
        .upsert({ key: SETTINGS_SUBSCRIPTION_PLANS_KEY, value: payload }, { onConflict: "key" });
      if (error) throw error;

      toast({ title: "Saved", description: "Subscription plans updated." });
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Failed to save", description: e?.message ?? "Unknown error" });
    } finally {
      setSaving(false);
    }
  };

  const countLabel = useMemo(() => String(plans.length), [plans.length]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Subscription Plans (Order)</h1>
          <p className="text-muted-foreground">Manage the “Choose plan duration” options on /order/subscription.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={fetchPlans} disabled={loading || saving}>
            <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Choose plan duration</CardTitle>
              <CardDescription>Example: 1 Year, 2 Years, 3 Years.</CardDescription>
            </div>
            <Badge variant="outline">Total: {countLabel}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? <div className="text-sm text-muted-foreground">Loading...</div> : null}

          {!loading && plans.length ? (
            plans.map((p, idx) => (
              <div key={`${p.years}-${idx}`} className="grid gap-2 rounded-md border bg-muted/20 p-3 md:grid-cols-5">
                <div>
                  <Label className="text-xs">Years</Label>
                  <Input
                    value={String(p.years)}
                    onChange={(e) =>
                      setPlans((prev) => prev.map((x, i) => (i === idx ? { ...x, years: asNumber(e.target.value) } : x)))
                    }
                    inputMode="numeric"
                    disabled={saving}
                  />
                </div>

                <div className="md:col-span-2">
                  <Label className="text-xs">Label</Label>
                  <Input
                    value={p.label}
                    onChange={(e) => setPlans((prev) => prev.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))}
                    disabled={saving}
                  />
                </div>

                <div>
                  <Label className="text-xs">Sort</Label>
                  <Input
                    value={String(p.sort_order)}
                    onChange={(e) =>
                      setPlans((prev) => prev.map((x, i) => (i === idx ? { ...x, sort_order: asNumber(e.target.value) } : x)))
                    }
                    inputMode="numeric"
                    disabled={saving}
                  />
                </div>

                <div className="flex items-end justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "On" : "Off"}</Badge>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setPlans((prev) => prev.map((x, i) => (i === idx ? { ...x, is_active: !x.is_active } : x)))}
                      disabled={saving}
                    >
                      Toggle
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setPlans((prev) => prev.filter((_, i) => i !== idx))}
                    disabled={saving}
                    aria-label="Remove plan"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          ) : !loading ? (
            <div className="text-sm text-muted-foreground">No plans yet. Click “Add Plan”.</div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setPlans((prev) => [
                  ...prev,
                  {
                    years: 1,
                    label: "1 Tahun",
                    is_active: true,
                    sort_order: prev.length ? Math.max(...prev.map((x) => x.sort_order)) + 1 : 1,
                  },
                ])
              }
              disabled={saving}
            >
              <Plus className="h-4 w-4 mr-2" /> Add Plan
            </Button>
            <Button type="button" onClick={savePlans} disabled={saving}>
              <Save className="h-4 w-4 mr-2" /> Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
