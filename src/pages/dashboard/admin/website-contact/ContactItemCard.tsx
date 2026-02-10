import type React from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { ContactItem, ContactItemKey } from "./types";

type Props = {
  item: ContactItem;
  icon: React.ElementType;
  disabled: boolean;
  onChange: (key: ContactItemKey, patch: Partial<Omit<ContactItem, "key">>) => void;
};

export function ContactItemCard({ item, icon: Icon, disabled, onChange }: Props) {
  return (
    <Card className="shadow-soft">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">{item.key.toUpperCase()}</CardTitle>
            <CardDescription>Ubah teks yang ditampilkan.</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`${item.key}-title`}>Title</Label>
          <Input
            id={`${item.key}-title`}
            value={item.title}
            disabled={disabled}
            onChange={(e) => onChange(item.key, { title: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${item.key}-detail`}>Detail</Label>
          <Input
            id={`${item.key}-detail`}
            value={item.detail}
            disabled={disabled}
            onChange={(e) => onChange(item.key, { detail: e.target.value })}
          />
        </div>

        {item.key === "whatsapp" ? (
          <div className="space-y-2">
            <Label htmlFor={`${item.key}-openingMessage`}>Whatsapp Message</Label>
            <Textarea
              id={`${item.key}-openingMessage`}
              value={item.openingMessage ?? ""}
              disabled={disabled}
              rows={4}
              placeholder="Contoh: Hallo !!!\nSaya ingin bertanya tentang..."
              onChange={(e) => onChange(item.key, { openingMessage: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Saat user klik WhatsApp di halaman /contact, teks ini akan otomatis terisi sebagai chat.
            </p>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor={`${item.key}-desc`}>Description</Label>
          <Input
            id={`${item.key}-desc`}
            value={item.description}
            disabled={disabled}
            onChange={(e) => onChange(item.key, { description: e.target.value })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
