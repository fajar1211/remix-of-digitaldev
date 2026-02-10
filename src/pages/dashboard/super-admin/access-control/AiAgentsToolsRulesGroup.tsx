import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";

import { AccessRuleRow } from "./AccessRuleRow";
import { AiToolsAccessCard } from "./AiToolsAccessCard";

type Props = {
  packageId: string;
};

export function AiAgentsToolsRulesGroup({ packageId }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      <AccessRuleRow
        label="AI Agents"
        description="Configure access to individual AI tools (All Tools)."
        checked
        onCheckedChange={() => {
          // Intentionally no-op: parent has no ON/OFF.
        }}
        hideSwitch
        leading={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Collapse AI Agents" : "Expand AI Agents"}
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        }
      />

      {open ? (
        <div className="pl-9">
          <AiToolsAccessCard packageId={packageId} variant="submenu" />
        </div>
      ) : null}
    </div>
  );
}
