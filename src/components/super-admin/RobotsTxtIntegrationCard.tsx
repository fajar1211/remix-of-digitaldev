import type { FormEvent } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Bot, Link as LinkIcon, RefreshCcw, Save, Trash2, TriangleAlert } from "lucide-react";

export type RobotsTxtStatus = {
  configured: boolean;
  updatedAt: string | null;
  robotsUrl: string | null;
};

export type RobotsTxtFormValue = {
  enabled: boolean;
  userAgent: string;
  allowText: string;
  disallowText: string;
  sitemapUrl: string;
};

type Props = {
  loading: boolean;
  status: RobotsTxtStatus;
  value: RobotsTxtFormValue;
  onChange: (patch: Partial<RobotsTxtFormValue>) => void;
  onSave: (e: FormEvent) => void;
  onRefresh: () => void;
  onClear: () => void;
  onOpenRobots: () => void;
  showDisallowAllWarning: boolean;
};

export function RobotsTxtIntegrationCard({
  loading,
  status,
  value,
  onChange,
  onSave,
  onRefresh,
  onClear,
  onOpenRobots,
  showDisallowAllWarning,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4" /> Robots.txt
          </CardTitle>
          <Badge variant={status.configured ? "default" : "secondary"}>{status.configured ? "Active" : "Not set"}</Badge>
        </div>
      </CardHeader>

      <CardContent className="text-sm text-muted-foreground">
        Kelola robots.txt secara dinamis dari dashboard.

        <div className="mt-4 space-y-4">
          <div className="rounded-md border bg-muted/30 p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Robots URL</span>
              <span className="font-mono text-foreground break-all">{status.robotsUrl ?? "—"}</span>
            </div>
            {status.updatedAt ? <div className="mt-1 text-muted-foreground">Last updated: {new Date(status.updatedAt).toLocaleString()}</div> : null}
          </div>

          {showDisallowAllWarning ? (
            <Alert>
              <TriangleAlert className="h-4 w-4" />
              <AlertTitle className="text-foreground">Warning: Disallow = "/"</AlertTitle>
              <AlertDescription>
                Ini akan memblokir seluruh website dari crawler. Pastikan memang itu yang kamu inginkan.
              </AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={onSave} className="space-y-3">
            <label className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2">
              <span className="text-sm text-foreground">Enable Robots.txt</span>
              <Switch checked={value.enabled} onCheckedChange={(v) => onChange({ enabled: v })} disabled={loading} />
            </label>

            <div className="space-y-1.5">
              <Label htmlFor="robots_user_agent">User Agent</Label>
              <Input
                id="robots_user_agent"
                value={value.userAgent}
                onChange={(e) => onChange({ userAgent: e.target.value })}
                placeholder="*"
                autoComplete="off"
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="robots_allow">Allow Paths (1 per baris)</Label>
              <Textarea
                id="robots_allow"
                value={value.allowText}
                onChange={(e) => onChange({ allowText: e.target.value })}
                placeholder="/"
                disabled={loading}
                rows={4}
              />
              <div className="text-xs text-muted-foreground">Setiap baris harus diawali "/".</div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="robots_disallow">Disallow Paths (1 per baris)</Label>
              <Textarea
                id="robots_disallow"
                value={value.disallowText}
                onChange={(e) => onChange({ disallowText: e.target.value })}
                placeholder=""
                disabled={loading}
                rows={4}
              />
              <div className="text-xs text-muted-foreground">Kosongkan jika tidak ada yang diblok.</div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="robots_sitemap">Sitemap URL</Label>
              <Input
                id="robots_sitemap"
                value={value.sitemapUrl}
                onChange={(e) => onChange({ sitemapUrl: e.target.value })}
                placeholder="https://.../sitemap-xml"
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
              <Button type="button" variant="outline" onClick={onOpenRobots} disabled={loading || !status.robotsUrl}>
                <LinkIcon className="h-4 w-4 mr-2" /> Open robots
              </Button>
              <Button type="button" variant="destructive" onClick={onClear} disabled={loading || !status.configured}>
                <Trash2 className="h-4 w-4 mr-2" /> Disable
              </Button>
            </div>
          </form>

          <div className="text-xs text-muted-foreground">
            Stored in <span className="font-medium text-foreground">website_settings</span> key: <span className="font-mono">robots_txt_settings</span>.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
