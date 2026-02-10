import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Save, Trash2 } from "lucide-react";

type PromoStatus = "draft" | "scheduled" | "active" | "expired";
type PromoDiscountType = "percentage" | "fixed";

type PromoDbRow = {
  id: string;
  code: string;
  promo_name: string;
  event_name: string;
  description: string;
  status: PromoStatus;
  discount_type: PromoDiscountType;
  discount_value: number;
  starts_at: string | null;
  ends_at: string | null;
};

function asNumber(v: unknown, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function SuperAdminPromotions() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [promosLoading, setPromosLoading] = useState(true);
  const [promosSaving, setPromosSaving] = useState(false);
  const [promos, setPromos] = useState<PromoDbRow[]>([]);
  const [promoDraft, setPromoDraft] = useState<Omit<PromoDbRow, "id">>({
    code: "",
    promo_name: "",
    event_name: "",
    description: "",
    // Default to active so a newly created promo can be used immediately on /order/payment.
    status: "active",
    discount_type: "percentage",
    discount_value: 0,
    starts_at: null,
    ends_at: null,
  });
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; promo: PromoDbRow | null }>({ open: false, promo: null });

  const toLocalInputValue = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const fromLocalInputValueToIso = (v: string) => {
    const s = String(v ?? "").trim();
    if (!s) return null;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  };

  const fetchPromos = async () => {
    setPromosLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("order_promos")
        .select("id,code,promo_name,event_name,description,status,discount_type,discount_value,starts_at,ends_at")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const parsed: PromoDbRow[] = Array.isArray(data)
        ? (data as any[]).map((r) => ({
            id: String(r?.id ?? ""),
            code: String(r?.code ?? "").trim(),
            promo_name: String(r?.promo_name ?? "").trim(),
            event_name: String(r?.event_name ?? "").trim(),
            description: String(r?.description ?? "").trim(),
            status: (String(r?.status ?? "draft").trim().toLowerCase() as PromoStatus) || "draft",
            discount_type:
              (String(r?.discount_type ?? "percentage").trim().toLowerCase() as PromoDiscountType) || "percentage",
            discount_value: asNumber(r?.discount_value, 0),
            starts_at: r?.starts_at == null ? null : String(r.starts_at),
            ends_at: r?.ends_at == null ? null : String(r.ends_at),
          }))
        : [];
      setPromos(parsed);
    } catch (e: any) {
      console.error(e);
      const msg = e?.message || "Failed to load promotions";
      if (String(msg).toLowerCase().includes("unauthorized")) {
        navigate("/super-admin/login", { replace: true });
        return;
      }
      toast({ variant: "destructive", title: "Error", description: msg });
    } finally {
      setPromosLoading(false);
    }
  };

  useEffect(() => {
    fetchPromos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const promosCountLabel = useMemo(() => String(promos.length), [promos.length]);

  const savePromos = async () => {
    setPromosSaving(true);
    try {
      const code = String(promoDraft.code ?? "").trim();
      const promo_name = String(promoDraft.promo_name ?? "").trim();
      const event_name = String(promoDraft.event_name ?? "").trim();
      const description = String(promoDraft.description ?? "").trim();

      if (!code || !promo_name || !event_name) {
        toast({ variant: "destructive", title: "Save failed", description: "Promo Code, Promo Name, and Event/Campaign are required." });
        return;
      }

      const starts_at = promoDraft.status === "scheduled" ? promoDraft.starts_at : null;
      const ends_at = promoDraft.status === "scheduled" ? promoDraft.ends_at : null;
      if (promoDraft.status === "scheduled" && (!starts_at || !ends_at)) {
        toast({ variant: "destructive", title: "Dates required", description: "For Scheduled status, Start and End date are required." });
        return;
      }

      const payload = {
        code,
        promo_name,
        event_name,
        description,
        status: promoDraft.status,
        discount_type: promoDraft.discount_type,
        discount_value: asNumber(promoDraft.discount_value, 0),
        starts_at,
        ends_at,
      };

      const { error } = editingPromoId
        ? await (supabase as any).from("order_promos").update(payload).eq("id", editingPromoId)
        : await (supabase as any).from("order_promos").insert(payload);
      if (error) throw error;

      toast({ title: "Saved", description: "Promo saved to database." });
      setPromoDraft({
        code: "",
        promo_name: "",
        event_name: "",
        description: "",
        status: "active",
        discount_type: "percentage",
        discount_value: 0,
        starts_at: null,
        ends_at: null,
      });
      setEditingPromoId(null);
      await fetchPromos();
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Failed to save", description: e?.message ?? "Unknown error" });
    } finally {
      setPromosSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Promotions</h1>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Promo</CardTitle>
              <CardDescription>Manage promotions/campaigns for orders (draft/scheduled/active/expired).</CardDescription>
            </div>
            <Badge variant="outline">Total: {promosCountLabel}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {promosLoading ? <div className="text-sm text-muted-foreground">Loading...</div> : null}

          {/* Form */}
          <div className="grid gap-3 rounded-md border bg-muted/20 p-3 md:grid-cols-12">
            <div className="md:col-span-3">
              <Label className="text-xs">Promo Code</Label>
              <Input value={promoDraft.code} onChange={(e) => setPromoDraft((s) => ({ ...s, code: e.target.value }))} disabled={promosSaving} />
            </div>
            <div className="md:col-span-3">
              <Label className="text-xs">Promo Name</Label>
              <Input value={promoDraft.promo_name} onChange={(e) => setPromoDraft((s) => ({ ...s, promo_name: e.target.value }))} disabled={promosSaving} />
            </div>
            <div className="md:col-span-3">
              <Label className="text-xs">Event / Campaign Name</Label>
              <Input value={promoDraft.event_name} onChange={(e) => setPromoDraft((s) => ({ ...s, event_name: e.target.value }))} disabled={promosSaving} />
            </div>
            <div className="md:col-span-3">
              <Label className="text-xs">Description</Label>
              <Input value={promoDraft.description} onChange={(e) => setPromoDraft((s) => ({ ...s, description: e.target.value }))} disabled={promosSaving} />
            </div>

            <div className="md:col-span-3">
              <Label className="text-xs">Status</Label>
              <Select
                value={promoDraft.status}
                onValueChange={(v) =>
                  setPromoDraft((s) => ({
                    ...s,
                    status: v as PromoStatus,
                    starts_at: v === "scheduled" ? s.starts_at : null,
                    ends_at: v === "scheduled" ? s.ends_at : null,
                  }))
                }
              >
                <SelectTrigger disabled={promosSaving}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {promoDraft.status === "scheduled" ? (
              <>
                <div className="md:col-span-3">
                  <Label className="text-xs">Start date</Label>
                  <Input
                    type="datetime-local"
                    value={toLocalInputValue(promoDraft.starts_at)}
                    onChange={(e) => setPromoDraft((s) => ({ ...s, starts_at: fromLocalInputValueToIso(e.target.value) }))}
                    disabled={promosSaving}
                  />
                </div>
                <div className="md:col-span-3">
                  <Label className="text-xs">End date</Label>
                  <Input
                    type="datetime-local"
                    value={toLocalInputValue(promoDraft.ends_at)}
                    onChange={(e) => setPromoDraft((s) => ({ ...s, ends_at: fromLocalInputValueToIso(e.target.value) }))}
                    disabled={promosSaving}
                  />
                </div>
              </>
            ) : null}

            <div className="md:col-span-3">
              <Label className="text-xs">Discount Type</Label>
              <Select value={promoDraft.discount_type} onValueChange={(v) => setPromoDraft((s) => ({ ...s, discount_type: v as PromoDiscountType }))}>
                <SelectTrigger disabled={promosSaving}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3">
              <Label className="text-xs">Discount Value</Label>
              <Input
                value={String(promoDraft.discount_value ?? 0)}
                onChange={(e) => setPromoDraft((s) => ({ ...s, discount_value: asNumber(e.target.value, 0) }))}
                inputMode="decimal"
                disabled={promosSaving}
              />
            </div>
            <div className="md:col-span-6 flex items-end justify-end gap-2">
              {editingPromoId ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingPromoId(null);
                    setPromoDraft({
                      code: "",
                      promo_name: "",
                      event_name: "",
                      description: "",
                      status: "active",
                      discount_type: "percentage",
                      discount_value: 0,
                      starts_at: null,
                      ends_at: null,
                    });
                  }}
                  disabled={promosSaving}
                >
                  Cancel edit
                </Button>
              ) : null}
              <Button type="button" onClick={savePromos} disabled={promosSaving}>
                <Save className="h-4 w-4 mr-2" /> Save Promo
              </Button>
            </div>
          </div>

          {/* Table */}
          {!promosLoading && promos.length ? (
            <div className="rounded-md border bg-muted/20">
              <div className="max-h-[60vh] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="w-[140px]">Code</TableHead>
                      <TableHead>Promo Name</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead className="w-[140px]">Status</TableHead>
                      <TableHead className="w-[220px]">Schedule</TableHead>
                      <TableHead className="w-[180px]">Discount</TableHead>
                      <TableHead className="w-[180px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {promos.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.code}</TableCell>
                        <TableCell>{p.promo_name}</TableCell>
                        <TableCell>{p.event_name}</TableCell>
                        <TableCell>
                          <Badge variant={p.status === "active" ? "default" : "secondary"}>{p.status}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {p.status === "scheduled" ? (
                            <span>
                              {p.starts_at ? new Date(p.starts_at).toLocaleString() : "—"} → {p.ends_at ? new Date(p.ends_at).toLocaleString() : "—"}
                            </span>
                          ) : (
                            <span>—</span>
                          )}
                        </TableCell>
                        <TableCell>{p.discount_type === "percentage" ? `${p.discount_value}%` : `$${p.discount_value}`}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingPromoId(p.id);
                                setPromoDraft({
                                  code: p.code,
                                  promo_name: p.promo_name,
                                  event_name: p.event_name,
                                  description: p.description,
                                  status: p.status,
                                  discount_type: p.discount_type,
                                  discount_value: p.discount_value,
                                  starts_at: p.starts_at,
                                  ends_at: p.ends_at,
                                });
                              }}
                              disabled={promosSaving}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setDeleteDialog({ open: true, promo: p })}
                              disabled={promosSaving}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : !promosLoading ? (
            <div className="text-sm text-muted-foreground">No promotions yet.</div>
          ) : null}

          <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog((s) => ({ ...s, open }))}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete promotion?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete promotion <span className="font-medium">{deleteDialog.promo?.code ?? ""}</span>? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={promosSaving}>No</AlertDialogCancel>
                <AlertDialogAction
                  disabled={promosSaving}
                  onClick={async () => {
                    const promo = deleteDialog.promo;
                    if (!promo) return;
                    setPromosSaving(true);
                    try {
                      const { error } = await (supabase as any).from("order_promos").delete().eq("id", promo.id);
                      if (error) throw error;
                      toast({ title: "Deleted", description: "Promotion deleted." });
                      setDeleteDialog({ open: false, promo: null });
                      await fetchPromos();
                    } catch (e: any) {
                      console.error(e);
                      toast({ variant: "destructive", title: "Delete failed", description: e?.message ?? "Unknown error" });
                    } finally {
                      setPromosSaving(false);
                    }
                  }}
                >
                  Yes, delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}

