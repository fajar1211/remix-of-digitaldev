import { useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

type RuleRow = {
  tool_id: string;
  is_enabled: boolean;
};

/**
 * Controls AI tool visibility (assist_ai_tools) per package.
 * Default behavior: tools are enabled unless explicitly disabled.
 */
export function usePackageAiToolRules(userId?: string) {
  const [loading, setLoading] = useState(true);
  const [enabledByToolId, setEnabledByToolId] = useState<Record<string, boolean> | null>(null);
  const lastPackageIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const run = async () => {
      setLoading(true);
      try {
        const nowIso = new Date().toISOString();
        const { data: activePkg } = await (supabase as any)
          .from("user_packages")
          .select("package_id")
          .eq("user_id", userId)
          // Single source of truth: profiles.account_status.
          // Package "current" is determined by timestamps, not user_packages.status.
          .not("activated_at", "is", null)
          .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
          .order("activated_at", { ascending: false })
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const packageId = (activePkg as any)?.package_id as string | undefined;
        if (!packageId) {
          if (!cancelled) setEnabledByToolId(null);
          return;
        }

        // If package changed, re-bind realtime listener.
        if (lastPackageIdRef.current !== packageId) {
          lastPackageIdRef.current = packageId;
          if (channel) {
            try {
              await supabase.removeChannel(channel);
            } catch {
              // ignore
            }
            channel = null;
          }

          // Keep rules fresh when super-admin toggles tool access.
          channel = supabase
            .channel(`realtime:package_ai_tool_rules:${packageId}`)
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "package_ai_tool_rules",
                filter: `package_id=eq.${packageId}`,
              },
              () => {
                // Re-fetch rules on any change.
                void run();
              }
            )
            .subscribe();
        }

        const { data: rules, error } = await (supabase as any)
          .from("package_ai_tool_rules")
          .select("tool_id,is_enabled")
          .eq("package_id", packageId);

        if (error) throw error;

        const next: Record<string, boolean> = {};
        let foundAny = false;
        (rules as unknown as RuleRow[] | null)?.forEach((r) => {
          const id = String(r.tool_id);
          next[id] = Boolean(r.is_enabled);
          foundAny = true;
        });

        // If no rules exist for that package, don't gate anything.
        if (!cancelled) setEnabledByToolId(foundAny ? next : null);
      } catch {
        if (!cancelled) setEnabledByToolId(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();

    const onFocus = () => {
      void run();
    };

    // Ensure we also refresh when the user switches tabs.
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      cancelled = true;

      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);

      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [userId]);

  const isToolEnabled = useMemo(() => {
    return (toolId: string) => enabledByToolId?.[toolId] ?? true;
  }, [enabledByToolId]);

  return { loading, enabledByToolId, isToolEnabled };
}
