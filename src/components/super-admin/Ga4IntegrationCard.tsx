import type { FormEvent } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCcw, Save, Trash2, BarChart3 } from "lucide-react";

type Status = {
  configured: boolean;
  updatedAt: string | null;
  measurementIdMasked: string | null;
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

export function Ga4IntegrationCard({ loading, status, value, onChange, onSave, onRefresh, onClear }: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> GA4 (Google Analytics)
          </CardTitle>
          <Badge variant={status.configured ? "default" : "secondary"}>{status.configured ? "Active" : "Not set"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Enter the <span className="font-medium text-foreground">Measurement ID</span> (example: <span className="font-mono">G-CTS53JM1RF</span>).
        Once saved, GA4 will be enabled automatically on public pages (homepage, services, etc.).

        <div className="mt-4 space-y-4">
          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            <div className="flex items-center justify-between gap-2">
              <span>Measurement ID aktif</span>
              <span className="font-mono text-foreground">{status.configured ? status.measurementIdMasked ?? "—" : "—"}</span>
            </div>
            <div className="mt-1">Changes are saved and administrative actions are recorded in the audit log.</div>
          </div>

          <form onSubmit={onSave} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ga4_measurement_id">Measurement ID</Label>
              <Input
                id="ga4_measurement_id"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="G-CTS53JM1RF"
                autoComplete="off"
                disabled={loading}
              />
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
            Stored in <span className="font-medium text-foreground">website_settings</span> key: <span className="font-mono">ga4_measurement_id</span>.
            {status.updatedAt ? <span> Last updated: {new Date(status.updatedAt).toLocaleString()}</span> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
