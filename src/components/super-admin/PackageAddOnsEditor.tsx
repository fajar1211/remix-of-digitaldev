import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus } from "lucide-react";

export type PackageAddOnDraft = {
  id?: string;
  add_on_key: string;
  label: string;
  price_per_unit: number;
  unit_step: number;
  unit: string;
  is_active: boolean;
  sort_order?: number;
  max_quantity?: number | null;
};

export default function PackageAddOnsEditor({
  value,
  onChange,
  onRemove,
  disabled,
}: {
  value: PackageAddOnDraft[];
  onChange: (next: PackageAddOnDraft[]) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}) {
  const normalizeSort = (rows: PackageAddOnDraft[]) =>
    rows.map((r, idx) => ({
      ...r,
      sort_order: idx,
    }));

  const addRow = () => {
    onChange(
      normalizeSort([
        ...value,
        {
          add_on_key: "",
          label: "",
          price_per_unit: 0,
          unit_step: 1,
          unit: "unit",
          is_active: true,
          sort_order: value.length,
          max_quantity: null,
        },
      ])
    );
  };

  const update = (index: number, patch: Partial<PackageAddOnDraft>) => {
    onChange(normalizeSort(value.map((row, i) => (i === index ? { ...row, ...patch } : row))));
  };

  const remove = (index: number) => {
    const row = value[index];
    if (row?.id) onRemove(row.id);
    onChange(normalizeSort(value.filter((_, i) => i !== index)));
  };

  const move = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= value.length) return;
    const next = [...value];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onChange(normalizeSort(next));
  };

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Add-ons (Onboarding)</CardTitle>
          <p className="text-xs text-muted-foreground">These add-ons will appear on the onboarding package selection.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={disabled}>
          <Plus className="h-4 w-4 mr-2" />
          Add add-on
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {value.length === 0 ? (
          <p className="text-sm text-muted-foreground">No add-ons configured for this package.</p>
        ) : (
          <div className="space-y-3">
            {value.map((row, idx) => (
              <div key={row.id ?? `new-${idx}`} className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="grid gap-1">
                    <Label className="text-xs">Active</Label>
                    <Switch
                      checked={Boolean(row.is_active)}
                      onCheckedChange={(v) => update(idx, { is_active: Boolean(v) })}
                      disabled={disabled}
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => move(idx, idx - 1)}
                      disabled={disabled || idx === 0}
                      title="Move up"
                      aria-label="Move up"
                    >
                      <span className="text-sm font-semibold">↑</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => move(idx, idx + 1)}
                      disabled={disabled || idx === value.length - 1}
                      title="Move down"
                      aria-label="Move down"
                    >
                      <span className="text-sm font-semibold">↓</span>
                    </Button>

                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(idx)} disabled={disabled}>
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Remove</span>
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Add-on Key</Label>
                    <Input
                      value={row.add_on_key}
                      onChange={(e) => update(idx, { add_on_key: e.target.value })}
                      placeholder="e.g. extra_gmb_posts"
                      disabled={disabled}
                    />
                    <p className="text-xs text-muted-foreground">Unique for this package (used as identifier).</p>
                  </div>

                  <div className="grid gap-2">
                    <Label>Label</Label>
                    <Input
                      value={row.label}
                      onChange={(e) => update(idx, { label: e.target.value })}
                      placeholder="e.g. Extra GMB posts"
                      disabled={disabled}
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="grid gap-2">
                    <Label>Price / Unit</Label>
                    <Input
                      type="number"
                      value={row.price_per_unit}
                      onChange={(e) => update(idx, { price_per_unit: Number(e.target.value) })}
                      disabled={disabled}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Unit Step</Label>
                    <Input
                      type="number"
                      value={row.unit_step}
                      onChange={(e) => update(idx, { unit_step: Number(e.target.value) })}
                      disabled={disabled}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Unit</Label>
                    <Input
                      value={row.unit}
                      onChange={(e) => update(idx, { unit: e.target.value })}
                      placeholder="posts"
                      disabled={disabled}
                    />
                  </div>
                </div>

                <div className="grid gap-2 sm:max-w-xs">
                  <Label>Max Quantity (optional)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={row.max_quantity ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") {
                        update(idx, { max_quantity: null });
                        return;
                      }
                      const n = Number(raw);
                      update(idx, { max_quantity: Number.isFinite(n) ? Math.max(0, n) : null });
                    }}
                    placeholder="Unlimited"
                    disabled={disabled}
                  />
                  <p className="text-xs text-muted-foreground">Null/blank = unlimited clicks on + during onboarding.</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
