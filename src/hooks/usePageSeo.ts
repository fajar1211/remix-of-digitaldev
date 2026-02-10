import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { applySeoMeta } from "@/lib/seo";

export type PageMetaSettings = {
  metaTitle: string;
  metaDescription: string;
  canonicalUrl?: string;
  ogImageUrl?: string;
  ogImageAlt?: string;
};

type SettingsBlob = {
  pages?: Record<string, PageMetaSettings>;
};

const SETTINGS_KEY = "page_meta";

function parseSettings(value: unknown): SettingsBlob {
  if (!value || typeof value !== "object") return {};
  const v = value as any;
  const pagesRaw = v.pages;
  if (!pagesRaw || typeof pagesRaw !== "object") return {};

  const pages: Record<string, PageMetaSettings> = {};
  Object.entries(pagesRaw as Record<string, any>).forEach(([key, raw]) => {
    if (!raw || typeof raw !== "object") return;
    const metaTitle = typeof raw.metaTitle === "string" ? raw.metaTitle : "";
    const metaDescription = typeof raw.metaDescription === "string" ? raw.metaDescription : "";
    pages[key] = {
      metaTitle,
      metaDescription,
      canonicalUrl: typeof raw.canonicalUrl === "string" ? raw.canonicalUrl : undefined,
      ogImageUrl: typeof raw.ogImageUrl === "string" ? raw.ogImageUrl : undefined,
      ogImageAlt: typeof raw.ogImageAlt === "string" ? raw.ogImageAlt : undefined,
    };
  });

  return { pages };
}

export function usePageSeo(pageKey: string, fallback: { title: string; description?: string }) {
  const [settings, setSettings] = useState<PageMetaSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("website_settings")
        .select("value")
        .eq("key", SETTINGS_KEY)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        setSettings(null);
        return;
      }

      const parsed = parseSettings(data?.value);
      const page = parsed.pages?.[pageKey] ?? null;
      setSettings(page);
    })();

    return () => {
      cancelled = true;
    };
  }, [pageKey]);

  useEffect(() => {
    const metaTitle = (settings?.metaTitle || fallback.title || "").trim();
    const metaDescription = (settings?.metaDescription || fallback.description || "").trim();
    const canonicalUrl =
      (settings?.canonicalUrl || "").trim() || `${window.location.origin}${window.location.pathname}`;

    if (!metaTitle) return;

    applySeoMeta({
      title: metaTitle,
      description: metaDescription,
      canonicalUrl,
      og: {
        type: "website",
        title: metaTitle,
        description: metaDescription,
        url: canonicalUrl,
        imageUrl: (settings?.ogImageUrl || "").trim() || null,
        imageAlt: (settings?.ogImageAlt || "").trim() || null,
      },
    });
  }, [fallback.description, fallback.title, settings]);

  return settings;
}
