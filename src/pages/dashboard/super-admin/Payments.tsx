import { useEffect } from "react";
import { ExternalLink, RefreshCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMidtransPayments } from "./useMidtransPayments";

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
  const { env, setEnv, loading, items, refresh } = useMidtransPayments();

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    refresh({ env });
  }, [env, refresh]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-foreground">Payments</h1>
          <p className="text-sm text-muted-foreground">Daftar transaksi Midtrans (real-time) berdasarkan environment yang dipilih.</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-[220px]">
            <Select value={env} onValueChange={(v) => setEnv(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih environment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Sandbox</SelectItem>
                <SelectItem value="production">Production</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" onClick={() => refresh({ env })} disabled={loading}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Transaksi ({items.length})</CardTitle>
          {loading ? <span className="text-sm text-muted-foreground">Memuat…</span> : null}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Midtrans Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Waktu</TableHead>
                <TableHead className="text-right">Redirect</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => {
                const txStatus = String(it.midtrans?.transaction_status ?? "-");
                const fraud = String(it.midtrans?.fraud_status ?? "-");
                const time = (it.midtrans as any)?.transaction_time ?? (it.midtrans as any)?.settlement_time ?? null;

                return (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span className="truncate">{it.midtrans_order_id ?? "-"}</span>
                        <span className="text-xs text-muted-foreground truncate">{it.domain}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-col">
                        <span className="truncate">{it.customer_name ?? "-"}</span>
                        <span className="text-xs text-muted-foreground truncate">{it.customer_email ?? "-"}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{txStatus}</Badge>
                          <span className="text-xs text-muted-foreground">fraud: {fraud}</span>
                        </div>
                        {it.midtrans_error ? <span className="text-xs text-destructive">{it.midtrans_error}</span> : null}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-col">
                        <span>{formatMoney(it.amount_usd, "USD")}</span>
                        <span className="text-xs text-muted-foreground">{formatMoney(it.amount_idr, "IDR")}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">DB: {formatTime(it.created_at)}</span>
                        <span className="text-xs">Midtrans: {formatTime(time)}</span>
                      </div>
                    </TableCell>

                    <TableCell className="text-right">
                      {it.midtrans_redirect_url ? (
                        <a
                          href={it.midtrans_redirect_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-sm underline underline-offset-4"
                        >
                          Open <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}

              {!loading && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    Belum ada transaksi untuk environment ini.
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
