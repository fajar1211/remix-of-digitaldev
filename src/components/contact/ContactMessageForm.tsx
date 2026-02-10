import { useMemo, useState } from "react";
import { z } from "zod";
import { Send, Paperclip, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  email: z.string().trim().email("Please enter a valid email").max(255, "Email must be less than 255 characters"),
  subject: z.string().trim().min(1, "Subject is required").max(200, "Subject must be less than 200 characters"),
  message: z.string().trim().min(1, "Message is required").max(2000, "Message must be less than 2000 characters"),
});

export type ContactMessageFormProps = {
  source?: string;
  defaultValues?: Partial<z.infer<typeof contactSchema>>;
  onSubmitted?: () => void;
  wrapper?: "card" | "none";
  disableNameEmail?: boolean;
  subjectPlaceholder?: string;
  allowAttachment?: boolean;
};

export function ContactMessageForm({
  source = "contact_page",
  defaultValues,
  onSubmitted,
  wrapper = "card",
  disableNameEmail = false,
  subjectPlaceholder,
  allowAttachment = false,
}: ContactMessageFormProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: defaultValues?.name ?? "",
    email: defaultValues?.email ?? "",
    subject: defaultValues?.subject ?? "",
    message: defaultValues?.message ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);

  const acceptedFileTypes = useMemo(() => {
    // images + pdf (as requested)
    return ["image/*", "application/pdf"].join(",");
  }, []);

  const validateAttachment = (file: File) => {
    const maxBytes = 10 * 1024 * 1024; // 10MB
    if (file.size > maxBytes) return "File terlalu besar (maks 10MB).";
    const isPdf = file.type === "application/pdf";
    const isImage = file.type.startsWith("image/");
    if (!isPdf && !isImage) return "File harus berupa gambar atau PDF.";
    return null;
  };

  const uploadAttachment = async (file: File) => {
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    const safeExt = ext ? `.${ext}` : "";
    const fileName = `${Date.now()}-${Math.random().toString(16).slice(2)}${safeExt}`;
    const path = `support-attachments/${fileName}`;

    const { error } = await supabase.storage.from("user-files").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });
    if (error) throw error;

    const { data } = supabase.storage.from("user-files").getPublicUrl(path);
    return {
      url: data.publicUrl,
      name: file.name,
      mime: file.type || null,
      size: file.size,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (allowAttachment && attachment) {
      const fileErr = validateAttachment(attachment);
      if (fileErr) {
        setErrors((prev) => ({ ...prev, attachment: fileErr }));
        return;
      }
    }

    const result = contactSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((error) => {
        if (error.path[0]) fieldErrors[error.path[0] as string] = error.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const uploaded = allowAttachment && attachment ? await uploadAttachment(attachment) : null;

      const payload = {
        name: result.data.name,
        email: result.data.email,
        subject: result.data.subject,
        message: result.data.message,
        source,
        status: "new",
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        attachment_url: uploaded?.url ?? null,
        attachment_name: uploaded?.name ?? null,
        attachment_mime: uploaded?.mime ?? null,
        attachment_size: uploaded?.size ?? null,
      };

      const { error } = await (supabase as any).from("website_inquiries").insert(payload);
      if (error) throw error;

      toast({ title: "Message sent!", description: "We'll get back to you as soon as possible." });
      setFormData({ name: "", email: "", subject: "", message: "" });
      setAttachment(null);
      onSubmitted?.();
    } catch (err) {
      console.error("Contact submit error:", err);
      toast({
        title: "Failed to send",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const FormInner = (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            placeholder="Your name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className={errors.name ? "border-destructive" : ""}
            disabled={disableNameEmail}
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="your@email.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className={errors.email ? "border-destructive" : ""}
            disabled={disableNameEmail}
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          placeholder={subjectPlaceholder ?? "What's this about?"}
          value={formData.subject}
          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
          className={errors.subject ? "border-destructive" : ""}
        />
        {errors.subject && <p className="text-sm text-destructive">{errors.subject}</p>}
      </div>

      {allowAttachment ? (
        <div className="space-y-2">
          <Label htmlFor="attachment">Attachment (PDF / Image)</Label>
          <div className="flex items-center gap-2">
            <Input
              id="attachment"
              type="file"
              accept={acceptedFileTypes}
              onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
                className={
                  [
                    "h-9 text-xs",
                    "file:mr-3 file:rounded-md file:border-0",
                    "file:bg-muted file:px-3 file:py-1",
                    "file:text-xs file:font-medium file:text-foreground",
                    "hover:file:bg-muted/80",
                    errors.attachment ? "border-destructive" : "",
                  ].join(" ")
                }
            />
            {attachment ? (
              <Button type="button" variant="outline" size="icon" onClick={() => setAttachment(null)}>
                <X className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" variant="outline" size="icon" disabled>
                <Paperclip className="h-4 w-4" />
              </Button>
            )}
          </div>
          {attachment ? (
            <p className="text-xs text-muted-foreground break-words">
              {attachment.name} • {(attachment.size / 1024 / 1024).toFixed(2)} MB
            </p>
          ) : null}
          {errors.attachment && <p className="text-sm text-destructive">{errors.attachment}</p>}
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="message">Message</Label>
        <Textarea
          id="message"
          placeholder="Tell us how we can help..."
          rows={5}
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          className={errors.message ? "border-destructive" : ""}
        />
        {errors.message && <p className="text-sm text-destructive">{errors.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Sending..." : "Send Message"}
        <Send className="ml-2 h-4 w-4" />
      </Button>
    </form>
  );

  if (wrapper === "none") return FormInner;

  return (
    <Card className="shadow-soft animate-fade-in">
      <CardHeader>
        <CardTitle className="text-2xl">Send Us a Message</CardTitle>
        <CardDescription>Fill out the form below and we'll get back to you within 24 hours.</CardDescription>
      </CardHeader>
      <CardContent>{FormInner}</CardContent>
    </Card>
  );
}
