import { useCallback, useEffect, useMemo, useState } from "react";
import { Package, Check, ArrowUpRight, Star, Minus, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useSupabaseRealtimeReload } from "@/hooks/useSupabaseRealtimeReload";
import {
  buildDurationOptionsFromDb,
  computeDiscountedTotal,
  formatDurationLabel,
  type PackageDurationRow,
} from "@/lib/packageDurations";
import { toast } from "sonner";
import { z } from "zod";

/** Format number as IDR currency: Rp 1.500.000 */
function formatIdr(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "Rp 0";
  return "Rp " + Math.round(value).toLocaleString("id-ID");
}

/** Key used in website_settings for subscription plans per package */
const SETTINGS_SUBSCRIPTION_PLANS_KEY = "order_subscription_plans";
function getSubscriptionPlansKey(packageId?: string) {
  const id = String(packageId ?? "").trim();
  return id ? `${SETTINGS_SUBSCRIPTION_PLANS_KEY}:${id}` : SETTINGS_SUBSCRIPTION_PLANS_KEY;
}

type SubscriptionPlanRow = {
  years: number;
  label: string;
  price_usd: number; // actually IDR despite the legacy key name
  base_price_idr: number;
  discount_percent: number;
  is_active: boolean;
};

interface UserPackage {
  id: string;
  package_id?: string;
  status: string;
  started_at: string;
  activated_at?: string | null;
  expires_at: string | null;
  duration_months?: number | null;
  packages: {
    name: string;
    type: string;
    description: string;
    features: string[];
    price: number;
  };
}

interface AvailablePackage {
  id: string;
  name: string;
  type: string;
  description: string;
  features: string[];
  price: number;
}

interface PackageAddOnRow {
  id: string;
  add_on_key: string;
  label: string;
  price_per_unit: number;
  unit_step: number;
  unit: string;
  is_active: boolean;
  sort_order: number;
  max_quantity: number | null;
}

type AddOnSelectionRow = {
  id: string;
  user_id: string;
  add_on_id: string;
  quantity: number;
};

const addOnQuantitySchema = z.number().int().min(0);

const PACKAGE_TIER_ORDER = ["starter", "growth", "pro", "optimize", "scale", "dominate", "custom"] as const;

function normalizeTier(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function sortByTier(aNameOrType: string, bNameOrType: string): number {
  const a = normalizeTier(aNameOrType);
  const b = normalizeTier(bNameOrType);
  const ai = (PACKAGE_TIER_ORDER as readonly string[]).indexOf(a);
  const bi = (PACKAGE_TIER_ORDER as readonly string[]).indexOf(b);
  const aRank = ai === -1 ? Number.POSITIVE_INFINITY : ai;
  const bRank = bi === -1 ? Number.POSITIVE_INFINITY : bi;
  if (aRank !== bRank) return aRank - bRank;
  return a.localeCompare(b);
}

function formatPackageStatusLabel(status: string | null | undefined): string {
  const s = String(status ?? "").toLowerCase().trim();
  // Keep wording consistent with Admin Business Users table.
  if (s === "pending") return "Pending";
  if (s === "approved") return "Approved";
  if (s === "active") return "Active";
  if (s === "expired") return "Expired";
  if (s === "suspended" || s === "nonactive" || s === "blacklisted") return "Suspended";
  if (!s) return "—";
  // fallback for any legacy/custom status
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type BusinessStatus = "pending" | "approved" | "active" | "suspended" | "expired";

function mapDbAccountStatusToUi(status: unknown, paymentActive: boolean): BusinessStatus {
  // Match admin logic exactly.
  if (paymentActive) return "active";
  const s = String(status ?? "pending").toLowerCase().trim();
  if (s === "pending") return "pending";
  if (s === "approved") return "approved";
  if (s === "expired") return "expired";
  if (s === "nonactive" || s === "blacklisted" || s === "suspended") return "suspended";
  if (s === "active") return "active";
  return "pending";
}

function formatDMY(dateIso: string | null | undefined): string {
  if (!dateIso) return "";
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB");
}

export default function MyPackage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activePackage, setActivePackage] = useState<UserPackage | null>(null);
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [paymentActive, setPaymentActive] = useState<boolean>(false);
  const [availablePackages, setAvailablePackages] = useState<AvailablePackage[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOnsByPackageId, setAddOnsByPackageId] = useState<Record<string, PackageAddOnRow[]>>({});
  const [addOnSelectionsByAddOnId, setAddOnSelectionsByAddOnId] = useState<Record<string, number>>({});
  const [savingAddOnId, setSavingAddOnId] = useState<string | null>(null);

  const [durationRowsByPackageId, setDurationRowsByPackageId] = useState<Record<string, PackageDurationRow[]>>({});
  const [plansByPackageId, setPlansByPackageId] = useState<Record<string, SubscriptionPlanRow[]>>({});
  /** basePriceIdr from website_settings (order_subscription_plans) — synced with /packages page */
  const [basePriceByPackageId, setBasePriceByPackageId] = useState<Record<string, number>>({});
  /** Discounted monthly price per package — mirrors /packages headline logic */
  const [discountedMonthlyByPackageId, setDiscountedMonthlyByPackageId] = useState<Record<string, number>>({});
  const [savingDuration, setSavingDuration] = useState(false);

  /** Max duration discount per package — for "Diskon Hingga" display (synced with /packages) */
  const maxDiscountByPackageId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const [pid, rows] of Object.entries(durationRowsByPackageId)) {
      let maxDisc = 0;
      for (const r of rows) {
        const d = Number(r.discount_percent ?? 0);
        if (Number.isFinite(d) && d > maxDisc) maxDisc = d;
      }
      if (maxDisc > 0) map[pid] = maxDisc;
    }
    return map;
  }, [durationRowsByPackageId]);

  /** Headline discount percent per package — for starter it's from website_settings (1yr), for others it's max */
  const [headlineDiscountByPackageId, setHeadlineDiscountByPackageId] = useState<Record<string, number>>({});

  // Upgrade form: chosen duration per upgrade package card
  const [selectedUpgradeDurationByPackageId, setSelectedUpgradeDurationByPackageId] = useState<
    Record<string, number>
  >({});

  const fetchPackages = useCallback(async () => {
    if (!user) return;

      // Fetch user's account status (source of truth for the UI status badge)
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("account_status, payment_active")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        // Avoid showing an incorrect fallback status (e.g., Active) if profile fetch fails.
        console.warn("Failed to fetch profile status:", profileError);
        setAccountStatus(null);
        setPaymentActive(false);
      } else {
        setAccountStatus((profile as any)?.account_status ?? null);
        // IMPORTANT: avoid Boolean("false") === true if any policy/cast returns a string.
        setPaymentActive((profile as any)?.payment_active === true);
      }

      // Fetch user's active package
      const { data: userPkg } = await supabase
        .from("user_packages")
        .select(
          `
          id, package_id, status, started_at, activated_at, expires_at, duration_months,
          packages (name, type, description, features, price)
        `
        )
        .eq("user_id", user.id)
        // Show the latest package record even if not active yet.
        .in("status", ["pending", "approved", "active", "expired"])
        .order("created_at", { ascending: false })
        .maybeSingle();

      if (userPkg) {
        const pkgObj = Array.isArray((userPkg as any).packages)
          ? (userPkg as any).packages[0]
          : (userPkg as any).packages;

        const normalized: UserPackage = {
          ...(userPkg as any),
          packages: {
            ...(pkgObj as any),
            features: Array.isArray((pkgObj as any)?.features)
              ? (pkgObj as any).features
              : JSON.parse(((pkgObj as any)?.features as string) || "[]"),
          },
        } as UserPackage;

        setActivePackage(normalized);

        // Load duration rules for this package so Duration+Discount matches onboarding.
        const packageId = String((userPkg as any).package_id || "");
        if (packageId) {
          const { data: durationRows, error: durationError } = await (supabase as any)
            .from("package_durations")
            .select("id,package_id,duration_months,discount_percent,is_active,sort_order")
            .eq("package_id", packageId)
            .eq("is_active", true)
            .order("sort_order", { ascending: true })
            .order("duration_months", { ascending: true });

          if (durationError) {
            console.warn("Failed to load package durations:", durationError);
          }

          const mapped: PackageDurationRow[] = ((durationRows as any[]) || []).map((r) => ({
            id: String(r.id),
            package_id: String(r.package_id),
            duration_months: Number(r.duration_months ?? 1),
            discount_percent: Number(r.discount_percent ?? 0),
            is_active: Boolean(r.is_active ?? true),
            sort_order: Number(r.sort_order ?? 0),
          }));

          setDurationRowsByPackageId((prev) => ({ ...prev, [packageId]: mapped }));
        }
      }

      // Fetch all available packages
      const { data: allPkgs } = await supabase.from("packages").select("*").eq("is_active", true);

      if (allPkgs) {
        const mappedPkgs = (allPkgs as any[])
          .map((pkg) => ({
            ...(pkg as any),
            features: Array.isArray((pkg as any).features)
              ? (pkg as any).features
              : JSON.parse(((pkg as any).features as string) || "[]"),
          }))
          .sort((a, b) => sortByTier(a.type ?? a.name, b.type ?? b.name)) as AvailablePackage[];

        setAvailablePackages(mappedPkgs);

        // Load duration rules for ALL available packages (so Upgrade Options matches onboarding too)
        const pkgIds = mappedPkgs.map((p) => String(p.id)).filter(Boolean);
        const durationGrouped: Record<string, PackageDurationRow[]> = {};
        if (pkgIds.length > 0) {
          const { data: durationRows, error: durationError } = await (supabase as any)
            .from("package_durations")
            .select("id,package_id,duration_months,discount_percent,is_active,sort_order")
            .in("package_id", pkgIds)
            .eq("is_active", true)
            .order("sort_order", { ascending: true })
            .order("duration_months", { ascending: true });

          if (durationError) {
            console.warn("Failed to load package durations:", durationError);
          }

          ((durationRows as any[]) || []).forEach((r) => {
            const pid = String(r.package_id);
            if (!durationGrouped[pid]) durationGrouped[pid] = [];
            durationGrouped[pid].push({
              id: String(r.id),
              package_id: pid,
              duration_months: Number(r.duration_months ?? 1),
              discount_percent: Number(r.discount_percent ?? 0),
              is_active: Boolean(r.is_active ?? true),
              sort_order: Number(r.sort_order ?? 0),
            });
          });

          setDurationRowsByPackageId((prev) => ({ ...prev, ...durationGrouped }));
        }

        // Sync pricing directly from packages.price + package_durations (source of truth from duration-packages admin)
        // For starter/Website Only packages, fetch base_price_idr from website_settings (since packages.price stores the discounted price)
        const basePriceMap: Record<string, number> = {};
        const discountedMap: Record<string, number> = {};
        const headlineDiscMap: Record<string, number> = {};
        for (const pid of pkgIds) {
          const matchedPkg = mappedPkgs.find((p) => String(p.id) === pid);
          const pType = (matchedPkg?.type ?? "").trim().toLowerCase();
          const pName = (matchedPkg?.name ?? "").trim().toLowerCase();
          const isStarter = pType === "starter" || pName.includes("website");

          if (isStarter) {
            // For Website Only: fetch base_price_idr from website_settings (super admin duration-packages)
            try {
              const settingsKey = `order_subscription_plans:${pid}`;
              const { data: settingsRow } = await (supabase as any)
                .from("website_settings")
                .select("value")
                .eq("key", settingsKey)
                .maybeSingle();

              const plans = Array.isArray(settingsRow?.value) ? settingsRow.value : [];
              // Use 1-year plan for Website Only display
              const yearPlan = plans.find((p: any) => Number(p.years) === 1) ?? plans[0];
              if (yearPlan) {
                const basePrice = Number(yearPlan.base_price_idr ?? 0);
                const disc = Number(yearPlan.discount_percent ?? 0);
                if (basePrice > 0) {
                  basePriceMap[pid] = basePrice;
                  discountedMap[pid] = Math.max(0, basePrice * (1 - disc / 100));
                  headlineDiscMap[pid] = disc;
                  continue;
                }
              }
            } catch {
              // fallback below
            }
          }

          // For Growth/Pro: use packages.price as monthly base + max discount from durations
          const pkgPrice = Number(matchedPkg?.price ?? 0);
          if (pkgPrice > 0) {
            basePriceMap[pid] = pkgPrice;
            const durRows = durationGrouped[pid] ?? [];
            let maxDisc = 0;
            for (const dr of durRows) {
              const d = Number(dr.discount_percent ?? 0);
              if (Number.isFinite(d) && d > maxDisc) maxDisc = d;
            }
            discountedMap[pid] = maxDisc > 0 ? Math.max(0, pkgPrice * (1 - maxDisc / 100)) : pkgPrice;
            headlineDiscMap[pid] = maxDisc;
          }
        }
        setBasePriceByPackageId(basePriceMap);
        setDiscountedMonthlyByPackageId(discountedMap);
        setHeadlineDiscountByPackageId(headlineDiscMap);
      }

      // Fetch add-ons for the current package + upgrade packages (Onboarding add-ons)
      try {
        const currentPid = String((userPkg as any)?.package_id ?? "");
        const upgradePids = (allPkgs as any[] | null)
          ? (allPkgs as any[]).map((p) => String(p.id)).filter(Boolean)
          : [];

        const ids = Array.from(new Set([currentPid, ...upgradePids].filter(Boolean)));
        if (ids.length > 0) {
          const { data: addOnRows, error: addOnError } = await (supabase as any)
            .from("package_add_ons")
            .select("id,package_id,add_on_key,label,price_per_unit,unit_step,unit,is_active,sort_order,max_quantity")
            .in("package_id", ids)
            .eq("is_active", true)
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true });

          if (addOnError) {
            console.warn("Failed to load package add-ons:", addOnError);
          } else {
            const grouped: Record<string, PackageAddOnRow[]> = {};
            ((addOnRows as any[]) || []).forEach((r) => {
              const pid = String(r.package_id);
              if (!grouped[pid]) grouped[pid] = [];
              grouped[pid].push({
                id: String(r.id),
                add_on_key: String(r.add_on_key ?? ""),
                label: String(r.label ?? ""),
                price_per_unit: Number(r.price_per_unit ?? 0),
                unit_step: Number(r.unit_step ?? 1),
                unit: String(r.unit ?? "unit"),
                is_active: Boolean(r.is_active ?? true),
                sort_order: Number(r.sort_order ?? 0),
                max_quantity: r.max_quantity === null || r.max_quantity === undefined ? null : Number(r.max_quantity),
              });
            });

            setAddOnsByPackageId(grouped);
          }
        }
      } catch (e) {
        console.warn("Add-ons fetch failed:", e);
      }

      // Fetch user's onboarding add-on selections (so qty & state persists)
      try {
        const { data: selections, error: selError } = await (supabase as any)
          .from("onboarding_add_on_selections")
          .select("id,user_id,add_on_id,quantity")
          .eq("user_id", user.id);

        if (selError) {
          console.warn("Failed to load onboarding add-on selections:", selError);
        } else {
          const next: Record<string, number> = {};
          ((selections as AddOnSelectionRow[]) || []).forEach((s) => {
            next[String(s.add_on_id)] = Number(s.quantity ?? 0);
          });
          setAddOnSelectionsByAddOnId(next);
        }
      } catch (e) {
        console.warn("Selections fetch failed:", e);
      }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    void fetchPackages();
  }, [fetchPackages]);

  // Live update status/package when admin changes profiles/user_packages.
  useSupabaseRealtimeReload({
    channelName: `realtime:my-package:${user?.id ?? "anon"}`,
    targets: user?.id
      ? [
          { table: "profiles", filter: `id=eq.${user.id}` },
          { table: "user_packages", filter: `user_id=eq.${user.id}` },
        ]
      : [],
    onChange: fetchPackages,
  });

  const getMaxQty = (addOn: PackageAddOnRow) => {
    const max = addOn.max_quantity;
    if (max === null || max === undefined) return null;
    const n = Number(max);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const clampQty = (qty: number, addOn: PackageAddOnRow) => {
    const max = getMaxQty(addOn);
    if (max === null) return Math.max(0, qty);
    return Math.min(Math.max(0, qty), max);
  };

  const changeAddOnQty = (addOn: PackageAddOnRow, delta: number) => {
    const curr = Number(addOnSelectionsByAddOnId[String(addOn.id)] ?? 0);
    const step = Number(addOn.unit_step ?? 1);
    const next = clampQty(curr + delta * step, addOn);
    setAddOnSelectionsByAddOnId((prev) => ({
      ...prev,
      [String(addOn.id)]: next,
    }));
    void saveAddOnSelection(addOn, next);
  };

  const saveAddOnSelection = async (addOn: PackageAddOnRow, qty: number) => {
    if (!user) return;

    // Client-side validation
    const parsed = addOnQuantitySchema.safeParse(qty);
    if (!parsed.success) {
      toast.error("Invalid quantity");
      return;
    }

    const safeQty = clampQty(parsed.data, addOn);
    if (safeQty !== qty) {
      toast.message(`Quantity adjusted to ${safeQty} (max limit).`);
    }

    setSavingAddOnId(addOn.id);
    try {
      // Find existing selection for this add-on
      const { data: existing, error: existingErr } = await (supabase as any)
        .from("onboarding_add_on_selections")
        .select("id,quantity")
        .eq("user_id", user.id)
        .eq("add_on_id", addOn.id)
        .maybeSingle();

      if (existingErr) throw existingErr;

      if (!safeQty) {
        // qty=0 => delete
        if (existing?.id) {
          const { error: delErr } = await (supabase as any)
            .from("onboarding_add_on_selections")
            .delete()
            .eq("id", String(existing.id))
            .eq("user_id", user.id);
          if (delErr) throw delErr;
        }
        setAddOnSelectionsByAddOnId((prev) => {
          const next = { ...prev };
          delete next[String(addOn.id)];
          return next;
        });
        toast.success("Add-on removed");
        return;
      }

      if (existing?.id) {
        const { error: updErr } = await (supabase as any)
          .from("onboarding_add_on_selections")
          .update({ quantity: safeQty })
          .eq("id", String(existing.id))
          .eq("user_id", user.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await (supabase as any)
          .from("onboarding_add_on_selections")
          .insert({ user_id: user.id, add_on_id: addOn.id, quantity: safeQty });
        if (insErr) throw insErr;
      }

      setAddOnSelectionsByAddOnId((prev) => ({ ...prev, [String(addOn.id)]: safeQty }));
      toast.success("Add-on saved");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to save add-on");
    } finally {
      setSavingAddOnId(null);
    }
  };

  // Show other packages (excluding current) as Available Packages
  const upgradePackages = useMemo(() => {
    if (!activePackage) {
      return availablePackages;
    }
    const currentPkgId = String(activePackage.package_id ?? "");
    return availablePackages.filter((pkg) => String(pkg.id) !== currentPkgId);
  }, [activePackage, availablePackages]);

  // Initialize upgrade duration selection per package (default: first non-1-month option)
  useEffect(() => {
    if (!upgradePackages.length) return;
    setSelectedUpgradeDurationByPackageId((prev) => {
      const next = { ...prev };
      for (const pkg of upgradePackages) {
        const pid = String(pkg.id);
        if (next[pid]) continue;

        const opts = buildDurationOptionsFromDb(durationRowsByPackageId[pid]).filter((d) => d.months !== 1);
        if (opts.length > 0) next[pid] = opts[0].months;
      }
      return next;
    });
  }, [durationRowsByPackageId, upgradePackages]);

  // Source of truth: profiles.account_status + profiles.payment_active (same mapping as Admin page)
  const statusSource = mapDbAccountStatusToUi(accountStatus, paymentActive);
  const statusLabel = formatPackageStatusLabel(statusSource);
  const isActiveStatus = String(statusSource ?? "").toLowerCase().trim() === "active";
  const activatedAtLabel = isActiveStatus
    ? formatDMY(activePackage?.activated_at ?? activePackage?.started_at)
    : "";
  const expiresLabel = formatDMY(activePackage?.expires_at);

  const statusPrimaryLine = (() => {
    if (statusSource === "pending") return "Awaiting Approval";
    if (statusSource === "approved") return "Awaiting Payment";
    if (statusSource === "active") return activatedAtLabel ? `Active since ${activatedAtLabel}` : "Active";
    if (statusSource === "expired") return expiresLabel ? `Expired on ${expiresLabel}` : "Expired";
    return statusLabel;
  })();

  const statusSecondaryLine = (() => {
    // Only Active shows an Expires line (as requested)
    if (statusSource === "active" && expiresLabel) return `Expires on ${expiresLabel}`;
    return "";
  })();

  const isActiveExpiringWithinOneMonth = useMemo(() => {
    if (statusSource !== "active") return false;
    const iso = activePackage?.expires_at;
    if (!iso) return false;
    const expiresAt = new Date(iso);
    if (Number.isNaN(expiresAt.getTime())) return false;

    const now = Date.now();
    const diffMs = expiresAt.getTime() - now;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 30;
  }, [activePackage?.expires_at, statusSource]);

  const activePackageId = String(activePackage?.package_id ?? "");
  const durationOptions = useMemo(() => {
    if (!activePackageId) return [];
    return buildDurationOptionsFromDb(durationRowsByPackageId[activePackageId]);
  }, [activePackageId, durationRowsByPackageId]);

  const visibleDurationOptions = useMemo(
    () => durationOptions.filter((d) => d.months !== 1),
    [durationOptions]
  );

  const selectedDurationMonths = useMemo(() => {
    const m = Number(activePackage?.duration_months ?? 1);
    return Number.isFinite(m) && m > 0 ? m : 1;
  }, [activePackage?.duration_months]);

  // Do not show "1 Month" in UI at all.
  const currentDurationSelectValue = useMemo(() => {
    if (selectedDurationMonths !== 1) return String(selectedDurationMonths);
    // If DB value is still 1 month, show empty selection so user must pick a real duration.
    return "";
  }, [selectedDurationMonths]);

  const selectedDurationMeta = useMemo(() => {
    return durationOptions.find((d) => d.months === selectedDurationMonths) ?? {
      months: 1,
      label: formatDurationLabel(1),
      discountPercent: 0,
      isFromDb: false,
    };
  }, [durationOptions, selectedDurationMonths]);

  const currentAddOnsMonthly = useMemo(() => {
    if (!activePackageId) return 0;
    return (addOnsByPackageId[activePackageId] ?? []).reduce((sum, addOn) => {
      const qty = Number(addOnSelectionsByAddOnId[String(addOn.id)] ?? 0);
      return sum + qty * Number(addOn.price_per_unit ?? 0);
    }, 0);
  }, [activePackageId, addOnsByPackageId, addOnSelectionsByAddOnId]);

  /** Resolved monthly price: prefer basePriceIdr from website_settings, fallback to packages.price */
  const resolvedMonthlyPrice = useMemo(() => {
    if (!activePackageId) return 0;
    // Use discounted monthly price (synced with /packages headline), fallback to base, then packages.price
    return discountedMonthlyByPackageId[activePackageId] ?? basePriceByPackageId[activePackageId] ?? Number(activePackage?.packages.price || 0);
  }, [activePackageId, discountedMonthlyByPackageId, basePriceByPackageId, activePackage?.packages.price]);

  const currentMonthlyWithAddOns = useMemo(() => {
    return resolvedMonthlyPrice + currentAddOnsMonthly;
  }, [resolvedMonthlyPrice, currentAddOnsMonthly]);

  /** Get the plan-based IDR price for the current package's selected duration */
  const currentPlanPriceIdr = useMemo(() => {
    if (!activePackageId) return null;
    const plans = plansByPackageId[activePackageId] ?? [];
    const durationYears = selectedDurationMonths / 12;
    const match = plans.find((p) => Math.abs(p.years - durationYears) < 0.01);
    return match ? match.price_usd : null; // price_usd is actually IDR
  }, [activePackageId, plansByPackageId, selectedDurationMonths]);

  const handleChangeDuration = async (monthsStr: string) => {
    if (!user || !activePackage) return;
    const months = Number(monthsStr);
    if (!Number.isFinite(months) || months <= 0) {
      toast.error("Invalid duration selection.");
      return;
    }

    if (months === 1) {
      toast.error('The "1 Month" duration is not available.');
      return;
    }

    // Only allow selecting durations that exist in options (keeps it consistent with onboarding rules).
    const allowed = visibleDurationOptions.some((d) => d.months === months);
    if (!allowed) {
      toast.error("This duration is not available for your current package.");
      return;
    }

    setSavingDuration(true);
    try {
      const { error } = await supabase
        .from("user_packages")
        .update({ duration_months: months })
        .eq("id", activePackage.id)
        .eq("user_id", user.id);

      if (error) throw error;

      setActivePackage((prev) => (prev ? { ...prev, duration_months: months } : prev));
      toast.success("Duration updated successfully.");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Unable to update the duration.");
    } finally {
      setSavingDuration(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="shrink-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">My Package</h1>
        <p className="text-muted-foreground">View your active package and available upgrades</p>
      </div>

      {/* All 3 packages in a row on desktop */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {/* Current Package */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-primary uppercase tracking-wide">Current Package</h2>
          {activePackage ? (
            <Card className="border-primary/30 h-full">
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>{activePackage.packages.name}</CardTitle>
                      <CardDescription>
                        {statusSecondaryLine ? (
                          <span className="block">
                            {statusPrimaryLine}
                            <span className="block">{statusSecondaryLine}</span>
                          </span>
                        ) : (
                          statusPrimaryLine
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="default" className="bg-primary/10 text-primary self-start sm:self-auto">
                    {statusLabel}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 min-w-0">
                <p className="text-muted-foreground">{activePackage.packages.description}</p>

                <div className="space-y-2">
                  <p className="font-medium text-foreground">What’s included:</p>
                  {/* Mobile: show full list (page can scroll) */}
                  <ul className="space-y-2 lg:hidden">
                    {activePackage.packages.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2 min-w-0">
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                          <Check className="h-3 w-3 text-primary" />
                        </div>
                        <span className="text-sm text-foreground break-words whitespace-normal">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Desktop: show full list (no "+xx more…") */}
                  <ul className="hidden lg:block space-y-2">
                    {activePackage.packages.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2 min-w-0">
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                          <Check className="h-3 w-3 text-primary" />
                        </div>
                        <span className="text-sm text-foreground break-words whitespace-normal">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-3">
                  <p className="font-medium text-foreground">Add-ons</p>

                  {(addOnsByPackageId[activePackageId] ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No add-ons available for this package.</p>
                  ) : (
                    <ul className="space-y-2">
                      {(addOnsByPackageId[activePackageId] ?? []).map((addOn) => (
                        <li
                          key={addOn.id}
                          className="flex items-center justify-between gap-3 rounded-lg border bg-card/50 p-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground break-words whitespace-normal">
                              {addOn.label}
                            </p>
                            <p className="text-xs text-muted-foreground break-words whitespace-normal">
                              {addOn.unit_step} {addOn.unit} / month
                            </p>
                            <p className="text-xs text-muted-foreground break-words whitespace-normal">
                              +{formatIdr(addOn.price_per_unit)} for {addOn.unit_step} {addOn.unit}
                              {addOn.max_quantity ? ` • max ${addOn.max_quantity}` : ""}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="inline-flex items-center gap-1 rounded-lg border bg-background p-1">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                disabled={
                                  savingAddOnId === addOn.id ||
                                  Number(addOnSelectionsByAddOnId[String(addOn.id)] ?? 0) <= 0
                                }
                                onClick={() => changeAddOnQty(addOn, -1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center text-sm font-medium text-foreground">
                                {Number(addOnSelectionsByAddOnId[String(addOn.id)] ?? 0)}
                              </span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                disabled={
                                  savingAddOnId === addOn.id ||
                                  (getMaxQty(addOn) !== null &&
                                    Number(addOnSelectionsByAddOnId[String(addOn.id)] ?? 0) >= getMaxQty(addOn)!)
                                }
                                onClick={() => changeAddOnQty(addOn, 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="pt-2 space-y-4">
                  {(() => {
                    const pid = activePackageId;
                    const n = (activePackage.packages.name ?? "").trim().toLowerCase();
                    const t = (activePackage.packages.type ?? "").trim().toLowerCase();
                    const isMonthlyBase = n === "growth" || n === "pro" || t === "growth" || t === "pro";
                    const isGrowthOrPro = isMonthlyBase;

                    const base = basePriceByPackageId[pid] ?? Number(activePackage.packages.price ?? 0);
                    const discounted = discountedMonthlyByPackageId[pid];
                    const discountPercent = headlineDiscountByPackageId[pid] ?? maxDiscountByPackageId[pid] ?? 0;
                    const hasPlan = base > 0 && discountPercent > 0;

                    if (!hasPlan) {
                      return (
                        <p className="text-2xl font-bold text-foreground">
                          {formatIdr(resolvedMonthlyPrice)}
                          <span className="text-sm font-normal text-muted-foreground"> /bulan</span>
                        </p>
                      );
                    }

                    const normalDisplay = base;
                    const headlineDisplay = discounted ?? Math.max(0, base * (1 - discountPercent / 100));
                    const suffix = isMonthlyBase ? "/bulan" : "/ tahun";
                    const normalLabel = isMonthlyBase
                      ? `Harga Normal / Bulan: ${normalDisplay.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`
                      : `Harga Normal / tahun: Rp ${normalDisplay.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
                    const afterLabel = isMonthlyBase
                      ? "Harga setelah diskon / bulan"
                      : "Harga / tahun setelah diskon";

                    return (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-primary">
                            {isGrowthOrPro ? "Diskon Hingga" : "Diskon"}
                          </span>
                          <span className="text-2xl font-extrabold text-primary">{Math.round(discountPercent)}%</span>
                        </div>
                        <p className="text-xs text-muted-foreground line-through">{normalLabel}</p>
                        <p className="text-2xl font-bold text-foreground">
                          Rp {headlineDisplay.toLocaleString("id-ID", { maximumFractionDigits: 0 })}
                          <span className="ml-1 text-sm font-medium text-muted-foreground">{suffix}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{afterLabel}</p>
                      </div>
                    );
                  })()}

                    <div className="grid gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-muted-foreground">Duration:</span>
                        <div className="w-full sm:w-[220px]">
                          <Select
                            value={currentDurationSelectValue}
                            onValueChange={handleChangeDuration}
                            disabled={!activePackageId || savingDuration || visibleDurationOptions.length === 0}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select a duration" />
                            </SelectTrigger>
                            <SelectContent className="bg-popover z-50">
                              {visibleDurationOptions.map((opt) => (
                                <SelectItem key={opt.months} value={String(opt.months)}>
                                  {opt.label}
                                  {opt.discountPercent > 0 ? ` — ${opt.discountPercent}% off` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {selectedDurationMeta.discountPercent > 0 && (
                          <Badge variant="secondary" className="bg-primary/10 text-primary">
                            {selectedDurationMeta.discountPercent}% OFF
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground">
                        Total ({selectedDurationMeta.label}):{" "}
                        <span className="font-medium text-foreground">
                          {currentPlanPriceIdr != null ? formatIdr(currentPlanPriceIdr) : formatIdr(computeDiscountedTotal({ monthlyPrice: currentMonthlyWithAddOns, months: selectedDurationMeta.months, discountPercent: selectedDurationMeta.discountPercent }))}
                        </span>
                      </p>

                      {visibleDurationOptions.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          This package does not have any duration options beyond 1 month.
                        </p>
                      )}
                    </div>
                </div>

                {/* Action button (changes by status) */}
                {statusSource === "pending" ? (
                  <div className="pt-2">
                    <Button className="w-full" onClick={() => {
                      const t = normalizeTier(activePackage.packages.type ?? activePackage.packages.name);
                      if (t === "starter" || t.includes("website")) {
                        navigate("/order/choose-domain");
                      } else {
                        navigate("/order/select-plan");
                      }
                    }}>
                      Pay Now
                    </Button>
                  </div>
                ) : statusSource === "approved" ? (
                  <div className="pt-2">
                    <Button className="w-full" onClick={() => {
                      const t = normalizeTier(activePackage.packages.type ?? activePackage.packages.name);
                      if (t === "starter" || t.includes("website")) {
                        navigate("/order/choose-domain");
                      } else {
                        navigate("/order/select-plan");
                      }
                    }}>
                      Pay Now
                    </Button>
                  </div>
                ) : statusSource === "active" && isActiveExpiringWithinOneMonth ? (
                  <div className="pt-2">
                    <Button className="w-full" variant="outline" onClick={() => {
                      const t = normalizeTier(activePackage.packages.type ?? activePackage.packages.name);
                      if (t === "starter" || t.includes("website")) {
                        navigate("/order/choose-domain");
                      } else {
                        navigate("/order/select-plan");
                      }
                    }}>
                      Extend Duration
                    </Button>
                  </div>
                ) : statusSource === "expired" ? (
                  <div className="pt-2">
                    <Button className="w-full" variant="outline" onClick={() => {
                      const t = normalizeTier(activePackage.packages.type ?? activePackage.packages.name);
                      if (t === "starter" || t.includes("website")) {
                        navigate("/order/choose-domain");
                      } else {
                        navigate("/order/select-plan");
                      }
                    }}>
                      Renew Plan
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground">No active package</h3>
                <p className="text-muted-foreground">Choose a package to get started</p>
              </CardContent>
            </Card>
          )}
          </div>

          {/* Available Packages */}
          {upgradePackages.map((pkg) => {
                const isRecommended = false;

                const upgradeDurationOptions = buildDurationOptionsFromDb(
                  durationRowsByPackageId[String(pkg.id)]
                ).filter((d) => d.months !== 1);

                const selectedUpgradeMonths =
                  selectedUpgradeDurationByPackageId[String(pkg.id)] ?? upgradeDurationOptions[0]?.months ?? 0;

                const selectedUpgradeMeta =
                  upgradeDurationOptions.find((d) => d.months === selectedUpgradeMonths) ?? {
                    months: 0,
                    label: "",
                    discountPercent: 0,
                    isFromDb: false,
                  };

                const upgradeAddOnsMonthly = (addOnsByPackageId[String(pkg.id)] ?? []).reduce((sum, addOn) => {
                  const qty = Number(addOnSelectionsByAddOnId[String(addOn.id)] ?? 0);
                  return sum + qty * Number(addOn.price_per_unit ?? 0);
                }, 0);

                const upgradeMonthlyWithAddOns = (discountedMonthlyByPackageId[String(pkg.id)] ?? basePriceByPackageId[String(pkg.id)] ?? Number(pkg.price || 0)) + upgradeAddOnsMonthly;

                const discountedUpgradeTotal = computeDiscountedTotal({
                  monthlyPrice: upgradeMonthlyWithAddOns,
                  months: Number(selectedUpgradeMeta.months || 0),
                  discountPercent: Number(selectedUpgradeMeta.discountPercent || 0),
                });

                return (
                  <div key={pkg.id} className="space-y-2">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Available Package</h2>
                  <Card
                    key={pkg.id}
                    className={
                      "group relative isolate overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md " +
                      (isRecommended
                        ? "border-primary/50 ring-2 ring-primary/15 bg-gradient-to-br from-primary/10 via-background to-background"
                        : "hover:border-primary/30 bg-gradient-to-br from-muted/30 via-background to-background")
                    }
                  >
                    {/* subtle decorative glow */}
                    <div
                      aria-hidden="true"
                      className={
                        "pointer-events-none absolute -top-24 -right-24 -z-10 h-48 w-48 rounded-full blur-3xl opacity-0 transition-opacity group-hover:opacity-100 " +
                        (isRecommended ? "bg-primary/20" : "bg-muted")
                      }
                    />

                    <CardHeader className="space-y-3 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <CardTitle className="text-lg break-words whitespace-normal">{pkg.name}</CardTitle>
                            {isRecommended && (
                              <Badge className="bg-primary text-primary-foreground">
                                <Star className="h-3 w-3 mr-1" />
                                Best value
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="mt-1">{pkg.description}</CardDescription>
                        </div>

                {(() => {
                  const pid = String(pkg.id);
                  const n = (pkg.name ?? "").trim().toLowerCase();
                  const t = (pkg.type ?? "").trim().toLowerCase();
                  const isMonthlyBase = n === "growth" || n === "pro" || t === "growth" || t === "pro";
                  const isGrowthOrPro = isMonthlyBase;

                  const base = basePriceByPackageId[pid] ?? Number(pkg.price ?? 0);
                  const discounted = discountedMonthlyByPackageId[pid];
                  const discountPercent = headlineDiscountByPackageId[pid] ?? maxDiscountByPackageId[pid] ?? 0;
                  const hasPlan = base > 0 && discountPercent > 0;

                  if (!hasPlan) {
                    return (
                      <div className="text-right shrink-0">
                        <div className="font-bold text-foreground text-xl leading-none">{formatIdr(base)}</div>
                        <div className="text-xs text-muted-foreground">/bulan</div>
                      </div>
                    );
                  }

                  const normalDisplay = base;
                  const headlineDisplay = discounted ?? Math.max(0, base * (1 - discountPercent / 100));
                  const suffix = isMonthlyBase ? "/bulan" : "/ tahun";
                  const normalLabel = isMonthlyBase
                    ? `Harga Normal / Bulan: ${normalDisplay.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`
                    : `Harga Normal / tahun: Rp ${normalDisplay.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;

                  return (
                    <div className="w-full space-y-1.5 mt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-primary">
                          {isGrowthOrPro ? "Diskon Hingga" : "Diskon"}
                        </span>
                        <span className="text-2xl font-extrabold text-primary">{Math.round(discountPercent)}%</span>
                      </div>
                      <p className="text-xs text-muted-foreground line-through">{normalLabel}</p>
                      <p className="text-xl font-bold text-foreground">
                        Rp {headlineDisplay.toLocaleString("id-ID", { maximumFractionDigits: 0 })}
                        <span className="ml-1 text-sm font-medium text-muted-foreground">{suffix}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isMonthlyBase ? "Harga setelah diskon / bulan" : "Harga / tahun setelah diskon"}
                      </p>
                    </div>
                  );
                })()}
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4 min-w-0">
                      <div className="rounded-lg border bg-card/50 p-3">
                        <p className="text-sm font-medium text-foreground">What you’ll get</p>
                        {/* Mobile: full list */}
                        <ul className="mt-3 space-y-2 lg:hidden">
                          {pkg.features.map((feature, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground min-w-0">
                              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                                <Check className="h-3 w-3 text-primary" />
                              </div>
                              <span className="break-words whitespace-normal">{feature}</span>
                            </li>
                          ))}
                        </ul>

                        {/* Desktop: full list (no "+xx more…") */}
                        <ul className="hidden lg:block mt-3 space-y-2">
                          {pkg.features.map((feature, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground min-w-0">
                              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                                <Check className="h-3 w-3 text-primary" />
                              </div>
                              <span className="break-words whitespace-normal">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="rounded-lg border bg-card/50 p-3">
                        <p className="text-sm font-medium text-foreground">Add-ons</p>
                        {(addOnsByPackageId[String(pkg.id)] ?? []).length === 0 ? (
                          <p className="mt-2 text-sm text-muted-foreground">No add-ons available for this package.</p>
                        ) : (
                          <ul className="mt-3 space-y-2">
                            {(addOnsByPackageId[String(pkg.id)] ?? []).map((addOn) => (
                              <li
                                key={addOn.id}
                                className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3"
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-foreground break-words whitespace-normal">
                                    {addOn.label}
                                  </p>
                                  <p className="text-xs text-muted-foreground break-words whitespace-normal">
                                    {addOn.unit_step} {addOn.unit} / month
                                  </p>
                                  <p className="text-xs text-muted-foreground break-words whitespace-normal">
                                    +{formatIdr(addOn.price_per_unit)} for {addOn.unit_step} {addOn.unit}
                                    {addOn.max_quantity ? ` • max ${addOn.max_quantity}` : ""}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="inline-flex items-center gap-1 rounded-lg border bg-background p-1">
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-7 w-7"
                                      disabled={
                                        savingAddOnId === addOn.id ||
                                        Number(addOnSelectionsByAddOnId[String(addOn.id)] ?? 0) <= 0
                                      }
                                      onClick={() => changeAddOnQty(addOn, -1)}
                                    >
                                      <Minus className="h-3 w-3" />
                                    </Button>
                                    <span className="w-8 text-center text-sm font-medium text-foreground">
                                      {Number(addOnSelectionsByAddOnId[String(addOn.id)] ?? 0)}
                                    </span>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-7 w-7"
                                      disabled={
                                        savingAddOnId === addOn.id ||
                                        (getMaxQty(addOn) !== null &&
                                          Number(addOnSelectionsByAddOnId[String(addOn.id)] ?? 0) >=
                                            getMaxQty(addOn)!)
                                      }
                                      onClick={() => changeAddOnQty(addOn, 1)}
                                    >
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Duration (after Add-ons) */}
                      <div className="rounded-lg border bg-card/50 p-3 space-y-2">
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <span className="text-sm text-muted-foreground">Duration:</span>
                          <div className="w-full sm:w-[220px]">
                            <Select
                              value={selectedUpgradeMonths ? String(selectedUpgradeMonths) : ""}
                              onValueChange={(v) =>
                                setSelectedUpgradeDurationByPackageId((prev) => ({
                                  ...prev,
                                  [String(pkg.id)]: Number(v),
                                }))
                              }
                              disabled={upgradeDurationOptions.length === 0}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Select a duration" />
                              </SelectTrigger>
                              <SelectContent className="bg-popover z-50">
                                {upgradeDurationOptions.map((opt) => (
                                  <SelectItem key={opt.months} value={String(opt.months)}>
                                    {opt.label}
                                    {opt.discountPercent > 0 ? ` — ${opt.discountPercent}% off` : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {selectedUpgradeMeta.discountPercent > 0 && (
                            <Badge variant="secondary" className="bg-primary/10 text-primary">
                              {selectedUpgradeMeta.discountPercent}% OFF
                            </Badge>
                          )}
                        </div>

                        <p className="text-sm text-muted-foreground">
                          Total ({selectedUpgradeMeta.label || "—"}):{" "}
                          <span className="font-medium text-foreground">
                            {(() => {
                              if (!selectedUpgradeMeta.months) return "—";
                              const upgradePlans = plansByPackageId[String(pkg.id)] ?? [];
                              const durationYears = selectedUpgradeMeta.months / 12;
                              const match = upgradePlans.find((p) => Math.abs(p.years - durationYears) < 0.01);
                              return match ? formatIdr(match.price_usd) : formatIdr(discountedUpgradeTotal);
                            })()}
                          </span>
                        </p>

                        {upgradeDurationOptions.length === 0 && (
                          <p className="text-xs text-muted-foreground">
                            This package does not have any duration options (other than 1 month).
                          </p>
                        )}
                      </div>

                      <Button
                        variant={isRecommended ? "default" : "outline"}
                        className="w-full"
                        onClick={() => {
                          const pkgType = normalizeTier(pkg.type ?? pkg.name);
                          if (pkgType === "starter" || pkgType.includes("website")) {
                            navigate("/order/choose-domain");
                          } else {
                            navigate("/order/select-plan");
                          }
                        }}
                      >
                        Upgrade to {pkg.name}
                        <ArrowUpRight className="h-4 w-4 ml-2" />
                      </Button>

                      <p className="text-xs text-muted-foreground">
                        Upgrade anytime. Your team will be notified once payment is enabled.
                      </p>
                    </CardContent>
                  </Card>
                  </div>
                );
              })}
        </div>
      </div>

    </div>
  );
}
