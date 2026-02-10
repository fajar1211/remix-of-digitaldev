import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

const SETTINGS_KEY = "ga4_measurement_id";

function normalizeMeasurementId(input: unknown): string | null {
  const v = String(input ?? "").trim();
  if (!v) return null;
  // GA4 Measurement ID format: G-XXXXXXXXXX (letters/digits)
  if (!/^G-[A-Z0-9]{6,}$/i.test(v)) return null;
  return v.toUpperCase();
}

function ensureGa4Loaded(measurementId: string) {
  const scriptId = `ga4-gtag-js-${measurementId}`;
  const inlineId = `ga4-inline-${measurementId}`;

  // Avoid double-inject.
  if (document.getElementById(scriptId) || document.getElementById(inlineId)) return;

  const gtagScript = document.createElement("script");
  gtagScript.id = scriptId;
  gtagScript.async = true;
  gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(gtagScript);

  const inline = document.createElement("script");
  inline.id = inlineId;
  inline.type = "text/javascript";
  inline.text = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${measurementId}');
  `;
  document.head.appendChild(inline);
}

export function Ga4Script() {
  const [measurementId, setMeasurementId] = useState<string | null>(null);

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

      setMeasurementId(normalizeMeasurementId(data?.value));
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!measurementId) return;
    ensureGa4Loaded(measurementId);
  }, [measurementId]);

  return null;
}
