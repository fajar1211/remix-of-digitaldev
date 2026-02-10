import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

const SETTINGS_KEY = "gsc_verification_token";

function normalizeToken(input: unknown): string | null {
  const v = String(input ?? "").trim();
  if (!v) return null;
  // GSC token is typically URL-safe; keep it strict to avoid injecting unexpected characters.
  if (!/^[A-Za-z0-9._-]{10,256}$/.test(v)) return null;
  return v;
}

function ensureMetaLoaded(token: string) {
  const id = `gsc-verification-${token}`;
  if (document.getElementById(id)) return;

  // Ensure there is only 1 meta tag.
  const existing = document.querySelector("meta[name='google-site-verification']");
  if (existing) existing.remove();

  const meta = document.createElement("meta");
  meta.id = id;
  meta.setAttribute("name", "google-site-verification");
  meta.setAttribute("content", token);
  document.head.appendChild(meta);
}

export function GscVerificationMeta() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("website_settings")
        .select("value")
        .eq("key", SETTINGS_KEY)
        .maybeSingle();

      if (cancelled) return;
      if (error) return;

      setToken(normalizeToken(data?.value));
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    ensureMetaLoaded(token);
  }, [token]);

  return null;
}
