import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AccessRuleRow } from "./AccessRuleRow";

type ToolRow = {
  id: string;
  title: string;
  is_active: boolean;
};

type RuleRow = {
  tool_id: string;
  is_enabled: boolean;
};

type Props = {
  packageId: string;
  variant?: "card" | "submenu";
};

export function AiToolsAccessCard({ packageId, variant = "card" }: Props) {
  const [loading, setLoading] = useState(true);
  const [tools, setTools] = useState<ToolRow[]>([]);
  const [ruleByToolId, setRuleByToolId] = useState<Record<string, boolean>>({});
  const [aiAgentsEnabled, setAiAgentsEnabled] = useState<boolean>(true);

  const visibleTools = useMemo(() => tools.filter((t) => t.is_active), [tools]);

  useEffect(() => {
    if (!packageId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [
          { data: toolRows, error: toolErr },
          { data: rules, error: ruleErr },
          { data: aiAgentsRule, error: aiAgentsErr },
        ] = await Promise.all([
          (supabase as any)
            .from("assist_ai_tools")
            .select("id,title,is_active")
            .order("created_at", { ascending: false }),
          (supabase as any)
            .from("package_ai_tool_rules")
            .select("tool_id,is_enabled")
            .eq("package_id", packageId),
          (supabase as any)
            .from("package_menu_rules")
            .select("is_enabled")
            .eq("package_id", packageId)
            .eq("menu_key", "ai_agents")
            .maybeSingle(),
        ]);

        if (toolErr) throw toolErr;
        if (ruleErr) throw ruleErr;
        if (aiAgentsErr) throw aiAgentsErr;

        // Default for menu rules is enabled when missing.
        const nextAiAgentsEnabled = aiAgentsRule?.is_enabled ?? true;

        const nextTools: ToolRow[] = (toolRows ?? []).map((t: any) => ({
          id: String(t.id),
          title: String(t.title ?? ""),
          is_active: Boolean(t.is_active ?? true),
        }));

        const nextRules: Record<string, boolean> = {};
        (rules as unknown as RuleRow[] | null)?.forEach((r) => {
          nextRules[String(r.tool_id)] = Boolean(r.is_enabled);
        });

        // When AI Agents is OFF, we switch to "whitelist" mode:
        // only tools explicitly enabled in package_ai_tool_rules are usable.
        // When AI Agents is ON, default is enabled unless explicitly disabled.
        nextTools.forEach((t) => {
          if (nextRules[t.id] === undefined) nextRules[t.id] = nextAiAgentsEnabled ? true : false;
        });

        if (!cancelled) {
          setTools(nextTools);
          setRuleByToolId(nextRules);
          setAiAgentsEnabled(Boolean(nextAiAgentsEnabled));
        }
      } catch (e) {
        console.error(e);
        toast.error("Failed to load AI tool rules");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [packageId]);

  const setRule = async (toolId: string, enabled: boolean) => {
    if (!packageId) return;
    setRuleByToolId((prev) => ({ ...prev, [toolId]: enabled }));

    const { error } = await (supabase as any)
      .from("package_ai_tool_rules")
      .upsert(
        {
          package_id: packageId,
          tool_id: toolId,
          is_enabled: enabled,
        },
        { onConflict: "package_id,tool_id" }
      );

    if (error) {
      console.error(error);
      toast.error("Failed to save tool rule");
      setRuleByToolId((prev) => ({ ...prev, [toolId]: !enabled }));
      return;
    }

    toast.success("Tool rule saved");
  };

  const content = (
    <>
      {variant === "card" ? (
        <p className="text-xs text-muted-foreground">
          {aiAgentsEnabled
            ? "AI Agents enabled: tools are ON by default (unless you turn them off)."
            : "AI Agents disabled: whitelist mode — only tools you turn ON here remain usable."}
        </p>
      ) : null}

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : visibleTools.length === 0 ? (
        <p className="text-muted-foreground text-sm">No active tools found.</p>
      ) : (
        <div className="space-y-3">
          {visibleTools.map((tool) =>
            variant === "submenu" ? (
              <AccessRuleRow
                key={tool.id}
                label={tool.title || "(Untitled tool)"}
                description="Enable/disable this tool in AI Agents"
                checked={Boolean(ruleByToolId[tool.id])}
                onCheckedChange={(v) => setRule(tool.id, Boolean(v))}
              />
            ) : (
              <div
                key={tool.id}
                className="flex items-start justify-between gap-4 rounded-lg border border-border bg-background p-4"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{tool.title || "(Untitled tool)"}</div>
                  <div className="text-xs text-muted-foreground">Show/hide this tool in AI Agents</div>
                </div>

                <Switch checked={Boolean(ruleByToolId[tool.id])} onCheckedChange={(v: boolean) => setRule(tool.id, Boolean(v))} />
              </div>
            )
          )}
        </div>
      )}
    </>
  );

  if (variant === "submenu") {
    return <div className="space-y-3">{content}</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Agents — All Tools</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{content}</CardContent>
    </Card>
  );
}
