import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Globe, RefreshCcw } from "lucide-react";

type Props = {
  loading: boolean;
  configured: boolean;
  updatedAt: string | null;
  onRefresh: () => void;
};

/**
 * Domainr integration is currently disabled in UI.
 * We still allow super-admins to refresh/read the configured status.
 */
export function DomainrIntegrationCard({ loading, configured, updatedAt, onRefresh }: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-4 w-4" /> Domain Lookup (Domainr)
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Disabled</Badge>
            <Badge variant={configured ? "default" : "secondary"}>{configured ? "Configured" : "Not set"}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Integrasi Domainr dinonaktifkan.
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onRefresh} disabled={loading}>
            <RefreshCcw className="h-4 w-4 mr-2" /> Refresh status
          </Button>
        </div>

        <div className="mt-4 text-xs text-muted-foreground">
          Secret: <span className="font-medium text-foreground">domainr/api_key</span>.
          {updatedAt ? <span> Terakhir update: {new Date(updatedAt).toLocaleString()}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}
