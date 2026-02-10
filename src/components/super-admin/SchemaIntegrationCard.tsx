import type { FormEvent } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RefreshCcw, Save, Trash2, Braces, ExternalLink } from "lucide-react";

export type SchemaStatus = {
  configured: boolean;
  updatedAt: string | null;
};

export type SchemaFormValue = {
  enabled: boolean;
  businessName: string;
  websiteUrl: string;
  logoUrl: string;
  sameAsText: string;
  siteName: string;
};

type Props = {
  loading: boolean;
  status: SchemaStatus;
  value: SchemaFormValue;
  onChange: (patch: Partial<SchemaFormValue>) => void;
  onSave: (e: FormEvent) => void;
  onRefresh: () => void;
  onClear: () => void;
};

export function SchemaIntegrationCard({ loading, status, value, onChange, onSave, onRefresh, onClear }: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Braces className="h-4 w-4" /> Structured Data (JSON-LD)
          </CardTitle>
          <Badge variant={status.configured ? "default" : "secondary"}>{status.configured ? "Active" : "Not set"}</Badge>
        </div>
      </CardHeader>

      <CardContent className="text-sm text-muted-foreground">
        Kelola Schema.org JSON-LD untuk Organization + WebSite dan inject ke semua halaman publik.

        <div className="mt-4 space-y-4">
          {status.updatedAt ? <div className="text-xs text-muted-foreground">Last updated: {new Date(status.updatedAt).toLocaleString()}</div> : null}

          <form onSubmit={onSave} className="space-y-3">
            <label className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2">
              <span className="text-sm text-foreground">Enable Schema</span>
              <Switch checked={value.enabled} onCheckedChange={(v) => onChange({ enabled: v })} disabled={loading} />
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="schema_business_name">Business Name</Label>
                <Input
                  id="schema_business_name"
                  value={value.businessName}
                  onChange={(e) => onChange({ businessName: e.target.value })}
                  placeholder="Nama bisnis"
                  autoComplete="off"
                  disabled={loading}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="schema_site_name">Site Name</Label>
                <Input
                  id="schema_site_name"
                  value={value.siteName}
                  onChange={(e) => onChange({ siteName: e.target.value })}
                  placeholder="(default: Business Name)"
                  autoComplete="off"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="schema_website_url">Website URL</Label>
                <Input
                  id="schema_website_url"
                  value={value.websiteUrl}
                  onChange={(e) => onChange({ websiteUrl: e.target.value })}
                  placeholder="https://example.com"
                  autoComplete="off"
                  disabled={loading}
                />
                <div className="text-xs text-muted-foreground">Harus diawali http:// atau https://</div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="schema_logo_url">Logo URL</Label>
                <Input
                  id="schema_logo_url"
                  value={value.logoUrl}
                  onChange={(e) => onChange({ logoUrl: e.target.value })}
                  placeholder="https://.../logo.png"
                  autoComplete="off"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="schema_same_as">SameAs (1 link per baris)</Label>
              <Textarea
                id="schema_same_as"
                value={value.sameAsText}
                onChange={(e) => onChange({ sameAsText: e.target.value })}
                placeholder="https://instagram.com/...
https://www.linkedin.com/company/..."
                autoComplete="off"
                disabled={loading}
                rows={4}
              />
              <div className="text-xs text-muted-foreground">Opsional. Hanya URL http(s).</div>
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

              <Button asChild type="button" variant="outline" disabled={loading}>
                <a href="https://search.google.com/test/rich-results" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" /> Rich Results Test
                </a>
              </Button>
              <Button asChild type="button" variant="outline" disabled={loading}>
                <a href="https://validator.schema.org/" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" /> Schema Validator
                </a>
              </Button>
            </div>
          </form>

          <div className="text-xs text-muted-foreground">
            Stored in <span className="font-medium text-foreground">website_settings</span> key: <span className="font-mono">schema_settings</span>.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
