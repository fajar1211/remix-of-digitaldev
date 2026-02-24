import { useCallback, useEffect, useState } from "react";
import { ExternalLink, RefreshCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useXenditPayments } from "./useXenditPayments";

type OrderItem = {
  id: string;
  created_at: string;
  domain: string;
  customer_name: string | null;
  customer_email: string | null;
  amount_idr: number | null;
  amount_usd: number | null;
  payment_provider: string | null;
  payment_env: string | null;
  status: string | null;
  subscription_years: number | null;
  promo_code: string | null;
};

function formatMoney(n: number | null | undefined, suffix: string) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "-";
  return `${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${suffix}`;
}

function formatTime(v: unknown) {
  const s = typeof v === "string" ? v : null;
  if (!s) return "-";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString();
}

export default function SuperAdminPayments() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<OrderItem[]>([]);
  const xendit = useXenditPayments();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("orders")
        .select("id,created_at,domain,customer_name,customer_email,amount_idr,amount_usd,payment_provider,payment_env,status,subscription_years,promo_code")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setItems((data as OrderItem[]) ?? []);
    } catch (e: any) {
      console.error(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    xendit.refresh();
  }, [refresh]);

  const allItems = items;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-foreground">Payments</h1>
          <p className="text-sm text-muted-foreground">Daftar transaksi order.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => { refresh(); xendit.refresh(); }} disabled={loading || xendit.loading}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </header>

      {/* Xendit API */}
      {xendit.items.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">Xendit API — {xendit.items.length} transaksi</CardTitle>
            {xendit.loading && <span className="text-sm text-muted-foreground">Memuat…</span>}
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Waktu</TableHead>
                  <TableHead className="text-right">Invoice</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {xendit.items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium truncate">{it.domain ?? "-"}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="truncate">{it.customer_name ?? "-"}</span>
                        <span className="text-xs text-muted-foreground truncate">{it.customer_email ?? "-"}</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatMoney(it.amount_idr, "IDR")}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{(it.xendit as any)?.status ?? "-"}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatTime(it.created_at)}</TableCell>
                    <TableCell className="text-right">
                      {it.xendit_invoice_url ? (
                        <a href={it.xendit_invoice_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm underline underline-offset-4">
                          Open <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Transaksi Database ({allItems.length})</CardTitle>
          {loading ? <span className="text-sm text-muted-foreground">Memuat…</span> : null}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Durasi</TableHead>
                <TableHead>Waktu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allItems.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="font-medium">
                    <span className="truncate">{it.domain ?? "-"}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="truncate">{it.customer_name ?? "-"}</span>
                      <span className="text-xs text-muted-foreground truncate">{it.customer_email ?? "-"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{it.payment_provider ?? "-"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{it.status ?? "-"}</Badge>
                  </TableCell>
                  <TableCell>
                    <span>{formatMoney(it.amount_idr, "IDR")}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{it.subscription_years ? `${it.subscription_years} tahun` : "-"}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">{formatTime(it.created_at)}</span>
                  </TableCell>
                </TableRow>
              ))}

              {!loading && allItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    Belum ada transaksi.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
