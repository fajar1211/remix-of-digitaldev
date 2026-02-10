import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";

import { AccessRuleRow } from "./AccessRuleRow";

type MenuKey = "content_planner" | "content_planner_send_to_tasks" | "content_planner_edit_scheduled";

type Props = {
  ruleByKey: Record<MenuKey, boolean>;
  setRule: (menuKey: MenuKey, enabled: boolean) => void;
};

export function ContentPlannerRulesGroup({ ruleByKey, setRule }: Props) {
  const [open, setOpen] = useState(false);

  const children = useMemo(
    () =>
      [
        {
          key: "content_planner_send_to_tasks" as const,
          label: "↳ Send to Tasks",
          description: 'Enable/disable button “Send to Tasks” in /dashboard/user/content-planner.',
        },
        {
          key: "content_planner_edit_scheduled" as const,
          label: "↳ Edit Scheduled Content",
          description: "Enable/disable editing fields (read-only when disabled) in /dashboard/user/content-planner.",
        },
      ] as const,
    []
  );

  const parentLeading = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-6 w-6"
      onClick={() => setOpen((v) => !v)}
      aria-label={open ? "Minimize Content Planner rules" : "Expand Content Planner rules"}
    >
      {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
    </Button>
  );

  return (
    <div className="space-y-2">
      <AccessRuleRow
        label="Content Planner"
        // User request: remove 'Show/hide ...' wording from description
        description="Control access to the Content Planner feature in User Dashboard."
        checked={Boolean(ruleByKey.content_planner)}
        onCheckedChange={() => {
          // Intentionally no-op: user requested removing the ON/OFF switch for parent rule.
          // Sub-rules are still controllable below.
        }}
        leading={parentLeading}
        hideSwitch
      />

      {open ? (
        <div className="space-y-2 pl-8">
          {children.map((c) => (
            <AccessRuleRow
              key={c.key}
              label={c.label}
              description={c.description}
              checked={Boolean(ruleByKey[c.key])}
              onCheckedChange={(v) => setRule(c.key, v)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
