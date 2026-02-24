import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value || value === "—") return null;
  return (
    <div className="flex gap-2 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground text-sm w-32 shrink-0">{label}</span>
      <span className="text-sm text-foreground break-all">{value}</span>
    </div>
  );
}

export function LeadDetailDialog({
  lead,
  open,
  onOpenChange,
  addOnLabels,
}: {
  lead: OrderLead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addOnLabels: Map<string, string>;
}) {
  if (!lead) return null;

  const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "—";

  const addOnParts: string[] = [];
  if (lead.add_ons && typeof lead.add_ons === "object") {
    Object.entries(lead.add_ons).filter(([, v]) => (v as number) > 0).forEach(([k, v]) => {
      addOnParts.push(`${addOnLabels.get(k) || k}: ${v}`);
    });
  }
  if (lead.subscription_add_ons && typeof lead.subscription_add_ons === "object") {
    Object.entries(lead.subscription_add_ons).filter(([, v]) => v).forEach(([k]) => {
      addOnParts.push(addOnLabels.get(k) || k);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Detail Lead
            <Badge variant={lead.status === "paid" ? "default" : "secondary"}>{lead.status}</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-0">
          <Row label="Tanggal" value={formatDate(lead.created_at)} />
          <Row label="Nama" value={fullName} />
          <Row label="Email" value={lead.email} />
          <Row label="Telp/WA" value={lead.phone} />
          <Row label="Bisnis" value={lead.business_name} />
          <Row label="Domain" value={lead.domain} />
          <Row label="Template" value={lead.template_name} />
          <Row label="Paket" value={lead.package_name} />
          <Row label="Durasi" value={lead.subscription_years ? `${lead.subscription_years} tahun` : null} />
          <Row label="Provinsi" value={lead.province_name} />
          <Row label="Kota" value={lead.city} />
          <Row label="Promo" value={lead.promo_code} />
          <Row label="Total" value={lead.amount_idr != null ? formatIdr(lead.amount_idr) : null} />
          {addOnParts.length > 0 && (
            <Row
              label="Add-ons"
              value={
                <ul className="list-disc list-inside space-y-0.5">
                  {addOnParts.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              }
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
