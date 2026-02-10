import type { FormEvent } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCcw, Save, Trash2, Search } from "lucide-react";

type Status = {
  configured: boolean;
  updatedAt: string | null;
  tokenMasked: string | null;
};

type Props = {
  loading: boolean;
  status: Status;
  value: string;
  onChange: (v: string) => void;
  onSave: (e: FormEvent) => void;
  onRefresh: () => void;
  onClear: () => void;
};

export function GscIntegrationCard({ loading, status, value, onChange, onSave, onRefresh, onClear }: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Search className="h-4 w-4" /> Google Search Console
          </CardTitle>
          <Badge variant={status.configured ? "default" : "secondary"}>{status.configured ? "Active" : "Not set"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Salin tag meta verifikasi dari Google Search Console, lalu tempel di sini.
        Sistem akan mengambil nilai <span className="font-medium text-foreground">content</span> dan memasang meta tag otomatis di semua halaman publik.

        <div className="mt-4 space-y-4">
          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            <div className="flex items-center justify-between gap-2">
              <span>Token aktif</span>
              <span className="font-mono text-foreground">{status.configured ? status.tokenMasked ?? "—" : "—"}</span>
            </div>
            <div className="mt-1">Perubahan disimpan dan aksi admin dicatat di audit log.</div>
          </div>

          <form onSubmit={onSave} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="gsc_verification_token">Meta tag / token</Label>
              <Input
                id="gsc_verification_token"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={'contoh: <meta name="google-site-verification" content="l0Sfpqyn_hv1_lfodALBwU_AAAXKHmtiBzK0PHVt17I" />'}
                autoComplete="off"
                disabled={loading}
              />
              <div className="text-xs text-muted-foreground">Bisa isi token saja, atau full &lt;meta ...&gt;.</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={loading}>
                <Save className="h-4 w-4 mr-2" /> Save
              </Button>
              <Button type="button" variant="outline" onClick={onRefresh} disabled={loading}>
                <RefreshCcw className="h-4 w-4 mr-2" /> Refresh status
              </Button>
              <Button type="button" variant="destructive" onClick={onClear} disabled={loading || !status.configured}>
                <Trash2 className="h-4 w-4 mr-2" /> Disable
              </Button>
            </div>
          </form>

          <div className="text-xs text-muted-foreground">
            Stored in <span className="font-medium text-foreground">website_settings</span> key: <span className="font-mono">gsc_verification_token</span>.
            {status.updatedAt ? <span> Last updated: {new Date(status.updatedAt).toLocaleString()}</span> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
