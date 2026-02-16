import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { RefreshCw, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type OrderLead = {
  id: string;
  created_at: string;
  flow_type: string;
  domain: string | null;
  template_id: string | null;
  template_name: string | null;
  package_id: string | null;
  package_name: string | null;
  subscription_years: number | null;
  add_ons: Record<string, number> | null;
  subscription_add_ons: Record<string, boolean> | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  business_name: string | null;
  province_code: string | null;
  province_name: string | null;
  city: string | null;
  amount_idr: number | null;
  promo_code: string | null;
  status: string;
};

function formatIdr(value: number) {
  return `Rp ${Math.round(value).toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function addOnsSummary(addOns: Record<string, number> | null, addOnLabels: Map<string, string>) {
  if (!addOns || typeof addOns !== "object") return "—";
  const entries = Object.entries(addOns).filter(([, v]) => v > 0);
  if (entries.length === 0) return "—";
  return entries.map(([k, v]) => `${addOnLabels.get(k) || k}: ${v}`).join(", ");
}

function subscriptionAddOnsSummary(subs: Record<string, boolean> | null, addOnLabels: Map<string, string>) {
  if (!subs || typeof subs !== "object") return "—";
  const entries = Object.entries(subs).filter(([, v]) => v);
  if (entries.length === 0) return "—";
  return entries.map(([k]) => addOnLabels.get(k) || k).join(", ");
}

function LeadTable({ leads, showDomain, onDelete, addOnLabels }: { leads: OrderLead[]; showDomain: boolean; onDelete: (id: string) => void; addOnLabels: Map<string, string> }) {
  if (leads.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Belum ada data.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-foreground whitespace-nowrap">Tanggal</th>
            {showDomain && (
              <th className="px-3 py-2 text-left font-medium text-foreground whitespace-nowrap">Domain</th>
            )}
            <th className="px-3 py-2 text-left font-medium text-foreground whitespace-nowrap">
              {showDomain ? "Template" : "Plan"}
            </th>
            <th className="px-3 py-2 text-left font-medium text-foreground whitespace-nowrap">Durasi</th>
            <th className="px-3 py-2 text-left font-medium text-foreground whitespace-nowrap">Add-ons</th>
            <th className="px-3 py-2 text-left font-medium text-foreground whitespace-nowrap">Nama</th>
            <th className="px-3 py-2 text-left font-medium text-foreground whitespace-nowrap">Email</th>
            <th className="px-3 py-2 text-left font-medium text-foreground whitespace-nowrap">Telp/WA</th>
            <th className="px-3 py-2 text-left font-medium text-foreground whitespace-nowrap">Bisnis</th>
            <th className="px-3 py-2 text-left font-medium text-foreground whitespace-nowrap">Provinsi</th>
            <th className="px-3 py-2 text-left font-medium text-foreground whitespace-nowrap">Kota</th>
            <th className="px-3 py-2 text-left font-medium text-foreground whitespace-nowrap">Total</th>
            <th className="px-3 py-2 text-left font-medium text-foreground whitespace-nowrap">Status</th>
            <th className="px-3 py-2 text-center font-medium text-foreground whitespace-nowrap">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="border-t">
              <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatDate(lead.created_at)}</td>
              {showDomain && (
                <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{lead.domain || "—"}</td>
              )}
              <td className="px-3 py-2 text-foreground whitespace-nowrap">
                {showDomain ? (lead.template_name || "—") : (lead.package_name || "—")}
              </td>
              <td className="px-3 py-2 text-foreground whitespace-nowrap">
                {lead.subscription_years ? `${lead.subscription_years} tahun` : "—"}
              </td>
              <td className="px-3 py-2 text-foreground text-xs max-w-[200px] truncate" title={
                [addOnsSummary(lead.add_ons, addOnLabels), subscriptionAddOnsSummary(lead.subscription_add_ons, addOnLabels)]
                  .filter(s => s !== "—").join(" | ") || "—"
              }>
                {[addOnsSummary(lead.add_ons, addOnLabels), subscriptionAddOnsSummary(lead.subscription_add_ons, addOnLabels)]
                  .filter(s => s !== "—").join(" | ") || "—"}
              </td>
              <td className="px-3 py-2 text-foreground whitespace-nowrap">
                {[lead.first_name, lead.last_name].filter(Boolean).join(" ") || "—"}
              </td>
              <td className="px-3 py-2 text-foreground whitespace-nowrap">{lead.email || "—"}</td>
              <td className="px-3 py-2 text-foreground whitespace-nowrap">{lead.phone || "—"}</td>
              <td className="px-3 py-2 text-foreground whitespace-nowrap">{lead.business_name || "—"}</td>
              <td className="px-3 py-2 text-foreground whitespace-nowrap">{lead.province_name || "—"}</td>
              <td className="px-3 py-2 text-foreground whitespace-nowrap">{lead.city || "—"}</td>
              <td className="px-3 py-2 text-foreground whitespace-nowrap">
                {lead.amount_idr != null ? formatIdr(lead.amount_idr) : "—"}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                <Badge variant={lead.status === "paid" ? "default" : "secondary"}>
                  {lead.status}
                </Badge>
              </td>
              <td className="px-3 py-2 text-center whitespace-nowrap">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Hapus data lead?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Data ini akan dihapus secara permanen dari database. Apakah Anda yakin?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Tidak</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onDelete(lead.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Ya, Hapus
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function FollowUp() {
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<OrderLead[]>([]);
  const [addOnLabels, setAddOnLabels] = useState<Map<string, string>>(new Map());
  const { toast } = useToast();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [leadsRes, pkgAddOnsRes, subAddOnsRes] = await Promise.all([
        (supabase as any).from("order_leads").select("*").order("created_at", { ascending: false }).limit(200),
        (supabase as any).from("package_add_ons").select("id,label"),
        (supabase as any).from("subscription_add_ons").select("id,label"),
      ]);
      if (leadsRes.error) throw leadsRes.error;
      setLeads((leadsRes.data ?? []) as OrderLead[]);

      const labelsMap = new Map<string, string>();
      for (const row of (pkgAddOnsRes.data ?? []) as any[]) {
        if (row?.id && row?.label) labelsMap.set(row.id, row.label);
      }
      for (const row of (subAddOnsRes.data ?? []) as any[]) {
        if (row?.id && row?.label) labelsMap.set(row.id, row.label);
      }
      setAddOnLabels(labelsMap);
    } catch (e) {
      console.error("FollowUp fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const { error } = await (supabase as any).from("order_leads").delete().eq("id", id);
      if (error) throw error;
      setLeads((prev) => prev.filter((l) => l.id !== id));
      toast({ title: "Data berhasil dihapus" });
    } catch (e) {
      console.error("Delete lead error:", e);
      toast({ variant: "destructive", title: "Gagal menghapus data" });
    }
  }, [toast]);

  const websiteLeads = useMemo(() => leads.filter((l) => l.flow_type === "website"), [leads]);
  const marketingLeads = useMemo(() => leads.filter((l) => l.flow_type === "marketing"), [leads]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Follow Up</h1>
          <p className="text-sm text-muted-foreground">Data calon pelanggan dari order flow.</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="website">
        <TabsList>
          <TabsTrigger value="website">
            Website
            {websiteLeads.length > 0 && (
              <Badge variant="secondary" className="ml-2">{websiteLeads.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="marketing">
            Marketing
            {marketingLeads.length > 0 && (
              <Badge variant="secondary" className="ml-2">{marketingLeads.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="website">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Order Website</CardTitle>
            </CardHeader>
            <CardContent>
              <LeadTable leads={websiteLeads} showDomain onDelete={handleDelete} addOnLabels={addOnLabels} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="marketing">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Order Marketing</CardTitle>
            </CardHeader>
            <CardContent>
              <LeadTable leads={marketingLeads} showDomain={false} onDelete={handleDelete} addOnLabels={addOnLabels} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
