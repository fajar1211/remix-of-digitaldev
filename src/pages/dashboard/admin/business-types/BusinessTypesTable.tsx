import { MoveDown, MoveUp, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { BusinessTypeRow } from "./types";
import { isOthers } from "./sort";

type Props = {
  category: string;
  rows: BusinessTypeRow[];
  onMoveType: (category: string, typeId: string, dir: "up" | "down") => void;
  onToggleActive: (id: string, next: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (row: BusinessTypeRow) => void;
};

export function BusinessTypesTable({ category, rows, onMoveType, onToggleActive, onDelete, onEdit }: Props) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[220px]">Type</TableHead>
            <TableHead className="min-w-[120px]">Order</TableHead>
            <TableHead className="min-w-[120px]">Active</TableHead>
            <TableHead className="text-right min-w-[220px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, idx) => {
            const others = isOthers(r.type);
            const prevIsOthers = isOthers(rows[idx - 1]?.type);
            const nextIsOthers = isOthers(rows[idx + 1]?.type);

            const canUp = idx > 0 && !others && !prevIsOthers;
            const canDown = idx < rows.length - 1 && !others && !nextIsOthers;

            return (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.type}</TableCell>
                <TableCell className="text-muted-foreground">{r.sort_order}</TableCell>
                <TableCell>
                  <Switch checked={r.is_active} onCheckedChange={(v) => void onToggleActive(r.id, v)} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex items-center justify-end gap-1">
                    <div className="inline-flex items-center gap-1 rounded-md border border-border p-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={!canUp}
                        onClick={() => onMoveType(category, r.id, "up")}
                        title="Move up"
                      >
                        <MoveUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={!canDown}
                        onClick={() => onMoveType(category, r.id, "down")}
                        title="Move down"
                      >
                        <MoveDown className="h-4 w-4" />
                      </Button>
                    </div>

                    <Button type="button" size="sm" variant="ghost" onClick={() => onEdit(r)} title="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button type="button" size="sm" variant="ghost" title="Delete">
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Business Type?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. Are you sure you want to delete this Business Type?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>No</AlertDialogCancel>
                          <AlertDialogAction onClick={() => void onDelete(r.id)}>Yes, delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
