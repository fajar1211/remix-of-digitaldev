import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { ContactMessageForm } from "@/components/contact/ContactMessageForm";
import { supabase } from "@/integrations/supabase/client";

function getDisplayName(user: any): string {
  const meta = (user?.user_metadata ?? {}) as Record<string, any>;
  const fromMeta = String(meta?.name ?? "").trim();
  const first = String(meta?.first_name ?? "").trim();
  const last = String(meta?.last_name ?? "").trim();
  const combined = [first, last].filter(Boolean).join(" ").trim();
  return fromMeta || combined || String(user?.email ?? "").split("@")[0] || "";
}

export default function UserSupport() {
  const { user } = useAuth();

  const [accountStatus, setAccountStatus] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user?.id) {
        if (mounted) setAccountStatus(null);
        return;
      }

      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("account_status")
        .eq("id", user.id)
        .maybeSingle();

      if (!mounted) return;
      if (error) {
        console.error("Failed to load account status", error);
        setAccountStatus(null);
        return;
      }

      setAccountStatus(data?.account_status ? String(data.account_status) : null);
    })();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const name = useMemo(() => getDisplayName(user), [user]);
  const email = useMemo(() => String(user?.email ?? ""), [user]);
  const isActive = String(accountStatus ?? "").toLowerCase() === "active";
  const subject = isActive ? "" : "Account Activation";
  const subjectPlaceholder = isActive ? "What's this about?" : "Account Activation";

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold text-foreground">Support</h1>
        <p className="text-sm text-muted-foreground">Send a message to the team. We'll get back to you by email.</p>
      </header>

      <ContactMessageForm
        wrapper="card"
        source="business_support"
        defaultValues={{ name, email, subject }}
        disableNameEmail
        subjectPlaceholder={subjectPlaceholder}
        allowAttachment
      />
    </div>
  );
}
