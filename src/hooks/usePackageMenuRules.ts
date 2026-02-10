import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MenuKey =
  | "ai_agents"
  | "messages"
  | "content_planner"
  | "content_planner_send_to_tasks"
  | "content_planner_edit_scheduled"
  | "reporting"
  | "tasks_progress"
  | "tasks_progress_create"
  | "tasks_progress_editing";

const CONTROLLED_KEYS: MenuKey[] = [
  "ai_agents",
  "messages",
  "content_planner",
  "content_planner_send_to_tasks",
  "content_planner_edit_scheduled",
  "reporting",
  "tasks_progress",
  "tasks_progress_create",
  "tasks_progress_editing",
];

type RuleRow = {
  menu_key: string;
  is_enabled: boolean;
};

export function usePackageMenuRules(userId?: string) {
  const [loading, setLoading] = useState(true);
  const [enabledByKey, setEnabledByKey] = useState<Record<MenuKey, boolean> | null>(null);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        const nowIso = new Date().toISOString();
        const { data: activePkg } = await supabase
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
          if (!cancelled) setEnabledByKey(null);
          return;
        }

        const { data: rules, error } = await supabase
          .from("package_menu_rules")
          .select("menu_key,is_enabled")
          .eq("package_id", packageId);
        if (error) throw error;

        // Default: enabled unless explicitly disabled
        const next: Record<MenuKey, boolean> = {
          ai_agents: true,
          messages: true,
          content_planner: true,
          content_planner_send_to_tasks: true,
          content_planner_edit_scheduled: true,
          reporting: true,
          tasks_progress: true,
          tasks_progress_create: true,
          tasks_progress_editing: true,
        };

        let foundAny = false;
        const rawRuleByKey: Record<string, boolean> = {};
        (rules as RuleRow[] | null)?.forEach((r) => {
          rawRuleByKey[String(r.menu_key)] = Boolean(r.is_enabled);
        });

        (rules as RuleRow[] | null)?.forEach((r) => {
          const k = String(r.menu_key) as MenuKey;
          if (CONTROLLED_KEYS.includes(k)) {
            next[k] = Boolean(r.is_enabled);
            foundAny = true;
          }
        });

        // Backward compatibility:
        // Previously, `tasks_progress` controlled "create tasks".
        // Now we expose `tasks_progress_create` and keep parent `tasks_progress` always enabled.
        if (rawRuleByKey.tasks_progress_create === undefined && rawRuleByKey.tasks_progress !== undefined) {
          next.tasks_progress_create = Boolean(rawRuleByKey.tasks_progress);
          foundAny = true;
        }

        // Parent container is always considered enabled at runtime (menu stays visible).
        next.tasks_progress = true;

        // If no rules exist for that package, don't gate anything.
        if (!cancelled) setEnabledByKey(foundAny ? next : null);
      } catch {
        if (!cancelled) setEnabledByKey(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const isEnabled = useMemo(() => {
    return (key: MenuKey) => enabledByKey?.[key] ?? true;
  }, [enabledByKey]);

  return { loading, enabledByKey, isEnabled };
}
