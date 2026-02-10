import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";

import { AccessRuleRow } from "./AccessRuleRow";

type MenuKey = "tasks_progress" | "tasks_progress_create" | "tasks_progress_editing";

type Props = {
  ruleByKey: Record<MenuKey, boolean>;
  setRule: (menuKey: MenuKey, enabled: boolean) => void;
};

export function TasksProgressRulesGroup({ ruleByKey, setRule }: Props) {
  const [open, setOpen] = useState(false);

  const children = useMemo(
    () =>
      [
        {
          key: "tasks_progress_create" as const,
          label: "↳ Create Tasks",
          description: "Enable/disable creating tasks (New Task / Create Task) in User Dashboard.",
        },
        {
          key: "tasks_progress_editing" as const,
          label: "↳ Editing Tasks",
          description: "Enable/disable editing task details in /dashboard/user/tasks.",
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
      aria-label={open ? "Minimize Tasks & Progress rules" : "Expand Tasks & Progress rules"}
    >
      {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
    </Button>
  );

  return (
    <div className="space-y-2">
      <AccessRuleRow
        label="Tasks & Progress"
        description="Controls permissions for creating/editing tasks in User Dashboard."
        checked={Boolean(ruleByKey.tasks_progress)}
        onCheckedChange={() => {
          // Intentionally no-op: parent should not be directly toggleable.
          // Use sub-permissions below.
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
