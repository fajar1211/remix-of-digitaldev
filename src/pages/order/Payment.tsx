import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderLayout } from "@/components/order/OrderLayout";
import { OrderSummaryCard } from "@/components/order/OrderSummaryCard";
import { PaymentConfirmDialog } from "@/components/order/PaymentConfirmDialog";
import { XenditPaymentMethodCard } from "@/components/order/XenditPaymentMethodCard";
import { useOrder } from "@/contexts/OrderContext";
import { useOrderPublicSettings } from "@/hooks/useOrderPublicSettings";
import { useOrderAddOns } from "@/hooks/useOrderAddOns";
import { useSubscriptionAddOns } from "@/hooks/useSubscriptionAddOns";
import { validatePromoCode } from "@/hooks/useOrderPromoCode";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/hooks/useI18n";
import { supabase } from "@/integrations/supabase/client";
import { usePackageDurations } from "@/hooks/usePackageDurations";
import { computeDiscountedTotal } from "@/lib/packageDurations";

function isMonthlyPackageName(name: string | null) {
  const n = String(name ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  return n.includes("full digital marketing") || n.includes("blog + social media") || n.includes("blog+social media");
}
import { createXenditInvoice } from "@/lib/orderPayments";
import { saveOrderLead } from "@/lib/saveOrderLead";

function formatIdr(value: number) {
  return `Rp ${Math.round(value).toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
}

export default function Payment() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { toast } = useToast();
  const { state, setPromoCode, setAppliedPromo } = useOrder();
  const { pricing, subscriptionPlans } = useOrderPublicSettings(state.domain, state.selectedPackageId);

  const effectivePackageId = state.selectedPackageId ?? pricing.defaultPackageId ?? null;

  const { rows: durationRows } = usePackageDurations(effectivePackageId);
  const { total: packageAddOnsTotal } = useOrderAddOns({ packageId: effectivePackageId, quantities: state.addOns ?? {} });
  const { total: subscriptionAddOnsTotal } = useSubscriptionAddOns({ selected: state.subscriptionAddOns ?? {}, packageId: effectivePackageId });
  const addOnsTotal = packageAddOnsTotal + subscriptionAddOnsTotal;

  const [gatewayLoading, setGatewayLoading] = useState(true);
  const [gateway, setGateway] = useState<"xendit" | null>(null);

  const [promo, setPromo] = useState(state.promoCode);
  const [paying, setPaying] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    (async () => {
      setGatewayLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke<{
          ok: boolean;
          provider: "xendit" | null;
          providers?: { xendit: boolean };
          reason?: string;
        }>(
          "order-payment-provider",
          { body: {} },
        );
        if (error) throw error;
        const provider = (data as any)?.provider ?? null;
        if (provider === "xendit") {
          setGateway("xendit");
        } else {
          setGateway(null);
        }
      } catch {
        setGateway(null);
      } finally {
        setGatewayLoading(false);
      }
    })();
  }, [navigate]);

  const discountByMonths = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of durationRows || []) {
      if (r?.is_active === false) continue;
      const months = Number((r as any).duration_months ?? 0);
      const discount = Number((r as any).discount_percent ?? 0);
      if (Number.isFinite(months) && months > 0) m.set(months, discount);
    }
    return m;
  }, [durationRows]);

  const isMonthly = isMonthlyPackageName(state.selectedPackageName);
  const addOnsMultiplier = isMonthly && state.subscriptionYears ? Number(state.subscriptionYears) * 12 : 1;
  const effectiveAddOnsTotal = addOnsTotal * addOnsMultiplier;

  const durationPriceIdr = useMemo(() => {
    if (!state.subscriptionYears) return null;

    if (isMonthly) {
      const monthlyBase = Number(pricing.packagePriceUsd ?? 0);
      if (!Number.isFinite(monthlyBase) || monthlyBase <= 0) return null;
      const months = Number(state.subscriptionYears) * 12;
      const discountPercent = discountByMonths.get(months) ?? 0;
      return computeDiscountedTotal({ monthlyPrice: monthlyBase, months, discountPercent });
    }

    const selectedPlan = (subscriptionPlans || []).find((p: any) => Number(p?.years) === Number(state.subscriptionYears));
    const v = Number((selectedPlan as any)?.price_usd ?? 0);
    return Number.isFinite(v) && v > 0 ? v : null;
  }, [discountByMonths, isMonthly, pricing.packagePriceUsd, state.subscriptionYears, subscriptionPlans]);

  const baseTotalUsd = useMemo(() => {
    if (!state.subscriptionYears) return null;
    if (durationPriceIdr == null) return null;
    return durationPriceIdr + effectiveAddOnsTotal;
  }, [durationPriceIdr, effectiveAddOnsTotal, state.subscriptionYears]);

  const totalAfterPromoUsd = useMemo(() => {
    if (baseTotalUsd == null) return null;
    const d = state.appliedPromo?.discountUsd ?? 0;
    const discount = Number.isFinite(d) && d > 0 ? d : 0;
    return Math.max(0, baseTotalUsd - discount);
  }, [baseTotalUsd, state.appliedPromo?.discountUsd]);

  const totalAfterPromoIdr = useMemo(() => {
    if (totalAfterPromoUsd == null) return null;
    return Math.max(0, Math.round(totalAfterPromoUsd));
  }, [totalAfterPromoUsd]);

  useEffect(() => {
    const code = promo.trim();
    if (code !== state.promoCode) setPromoCode(code);

    if (!code || baseTotalUsd == null) {
      setAppliedPromo(null);
      return;
    }

    const t = window.setTimeout(async () => {
      const res = await validatePromoCode(code, baseTotalUsd);
      if (!res.ok) {
        setAppliedPromo(null);
        return;
      }
      setAppliedPromo({
        id: res.promo.id,
        code: res.promo.code,
        promoName: res.promo.promo_name,
        discountUsd: res.discountUsd,
      });
    }, 450);

    return () => window.clearTimeout(t);
  }, [baseTotalUsd, promo, setAppliedPromo, setPromoCode, state.promoCode]);

  const canComplete = useMemo(() => {
    const email = String(state.details.email ?? "").trim();
    return Boolean(
      state.domain &&
        state.selectedTemplateId &&
        effectivePackageId &&
        state.subscriptionYears &&
        email &&
        state.details.acceptedTerms,
    );
  }, [effectivePackageId, state.details.acceptedTerms, state.details.email, state.domain, state.selectedTemplateId, state.subscriptionYears]);

  const logOrderAudit = async () => {
    try {
      const sessionRes = await supabase.auth.getSession();
      const userId = sessionRes.data.session?.user?.id ?? "anonymous";
      const nameParts = (state.details.name ?? "").trim().split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      await (supabase as any).from("super_admin_audit_logs").insert({
        actor_user_id: userId,
        provider: "order",
        action: "order_website_pay",
        metadata: {
          first_name: firstName,
          last_name: lastName,
          email: state.details.email,
          phone: state.details.phone,
          business_name: state.details.businessName || null,
          province: state.details.provinceName,
          city: state.details.city,
          domain: state.domain,
          template_id: state.selectedTemplateId,
          template_name: state.selectedTemplateName,
          package_id: state.selectedPackageId,
          package_name: state.selectedPackageName,
          subscription_years: state.subscriptionYears,
          add_ons: state.addOns,
          subscription_add_ons: state.subscriptionAddOns,
          promo_code: state.promoCode,
          amount_idr: totalAfterPromoIdr,
        },
      });
    } catch (e) {
      console.error("Audit log failed:", e);
    }
  };

  const startXenditInvoice = async () => {
    if (totalAfterPromoIdr == null) {
      toast({ variant: "destructive", title: t("order.totalNotAvailableTitle") });
      return;
    }

    setPaying(true);
    try {
      await logOrderAudit();
      await saveOrderLead(state, "website", totalAfterPromoIdr);

      const res = await createXenditInvoice({
        amount_idr: totalAfterPromoIdr,
        subscription_years: state.subscriptionYears ?? 0,
        promo_code: state.promoCode,
        domain: state.domain,
        selected_template_id: state.selectedTemplateId ?? "",
        selected_template_name: state.selectedTemplateName ?? "",
        customer_name: state.details.name,
        customer_email: state.details.email,
      });

      if (res.orderDbId) setLastOrderId(res.orderDbId);
      window.location.href = res.invoiceUrl;
    } catch (e: any) {
      toast({ variant: "destructive", title: t("order.paymentFailedTitle"), description: e?.message ?? t("order.tryAgain") });
    } finally {
      setPaying(false);
      setConfirmOpen(false);
    }
  };

  if (gatewayLoading) {
    return (
      <OrderLayout title={t("order.step.payment")} step="payment" sidebar={<OrderSummaryCard />}>
        <div className="text-sm text-muted-foreground">{t("order.loadingPayment")}</div>
      </OrderLayout>
    );
  }

  return (
    <OrderLayout title={t("order.step.payment")} step="payment" sidebar={<OrderSummaryCard />}>
      <div className="space-y-6">
        {gateway == null ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("order.gatewayInactiveTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">{t("order.gatewayInactiveBody")}</p>
            </CardContent>
          </Card>
        ) : null}

        <XenditPaymentMethodCard
          title={t("order.paymentMethod")}
          promo={promo}
          onPromoChange={setPromo}
          applyingDisabled={paying}
          onApplyPromo={async () => {
            const code = promo.trim();
            setPromoCode(code);
            if (!code) {
              setAppliedPromo(null);
              toast({ title: t("order.promoCleared") });
              return;
            }
            if (baseTotalUsd == null) {
              setAppliedPromo(null);
              toast({ variant: "destructive", title: t("order.unableApplyPromo"), description: t("order.totalNotAvailableYet") });
              return;
            }

            const res = await validatePromoCode(code, baseTotalUsd);
            if (!res.ok) {
              setAppliedPromo(null);
              toast({ variant: "destructive", title: t("order.invalidPromo"), description: t("order.promoNotFound") });
              return;
            }

            setAppliedPromo({
              id: res.promo.id,
              code: res.promo.code,
              promoName: res.promo.promo_name,
              discountUsd: res.discountUsd,
            });
            toast({ title: t("order.promoApplied"), description: `${res.promo.promo_name} (-$${res.discountUsd.toFixed(2)})` });
          }}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("order.finalReview")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-lg border p-4">
              <p className="font-medium text-foreground">{t("order.priceBreakdown")}</p>
              <dl className="mt-3 grid gap-2">
                {state.subscriptionYears ? (
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">Durasi</dt>
                    <dd className="font-medium text-foreground">{state.subscriptionYears} tahun</dd>
                  </div>
                ) : null}
                {state.appliedPromo ? (
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">Promo ({state.appliedPromo.code})</dt>
                    <dd className="font-medium text-primary">-{formatIdr(state.appliedPromo.discountUsd)}</dd>
                  </div>
                ) : null}
              </dl>
              <div className="mt-4 pt-3 border-t">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-base font-bold text-foreground">Total</span>
                  <span className="text-xl font-bold text-foreground">
                    {totalAfterPromoIdr == null ? "—" : formatIdr(totalAfterPromoIdr)}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-muted-foreground">{t("order.reviewNote")}</p>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="outline" onClick={() => navigate("/order/subscription")}>
            {t("common.back")}
          </Button>
          <PaymentConfirmDialog
            open={confirmOpen}
            onOpenChange={(o) => {
              if (paying) return;
              setConfirmOpen(o);
            }}
            confirming={paying}
            disabled={paying}
            amountUsdFormatted={totalAfterPromoIdr == null ? "—" : formatIdr(totalAfterPromoIdr)}
            triggerText={t("order.payWithXendit")}
            confirmText={t("order.confirmContinue")}
            note={t("order.redirectXendit")}
            onConfirm={async () => {
              if (!canComplete) {
                toast({ variant: "destructive", title: t("order.completeOrderTitle"), description: t("order.completeOrderBody") });
                setConfirmOpen(false);
                return;
              }
              return await startXenditInvoice();
            }}
          />
        </div>
      </div>
    </OrderLayout>
  );
}
