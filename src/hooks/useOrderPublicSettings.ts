import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export type OrderTemplate = {
  id: string;
  name: string;
  // Kategori template bersifat fleksibel (mengikuti input admin)
  category: string;
  is_active?: boolean;
  sort_order?: number;
  // URL gambar preview template (thumbnail) yang akan ditampilkan sebagai <img>
  preview_image_url?: string;
  // URL demo/preview website (dibuka di tab baru)
  preview_url?: string;
};

export type OrderContactSettings = {
  heading: string;
  description?: string;
  whatsapp_phone?: string;
  whatsapp_message?: string;
  email?: string;
};

export type OrderSubscriptionPlan = {
  years: number;
  label?: string;
  price_usd?: number;
  is_active?: boolean;
  sort_order?: number;
};

const SETTINGS_TEMPLATES_KEY = "order_templates";
const SETTINGS_CONTACT_KEY = "order_contact";
const SETTINGS_SUBSCRIPTION_PLANS_KEY = "order_subscription_plans";

const fallbackSubscriptionPlans: OrderSubscriptionPlan[] = [
  { years: 1, label: "1 Tahun", is_active: true, sort_order: 1 },
  { years: 2, label: "2 Tahun", is_active: true, sort_order: 2 },
  { years: 3, label: "3 Tahun", is_active: true, sort_order: 3 },
];

const fallbackTemplates: OrderTemplate[] = [];

function safeString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function safeNumber(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function isLikelyImageUrl(url: string): boolean {
  const u = (url ?? "").trim().toLowerCase();
  if (!u) return false;
  if (u.includes("/template-previews/")) return true;
  return /\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i.test(u);
}

function parseTemplates(value: unknown): OrderTemplate[] {
  if (!Array.isArray(value)) return fallbackTemplates;
  const normalized = value
    .map((raw) => {
      const obj = raw as any;
      const id = safeString(obj?.id).trim();
      const name = safeString(obj?.name).trim();
      const category = safeString(obj?.category).trim();
      const is_active = typeof obj?.is_active === "boolean" ? obj.is_active : true;
      const sort_order = safeNumber(obj?.sort_order);
      // Backward-compat:
      // - Dulu `preview_url` dipakai sebagai URL gambar.
      // - Sekarang gambar pindah ke `preview_image_url`, dan `preview_url` jadi URL demo.
      const legacyPreviewUrl = safeString(obj?.preview_url).trim();
      const explicitImageUrl = safeString(obj?.preview_image_url).trim();

      const preview_image_url = explicitImageUrl || (isLikelyImageUrl(legacyPreviewUrl) ? legacyPreviewUrl : "");
      const preview_url = !isLikelyImageUrl(legacyPreviewUrl) ? legacyPreviewUrl : "";
      if (!id || !name) return null;
      if (!category) return null;
      return {
        id,
        name,
        category,
        is_active,
        sort_order,
        preview_image_url: preview_image_url || undefined,
        preview_url: preview_url || undefined,
      } satisfies OrderTemplate;
    })
    .filter(Boolean) as OrderTemplate[];

  return normalized;
}

function parseContact(value: unknown): OrderContactSettings {
  const obj = (value ?? {}) as any;
  const heading = safeString(obj?.heading).trim() || "Butuh bantuan?";
  const description = safeString(obj?.description).trim() || "Hubungi kami untuk bantuan order.";
  const whatsapp_phone = safeString(obj?.whatsapp_phone).trim();
  const whatsapp_message = safeString(obj?.whatsapp_message).trim();
  const email = safeString(obj?.email).trim();
  return { heading, description, whatsapp_phone, whatsapp_message, email };
}

function parseSubscriptionPlans(value: unknown): OrderSubscriptionPlan[] {
  if (!Array.isArray(value)) return fallbackSubscriptionPlans;

  const normalized = value
    .map((raw) => {
      const obj = raw as any;
      const years = safeNumber(obj?.years);
      const label = safeString(obj?.label).trim();
      const price_usd = safeNumber(obj?.price_usd);
      const is_active = typeof obj?.is_active === "boolean" ? obj.is_active : true;
      const sort_order = safeNumber(obj?.sort_order);
      if (!years || years <= 0) return null;
      return {
        years,
        label: label || `${years} Tahun`,
        price_usd,
        is_active,
        sort_order: sort_order ?? years,
      } satisfies OrderSubscriptionPlan;
    })
    .filter(Boolean) as OrderSubscriptionPlan[];

  return normalized.length ? normalized : fallbackSubscriptionPlans;
}

function extractTld(domain: string): string | null {
  const d = (domain ?? "").trim().toLowerCase();
  if (!d.includes(".")) return null;
  const tld = d.split(".").pop() ?? "";
  const normalized = tld.replace(/^\./, "");
  return normalized || null;
}

function normalizeTldForRow(tld: string): string {
  return (tld ?? "").trim().toLowerCase().replace(/^\./, "");
}

export function useOrderPublicSettings(domain?: string, selectedPackageId?: string | null) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [templates, setTemplates] = useState<OrderTemplate[]>(fallbackTemplates);
  const [contact, setContact] = useState<OrderContactSettings>(() => parseContact(null));
  const [subscriptionPlans, setSubscriptionPlans] = useState<OrderSubscriptionPlan[]>(() => parseSubscriptionPlans(null));

  const [defaultPackageId, setDefaultPackageId] = useState<string | null>(null);
  const [tldPrices, setTldPrices] = useState<Array<{ tld: string; price_usd: number }>>([]);
  const [packagePriceUsd, setPackagePriceUsd] = useState<number | null>(null);
  const [packageName, setPackageName] = useState<string | null>(null);

  const [durationRows, setDurationRows] = useState<
    Array<{ duration_months: number; discount_percent: number; is_active: boolean; sort_order: number }> | null
  >(null);

  const tld = useMemo(() => (domain ? extractTld(domain) : null), [domain]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [{ data: tplRow }, { data: contactRow }, { data: plansRow }] = await Promise.all([
          (supabase as any).from("website_settings").select("value").eq("key", SETTINGS_TEMPLATES_KEY).maybeSingle(),
          (supabase as any).from("website_settings").select("value").eq("key", SETTINGS_CONTACT_KEY).maybeSingle(),
          (supabase as any)
            .from("website_settings")
            .select("value")
            .eq("key", SETTINGS_SUBSCRIPTION_PLANS_KEY)
            .maybeSingle(),
        ]);

        setTemplates(parseTemplates(tplRow?.value));
        setContact(parseContact(contactRow?.value));
        setSubscriptionPlans(parseSubscriptionPlans(plansRow?.value));

        const { data: pricingRow } = await (supabase as any)
          .from("domain_pricing_settings")
          .select("default_package_id")
          .eq("id", true)
          .maybeSingle();
        const pkgId = (pricingRow as any)?.default_package_id ?? null;
        setDefaultPackageId(pkgId);

        const effectivePkgId = selectedPackageId ?? pkgId;

        if (effectivePkgId) {
          const [{ data: pkgRow }, { data: prices }, { data: durations }] = await Promise.all([
            (supabase as any).from("packages").select("price,name").eq("id", effectivePkgId).maybeSingle(),
            (supabase as any).from("domain_tld_prices").select("tld,price_usd").eq("package_id", effectivePkgId),
            (supabase as any)
              .from("package_durations")
              .select("duration_months,discount_percent,is_active,sort_order")
              .eq("package_id", effectivePkgId)
              .order("sort_order", { ascending: true })
              .order("duration_months", { ascending: true }),
          ]);

          const p = safeNumber((pkgRow as any)?.price);
          setPackagePriceUsd(p ?? null);
          setPackageName(safeString((pkgRow as any)?.name).trim() || null);

          setTldPrices(
            Array.isArray(prices)
              ? prices
                  .map((p: any) => ({ tld: normalizeTldForRow(p?.tld), price_usd: Number(p?.price_usd ?? 0) }))
                  .filter((p: any) => p.tld)
              : [],
          );

          setDurationRows(
            Array.isArray(durations)
              ? (durations as any[]).map((d) => ({
                  duration_months: Number(d?.duration_months ?? 0),
                  discount_percent: Number(d?.discount_percent ?? 0),
                  is_active: d?.is_active !== false,
                  sort_order: Number(d?.sort_order ?? 0),
                }))
              : null,
          );
        } else {
          setPackagePriceUsd(null);
          setPackageName(null);
          setTldPrices([]);
          setDurationRows(null);
        }
      } catch (e: any) {
        console.error(e);
        setError(e?.message ?? "Gagal memuat order settings");
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedPackageId, domain]);

  const domainPriceUsd = useMemo(() => {
    if (!tld) return null;
    const row = tldPrices.find((p) => p.tld === normalizeTldForRow(tld));
    if (!row) return null;
    return Number.isFinite(row.price_usd) ? row.price_usd : null;
  }, [tld, tldPrices]);

  return {
    loading,
    error,
    templates: templates
      .filter((t) => t.is_active !== false)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    contact,
    subscriptionPlans: subscriptionPlans
      .filter((p) => p.is_active !== false)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    durationRows: durationRows?.filter((d) => d.is_active !== false) ?? [],
    pricing: {
      defaultPackageId,
      selectedPackageId: selectedPackageId ?? null,
      packageName,
      tldPrices,
      domainPriceUsd,
      domainTld: tld,
      packagePriceUsd,
    },
  };
}
