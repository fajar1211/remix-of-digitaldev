import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function AccountActivatedNotice({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" aria-hidden />

      <Card className="relative w-full max-w-md border-border bg-background p-5 shadow-lg">
        <div className="absolute right-2 top-2">
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close notification">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2 pr-8">
          <div className="text-base font-semibold text-foreground">🎉 Your account is now active!</div>
          <div className="text-sm text-muted-foreground">Please refresh the page to access all features.</div>
        </div>
      </Card>
    </div>
  );
}
