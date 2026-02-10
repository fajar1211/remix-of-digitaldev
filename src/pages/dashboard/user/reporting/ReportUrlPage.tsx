import { useEffect, useMemo, useState } from "react";

import { ExternalLink } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ReportKind = "local_insights" | "keyword_rankings" | "traffic_insights" | "conversion_insights";

const labelByKind: Record<ReportKind, string> = {
  local_insights: "Local Insights",
  keyword_rankings: "Keyword Rankings",
  traffic_insights: "Traffic Insights",
  conversion_insights: "Conversion Insights",
};

export default function ReportUrlPage({ kind }: { kind: ReportKind }) {
  const { user } = useAuth();
  const title = labelByKind[kind];

  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState<string | null>(null);

  const iframeAllowed = useMemo(() => {
    if (!url) return false;
    // Some URLs block embedding via X-Frame-Options / CSP; we still try, but keep a clear fallback.
    try {
      const u = new URL(url);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, [url]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        const { data: business, error: bErr } = await supabase
          .from("businesses")
          .select("id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (bErr) throw bErr;
        const businessId = (business as any)?.id as string | undefined;
        if (!businessId) {
          if (!cancelled) setUrl(null);
          return;
        }

        const { data, error } = await supabase
          .from("business_report_links")
          .select("url")
          .eq("business_id", businessId)
          .eq("kind", kind)
          .maybeSingle();

        if (error) throw error;
        if (!cancelled) setUrl(((data as any)?.url as string | null) ?? null);
      } catch (e) {
        console.error("Failed to load report URL", e);
        if (!cancelled) setUrl(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [user?.id, kind]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">Read-only report link provided by your assistant.</p>
        </div>

        {url ? (
          <Button asChild variant="outline">
            <a href={url} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open
            </a>
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : !url ? (
            <div className="text-sm text-muted-foreground text-center py-10">No report URL has been saved yet.</div>
          ) : iframeAllowed ? (
            <div className="w-full overflow-hidden rounded-md border border-border h-[60vh] md:h-[70vh] lg:h-[75vh]">
              <iframe title={title} src={url} className="h-full w-full" />
            </div>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-10">This report cannot be embedded.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
