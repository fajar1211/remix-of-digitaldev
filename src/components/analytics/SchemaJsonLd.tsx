import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

type JsonLd = Record<string, unknown>;

type SchemaJsonLdResponse = {
  enabled: boolean;
  jsonld: JsonLd[];
};

function ensureJsonLdLoaded(payload: JsonLd[]) {
  const id = "schema-jsonld";
  const existing = document.getElementById(id);
  if (existing) existing.remove();

  const script = document.createElement("script");
  script.id = id;
  script.type = "application/ld+json";
  script.text = JSON.stringify(payload);
  document.head.appendChild(script);
}

export function SchemaJsonLd() {
  const [payload, setPayload] = useState<JsonLd[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Prefer public edge function (works for non-authenticated public pages)
      // Note: invoke uses POST; our function supports both GET and POST.
      const { data, error } = await supabase.functions.invoke<SchemaJsonLdResponse>("schema-jsonld", { body: {} });
      if (cancelled) return;
      if (error) return;

      if (!data?.enabled) {
        setPayload(null);
        return;
      }
      if (Array.isArray(data?.jsonld) && data.jsonld.length > 0) {
        setPayload(data.jsonld);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const id = "schema-jsonld";
    if (!payload) {
      const existing = document.getElementById(id);
      if (existing) existing.remove();
      return;
    }
    ensureJsonLdLoaded(payload);
  }, [payload]);

  return null;
}
