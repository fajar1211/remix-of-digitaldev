import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Copy } from "lucide-react";
import { useCallback } from "react";

export type BusinessInfoField = {
  label: string;
  value: string;
};

export type BusinessInfoPanelMode = "show" | "copy-only";

function normalizeValue(v: unknown) {
  const s = (v ?? "").toString().trim();
  return s.length ? s : "-";
}

export default function BusinessInfoPanel({
  fields,
  mode = "show",
}: {
  fields: BusinessInfoField[];
  mode?: BusinessInfoPanelMode;
}) {
  const { toast } = useToast();

  const handleCopy = useCallback(
    async (text: string) => {
      const normalized = normalizeValue(text);
      if (normalized === "-") {
        toast({ variant: "destructive", title: "No data available", description: "This field is empty." });
        return;
      }
      await navigator.clipboard.writeText(normalized);
      toast({ title: "Copied", description: "Copied to your clipboard." });
    },
    [toast]
  );

  return (
    <section className="space-y-3">
      <div className="text-sm font-semibold text-foreground">Business Information</div>
      <div className="space-y-3">
        {fields.map((f) => (
          <div key={f.label} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs text-muted-foreground">{f.label}</Label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => void handleCopy(f.value)}
                aria-label={`Copy ${f.label}`}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            {mode === "show" ? (
              <div className="text-sm text-foreground break-words whitespace-pre-wrap">{normalizeValue(f.value)}</div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
