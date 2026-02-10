import type { FormEvent } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Link as LinkIcon, RefreshCcw, Save, Trash2, Map } from "lucide-react";

export type SitemapStatus = {
  configured: boolean;
  updatedAt: string | null;
  sitemapUrl: string | null;
};

export type SitemapFormValue = {
  baseUrl: string;
  includeStaticPages: boolean;
  includeBlogPosts: boolean;
  customPathsText: string;
};

type Props = {
  loading: boolean;
  status: SitemapStatus;
  value: SitemapFormValue;
  onChange: (patch: Partial<SitemapFormValue>) => void;
  onSave: (e: FormEvent) => void;
  onRefresh: () => void;
  onClear: () => void;
  onOpenSitemap: () => void;
};

export function SitemapIntegrationCard({ loading, status, value, onChange, onSave, onRefresh, onClear, onOpenSitemap }: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Map className="h-4 w-4" /> Sitemap XML
          </CardTitle>
          <Badge variant={status.configured ? "default" : "secondary"}>{status.configured ? "Active" : "Not set"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Generate sitemap XML secara dinamis via Supabase Edge Function.

        <div className="mt-4 space-y-4">
          <div className="rounded-md border bg-muted/30 p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Sitemap URL</span>
              <span className="font-mono text-foreground break-all">{status.sitemapUrl ?? "—"}</span>
            </div>
            {status.updatedAt ? <div className="mt-1 text-muted-foreground">Last updated: {new Date(status.updatedAt).toLocaleString()}</div> : null}
          </div>

          <form onSubmit={onSave} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="sitemap_base_url">Base URL</Label>
              <Input
                id="sitemap_base_url"
                value={value.baseUrl}
                onChange={(e) => onChange({ baseUrl: e.target.value })}
                placeholder="https://domainkamu.com"
                autoComplete="off"
                disabled={loading}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2">
                <span className="text-sm text-foreground">Include static pages</span>
                <Switch checked={value.includeStaticPages} onCheckedChange={(v) => onChange({ includeStaticPages: v })} disabled={loading} />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2">
                <span className="text-sm text-foreground">Include blog posts</span>
                <Switch checked={value.includeBlogPosts} onCheckedChange={(v) => onChange({ includeBlogPosts: v })} disabled={loading} />
              </label>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sitemap_custom_paths">Custom paths (1 per baris)</Label>
              <Textarea
                id="sitemap_custom_paths"
                value={value.customPathsText}
                onChange={(e) => onChange({ customPathsText: e.target.value })}
                placeholder="/packages\n/pricing"
                disabled={loading}
                rows={4}
              />
              <div className="text-xs text-muted-foreground">Format: path harus diawali "/". Kosongkan untuk tidak menambah.</div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={loading}>
                <Save className="h-4 w-4 mr-2" /> Save
              </Button>
              <Button type="button" variant="outline" onClick={onRefresh} disabled={loading}>
                <RefreshCcw className="h-4 w-4 mr-2" /> Refresh status
              </Button>
              <Button type="button" variant="outline" onClick={onOpenSitemap} disabled={loading || !status.sitemapUrl}>
                <LinkIcon className="h-4 w-4 mr-2" /> Open sitemap
              </Button>
              <Button type="button" variant="destructive" onClick={onClear} disabled={loading || !status.configured}>
                <Trash2 className="h-4 w-4 mr-2" /> Disable
              </Button>
            </div>
          </form>

          <div className="text-xs text-muted-foreground">
            Stored in <span className="font-medium text-foreground">website_settings</span> key: <span className="font-mono">sitemap_settings</span>.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
