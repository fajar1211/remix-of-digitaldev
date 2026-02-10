import { ChevronDown, MoveDown, MoveUp } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { isOthers } from "./sort";
import type { CategoryGroup, BusinessTypeRow } from "./types";
import { BusinessTypesTable } from "./BusinessTypesTable";

type Props = {
  group: CategoryGroup;
  isFirstMovable: boolean;
  isLastMovable: boolean;
  onMoveCategory: (category: string, dir: "up" | "down") => void;
  onMoveType: (category: string, typeId: string, dir: "up" | "down") => void;
  onToggleActive: (id: string, next: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (row: BusinessTypeRow) => void;
};

export function CategoryGroupCard({
  group,
  isFirstMovable,
  isLastMovable,
  onMoveCategory,
  onMoveType,
  onToggleActive,
  onDelete,
  onEdit,
}: Props) {
  const othersCategory = isOthers(group.category);
  const count = group.types.length;

  const canMoveUp = useMemo(() => !othersCategory && !isFirstMovable, [isFirstMovable, othersCategory]);
  const canMoveDown = useMemo(() => !othersCategory && !isLastMovable, [isLastMovable, othersCategory]);

  return (
    <Card>
      <Collapsible defaultOpen={false}>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base truncate">{group.category}</CardTitle>
            <p className="text-sm text-muted-foreground">{count} type</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-md border border-border p-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={!canMoveUp}
                onClick={() => onMoveCategory(group.category, "up")}
                title="Move category up"
              >
                <MoveUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={!canMoveDown}
                onClick={() => onMoveCategory(group.category, "down")}
                title="Move category down"
              >
                <MoveDown className="h-4 w-4" />
              </Button>
            </div>

            <CollapsibleTrigger asChild>
              <Button type="button" size="sm" variant="outline" className="gap-2">
                <span className="hidden sm:inline">Minimize</span>
                <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent>
            <BusinessTypesTable
              category={group.category}
              rows={group.types}
              onMoveType={onMoveType}
              onToggleActive={onToggleActive}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
