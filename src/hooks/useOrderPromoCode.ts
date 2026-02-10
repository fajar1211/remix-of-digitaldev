import { supabase } from "@/integrations/supabase/client";

export type PromoStatus = "draft" | "scheduled" | "active" | "expired";
export type PromoDiscountType = "percentage" | "fixed";

export type OrderPromo = {
  id: string;
  code: string;
  promo_name: string;
  status: PromoStatus;
  discount_type: PromoDiscountType;
  discount_value: number;
  starts_at: string | null;
  ends_at: string | null;
};

function sanitizeCode(code: string) {
  return String(code ?? "").trim();
}

function isSafeExactIlike(code: string) {
  // Prevent wildcard matching in `ilike`.
  return !code.includes("%") && !code.includes("_");
}

export async function validatePromoCode(codeInput: string, totalUsd: number) {
  const code = sanitizeCode(codeInput);
  if (!code) return { ok: false as const, reason: "empty" as const };
  if (!isSafeExactIlike(code)) return { ok: false as const, reason: "invalid_code" as const };

  const { data, error } = await (supabase as any)
    .from("order_promos")
    .select("id,code,promo_name,status,discount_type,discount_value,starts_at,ends_at")
    .ilike("code", code)
    .maybeSingle();

  if (error) return { ok: false as const, reason: "error" as const, error };
  if (!data) return { ok: false as const, reason: "not_found" as const };

  const promo = data as OrderPromo;
  const now = Date.now();
  const startsAt = promo.starts_at ? Date.parse(promo.starts_at) : null;
  const endsAt = promo.ends_at ? Date.parse(promo.ends_at) : null;

  const isTimeValid = (startsAt == null || now >= startsAt) && (endsAt == null || now <= endsAt);
  const isStatusValid = promo.status === "active" || promo.status === "scheduled";
  if (!isStatusValid || !isTimeValid) return { ok: false as const, reason: "inactive" as const, promo };

  const baseTotal = Number.isFinite(totalUsd) && totalUsd > 0 ? totalUsd : 0;
  const value = Number(promo.discount_value ?? 0);

  let discountUsd = 0;
  if (promo.discount_type === "percentage") {
    const pct = Math.max(0, Math.min(100, value));
    discountUsd = (baseTotal * pct) / 100;
  } else {
    discountUsd = Math.max(0, value);
  }
  discountUsd = Math.min(baseTotal, discountUsd);

  return {
    ok: true as const,
    promo,
    discountUsd,
    totalAfterDiscountUsd: Math.max(0, baseTotal - discountUsd),
  };
}
