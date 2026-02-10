import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AccessRuleRow } from "./access-control/AccessRuleRow";
import { AiAgentsToolsRulesGroup } from "./access-control/AiAgentsToolsRulesGroup";
import { ContentPlannerRulesGroup } from "./access-control/ContentPlannerRulesGroup";
import { TasksProgressRulesGroup } from "./access-control/TasksProgressRulesGroup";

type PackageRow = {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
};

type MenuKey =
  | "ai_agents"
  | "messages"
  | "content_planner"
  | "content_planner_send_to_tasks"
  | "content_planner_edit_scheduled"
  | "reporting"
  | "tasks_progress"
  | "tasks_progress_create"
  | "tasks_progress_editing";

// NOTE: We keep a single source-of-truth list for seeding keys in DB.
const ALL_MENU_ITEMS: { key: MenuKey; label: string; description: string }[] = [
  // Content Planner group (rendered as expandable section)
  { key: "content_planner", label: "Content Planner", description: "Control access to the Content Planner feature in User Dashboard." },
  {
    key: "content_planner_send_to_tasks",
    label: "↳ Send to Tasks",
    description: 'Enable/disable button “Send to Tasks” in /dashboard/user/content-planner.',
  },
  {
    key: "content_planner_edit_scheduled",
    label: "↳ Edit Scheduled Content",
    description: "Enable/disable editing fields (read-only when disabled) in /dashboard/user/content-planner.",
  },

  // Tasks & Progress group
  { key: "tasks_progress", label: "Tasks & Progress", description: "Controls permissions for creating/editing tasks in User Dashboard." },
  {
    key: "tasks_progress_create",
    label: "↳ Create Tasks",
    description: "Enable/disable creating tasks (New Task / Create Task) in User Dashboard.",
  },
  {
    key: "tasks_progress_editing",
    label: "↳ Editing Tasks",
    description: "Enable/disable editing task details in /dashboard/user/tasks.",
  },

  // Other items (rendered as flat list)
  { key: "ai_agents", label: "AI Agents", description: "(Managed per tool below)" },
  { key: "messages", label: "Messages", description: "Enable/disable sending messages in User Dashboard." },
  { key: "reporting", label: "Reporting & Visibility", description: "Show/hide Reporting & Visibility in User Dashboard." },
];

const FLAT_MENU_ITEMS = ALL_MENU_ITEMS.filter(
  (i) =>
    ![
      "ai_agents",
      "content_planner",
      "content_planner_send_to_tasks",
      "content_planner_edit_scheduled",
      "tasks_progress",
      "tasks_progress_create",
      "tasks_progress_editing",
    ].includes(i.key)
);

type RuleRow = {
  menu_key: string;
  is_enabled: boolean;
};

async function ensureMenuRuleRowsExist(packageId: string, existingKeys: Set<string>) {
  const missing = ALL_MENU_ITEMS.filter((i) => !existingKeys.has(i.key));
  if (missing.length === 0) return;

  // Seed missing keys as enabled=true so they exist as rows in DB.
  // This makes future ON/OFF changes explicit and persistent.
  await supabase
    .from("package_menu_rules")
    .upsert(
      missing.map((m) => ({
        package_id: packageId,
        menu_key: m.key,
        is_enabled: true,
      })) as any,
      { onConflict: "package_id,menu_key" }
    );
}

export default function SuperAdminAccessControl() {
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");
  const [ruleByKey, setRuleByKey] = useState<Record<MenuKey, boolean>>({
    ai_agents: true,
    messages: true,
    content_planner: true,
    content_planner_send_to_tasks: true,
    content_planner_edit_scheduled: true,
    reporting: true,
    tasks_progress: true,
    tasks_progress_create: true,
    tasks_progress_editing: true,
  });

  const selectedPackage = useMemo(
    () => packages.find((p) => String(p.id) === String(selectedPackageId)),
    [packages, selectedPackageId]
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("packages")
          .select("id,name,type,is_active")
          .order("created_at", { ascending: true });
        if (error) throw error;
        const list = (data ?? []).map((p: any) => ({
          id: String(p.id),
          name: String(p.name ?? ""),
          type: String(p.type ?? ""),
          is_active: Boolean(p.is_active ?? true),
        })) as PackageRow[];

        const ORDER = ["starter", "growth", "pro", "optimize", "scale", "dominate"];
        const rank = (pkgType: string) => {
          const i = ORDER.indexOf(String(pkgType ?? "").toLowerCase().trim());
          return i === -1 ? 999 : i;
        };

        list.sort((a, b) => {
          const ra = rank(a.type);
          const rb = rank(b.type);
          if (ra !== rb) return ra - rb;
          const an = a.name.toLowerCase();
          const bn = b.name.toLowerCase();
          if (an < bn) return -1;
          if (an > bn) return 1;
          return 0;
        });

        setPackages(list);
        if (!selectedPackageId && list[0]?.id) setSelectedPackageId(list[0].id);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load packages");
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedPackageId) return;

    const loadRules = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("package_menu_rules")
          .select("menu_key,is_enabled")
          .eq("package_id", selectedPackageId);
        if (error) throw error;

        const existingKeys = new Set<string>((data as RuleRow[] | null)?.map((r) => String(r.menu_key)) ?? []);
        await ensureMenuRuleRowsExist(selectedPackageId, existingKeys);

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

        (data as RuleRow[] | null)?.forEach((r) => {
          const k = String(r.menu_key) as MenuKey;
          if (k in next) next[k] = Boolean(r.is_enabled);
        });
        setRuleByKey(next);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load access rules");
      } finally {
        setLoading(false);
      }
    };

    loadRules();
  }, [selectedPackageId]);

  const setRule = async (menuKey: MenuKey, enabled: boolean) => {
    if (!selectedPackageId) return;
    setRuleByKey((prev) => ({ ...prev, [menuKey]: enabled }));

    const { error } = await supabase
      .from("package_menu_rules")
      .upsert(
        {
          package_id: selectedPackageId,
          menu_key: menuKey,
          is_enabled: enabled,
        } as any,
        { onConflict: "package_id,menu_key" }
      );

    if (error) {
      console.error(error);
      toast.error("Failed to save rule");
      setRuleByKey((prev) => ({ ...prev, [menuKey]: !enabled }));
      return;
    }

    toast.success("Rule saved");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Access Control</h1>
        <p className="text-muted-foreground">Control User Dashboard menus based on the user's package.</p>
      </div>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Package</CardTitle>
          <div className="w-full sm:w-80">
            <Select value={selectedPackageId} onValueChange={setSelectedPackageId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a package" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                {packages.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} {p.type ? `(${p.type})` : ""} {p.is_active ? "" : "• inactive"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : !selectedPackage ? (
            <p className="text-muted-foreground text-sm">Select a package to configure.</p>
          ) : (
            <div className="space-y-3">
              <ContentPlannerRulesGroup
                ruleByKey={ruleByKey as any}
                setRule={setRule as any}
              />

              <TasksProgressRulesGroup ruleByKey={ruleByKey as any} setRule={setRule as any} />

              {selectedPackageId ? <AiAgentsToolsRulesGroup packageId={selectedPackageId} /> : null}

              {FLAT_MENU_ITEMS.map((item) => (
                <AccessRuleRow
                  key={item.key}
                  label={item.label}
                  description={item.description}
                  checked={Boolean(ruleByKey[item.key])}
                  onCheckedChange={(v) => setRule(item.key, v)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
