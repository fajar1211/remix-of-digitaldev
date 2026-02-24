import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { RefreshCw, Trash2, MailOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LeadDetailDialog } from "./follow-up/LeadDetailDialog";

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
  is_read: boolean;
};

function formatIdr(value: number) {
  return `Rp ${Math.round(value).toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function LeadTable({
  leads,
  showDomain,
  onDelete,
  onClickLead,
  onMarkUnread,
  addOnLabels,
}: {
  leads: OrderLead[];
  showDomain: boolean;
  onDelete: (id: string) => void;
  onClickLead: (lead: OrderLead) => void;
  onMarkUnread: (id: string) => void;
  addOnLabels: Map<string, string>;
}) {
  if (leads.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Belum ada data.</p>;
  }

  return (
    <div className="rounded-lg border overflow-auto resize" style={{ minHeight: 120, maxHeight: "80vh" }}>
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
            <tr
              key={lead.id}
              className={`border-t cursor-pointer transition-colors hover:bg-muted/30 ${!lead.is_read ? "bg-primary/5 font-semibold" : ""}`}
              onClick={() => onClickLead(lead)}
            >
              <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                <span className="flex items-center gap-1.5">
                  {!lead.is_read && <span className="inline-block h-2 w-2 rounded-full bg-primary shrink-0" />}
                  {formatDate(lead.created_at)}
                </span>
              </td>
              {showDomain && (
                <td className="px-3 py-2 text-foreground whitespace-nowrap">{lead.domain || "—"}</td>
              )}
              <td className="px-3 py-2 text-foreground whitespace-nowrap">
                {showDomain ? (lead.template_name || "—") : (lead.package_name || "—")}
              </td>
              <td className="px-3 py-2 text-foreground whitespace-nowrap">
                {lead.subscription_years ? `${lead.subscription_years} tahun` : "—"}
              </td>
              <td className="px-3 py-2 text-foreground text-xs">
                {(() => {
                  const parts: string[] = [];
                  if (lead.add_ons && typeof lead.add_ons === "object") {
                    Object.entries(lead.add_ons).filter(([, v]) => (v as number) > 0).forEach(([k, v]) => {
                      parts.push(`${addOnLabels.get(k) || k}: ${v}`);
                    });
                  }
                  if (lead.subscription_add_ons && typeof lead.subscription_add_ons === "object") {
                    Object.entries(lead.subscription_add_ons).filter(([, v]) => v).forEach(([k]) => {
                      parts.push(addOnLabels.get(k) || k);
                    });
                  }
                  if (parts.length === 0) return "—";
                  return (
                    <ul className="list-disc list-inside space-y-0.5">
                      {parts.map((p, i) => <li key={i} className="whitespace-nowrap">{p}</li>)}
                    </ul>
                  );
                })()}
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
              <td className="px-3 py-2 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-center gap-1">
                  {lead.is_read && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      title="Tandai belum dibaca"
                      onClick={() => onMarkUnread(lead.id)}
                    >
                      <MailOpen className="h-4 w-4" />
                    </Button>
                  )}
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
                </div>
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
  const [selectedLead, setSelectedLead] = useState<OrderLead | null>(null);
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

  useEffect(() => { refresh(); }, [refresh]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const { error } = await (supabase as any).from("order_leads").delete().eq("id", id);
      if (error) throw error;
      setLeads((prev) => prev.filter((l) => l.id !== id));
      if (selectedLead?.id === id) setSelectedLead(null);
      toast({ title: "Data berhasil dihapus" });
    } catch (e) {
      console.error("Delete lead error:", e);
      toast({ variant: "destructive", title: "Gagal menghapus data" });
    }
  }, [toast, selectedLead]);

  const markAsRead = useCallback(async (lead: OrderLead) => {
    if (lead.is_read) return;
    try {
      await (supabase as any).from("order_leads").update({ is_read: true }).eq("id", lead.id);
      setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, is_read: true } : l));
    } catch (e) {
      console.error("Mark read error:", e);
    }
  }, []);

  const markAsUnread = useCallback(async (id: string) => {
    try {
      await (supabase as any).from("order_leads").update({ is_read: false }).eq("id", id);
      setLeads((prev) => prev.map((l) => l.id === id ? { ...l, is_read: false } : l));
      toast({ title: "Ditandai belum dibaca" });
    } catch (e) {
      console.error("Mark unread error:", e);
      toast({ variant: "destructive", title: "Gagal mengubah status" });
    }
  }, [toast]);

  const handleClickLead = useCallback((lead: OrderLead) => {
    setSelectedLead(lead);
    markAsRead(lead);
  }, [markAsRead]);

  const websiteLeads = useMemo(() => leads.filter((l) => l.flow_type === "website"), [leads]);
  const marketingLeads = useMemo(() => leads.filter((l) => l.flow_type === "marketing"), [leads]);

  const unreadWebsite = useMemo(() => websiteLeads.filter((l) => !l.is_read).length, [websiteLeads]);
  const unreadMarketing = useMemo(() => marketingLeads.filter((l) => !l.is_read).length, [marketingLeads]);

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
              <Badge variant={unreadWebsite > 0 ? "default" : "secondary"} className="ml-2">
                {unreadWebsite > 0 ? `${unreadWebsite} baru` : websiteLeads.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="marketing">
            Marketing
            {marketingLeads.length > 0 && (
              <Badge variant={unreadMarketing > 0 ? "default" : "secondary"} className="ml-2">
                {unreadMarketing > 0 ? `${unreadMarketing} baru` : marketingLeads.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="website">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Order Website</CardTitle>
            </CardHeader>
            <CardContent>
              <LeadTable leads={websiteLeads} showDomain onDelete={handleDelete} onClickLead={handleClickLead} onMarkUnread={markAsUnread} addOnLabels={addOnLabels} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="marketing">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Order Marketing</CardTitle>
            </CardHeader>
            <CardContent>
              <LeadTable leads={marketingLeads} showDomain={false} onDelete={handleDelete} onClickLead={handleClickLead} onMarkUnread={markAsUnread} addOnLabels={addOnLabels} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <LeadDetailDialog
        lead={selectedLead}
        open={!!selectedLead}
        onOpenChange={(open) => { if (!open) setSelectedLead(null); }}
        addOnLabels={addOnLabels}
      />
    </div>
  );
}
