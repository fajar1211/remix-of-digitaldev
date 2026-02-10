export type ContactItemKey = "email" | "phone" | "whatsapp" | "location";

export type ContactItem = {
  key: ContactItemKey;
  title: string;
  detail: string;
  description: string;
  /** Only used when key === "whatsapp" */
  openingMessage?: string;
};

export const defaultItems: ContactItem[] = [
  {
    key: "email",
    title: "Email Us",
    detail: "hello@easymarketingassist.com",
    description: "We typically respond within 24 hours",
  },
  {
    key: "phone",
    title: "Call Us",
    detail: "+1 (555) 123-4567",
    description: "Mon-Fri from 9am to 5pm EST",
  },
  {
    key: "whatsapp",
    title: "WhatsApp",
    detail: "+1 (555) 123-4567",
    description: "Quick responses for existing clients",
    openingMessage: "",
  },
  {
    key: "location",
    title: "Location",
    detail: "Remote / Worldwide",
    description: "Available for global clients",
  },
];

export function sanitizeItems(value: unknown): ContactItem[] {
  if (!Array.isArray(value)) return defaultItems;

  const byKey = new Map<ContactItemKey, ContactItem>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const obj = raw as any;
    if (!["email", "phone", "whatsapp", "location"].includes(obj.key)) continue;

    const isWhatsapp = obj.key === "whatsapp";

    const item: ContactItem = {
      key: obj.key,
      title: typeof obj.title === "string" ? obj.title : "",
      detail: typeof obj.detail === "string" ? obj.detail : "",
      description: typeof obj.description === "string" ? obj.description : "",
      // Always keep the WhatsApp openingMessage field present (at least as empty string)
      // so the admin UI is stable and saves a consistent shape to the database.
      openingMessage:
        typeof obj.openingMessage === "string" ? obj.openingMessage : isWhatsapp ? "" : undefined,
    };
    byKey.set(item.key, item);
  }

  // Keep order stable
  return defaultItems.map((d) => byKey.get(d.key) ?? d);
}
