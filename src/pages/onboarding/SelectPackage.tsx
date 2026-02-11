import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import PackageCard, { type DurationPlanMeta } from '@/components/onboarding/PackageCard';

type DbAddOn = {
  id: string;
  addOnKey: string;
  label: string;
  pricePerUnit: number;
  unitStep: number;
  unit: string;
  maxQuantity?: number | null;
};

interface Package {
  id: string;
  name: string;
  type: string;
  description: string;
  price: number;
  features: string[];
  is_best_seller: boolean;
  is_recommended: boolean;
  is_vip: boolean;
}

export default function SelectPackage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<Record<string, number>>({});
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [businessStage, setBusinessStage] = useState<'new' | 'growing'>('new');
  const [dbAddOnsByPackageId, setDbAddOnsByPackageId] = useState<Record<string, DbAddOn[]>>({});
  const [durationPlanByPackageId, setDurationPlanByPackageId] = useState<Record<string, DurationPlanMeta>>({});
  const [durationDiscountByPackageId, setDurationDiscountByPackageId] = useState<Record<string, number>>({});
  /** Whether admin pre-assigned a package (read-only info) */
  const [adminAssignedPkgId, setAdminAssignedPkgId] = useState<string | null>(null);
  const [adminAssignedDuration, setAdminAssignedDuration] = useState<number | null>(null);

  useEffect(() => {
    const stage = (sessionStorage.getItem('onboarding_businessStage') as 'new' | 'growing') || 'new';
    setBusinessStage(stage);
  }, []);

  // Pre-fill package from admin-assigned user_packages (if any)
  useEffect(() => {
    if (!user) return;
    const prefill = async () => {
      const { data } = await (supabase as any)
        .from('user_packages')
        .select('package_id, duration_months')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const row = data[0];
        setAdminAssignedPkgId(row.package_id);
        setAdminAssignedDuration(row.duration_months ?? null);
        setSelectedPackage(row.package_id);
      }
    };
    void prefill();
  }, [user]);
  const fetchPackages = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .eq('is_active', true)
        .order('price');

      if (error) throw error;

      const mapped: Package[] = (data || []).map((pkg: any) => ({
        id: String(pkg.id),
        name: String(pkg.name),
        type: String(pkg.type),
        description: String(pkg.description ?? ''),
        price: Number(pkg.price ?? 0),
        features: Array.isArray(pkg.features) ? (pkg.features as string[]) : JSON.parse((pkg.features as string) || '[]'),
        is_best_seller: Boolean(pkg.is_best_seller),
        is_recommended: Boolean(pkg.is_recommended),
        is_vip: Boolean(pkg.is_vip),
      }));

      setPackages(mapped);

      const pkgIds = mapped.map((p) => String(p.id)).filter(Boolean);
      if (pkgIds.length > 0) {
        // Load add-ons
        const { data: addOnRows } = await (supabase as any)
          .from('package_add_ons')
          .select('id,package_id,add_on_key,label,price_per_unit,unit_step,unit,sort_order,max_quantity')
          .in('package_id', pkgIds)
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true });

        const grouped: Record<string, DbAddOn[]> = {};
        ((addOnRows as any[]) || []).forEach((r) => {
          const pid = String(r.package_id);
          if (!grouped[pid]) grouped[pid] = [];
          grouped[pid].push({
            id: String(r.id),
            addOnKey: String(r.add_on_key),
            label: String(r.label),
            pricePerUnit: Number(r.price_per_unit ?? 0),
            unitStep: Number(r.unit_step ?? 1),
            unit: String(r.unit ?? 'unit'),
            maxQuantity: r.max_quantity === null || r.max_quantity === undefined ? null : Number(r.max_quantity),
          });
        });
        setDbAddOnsByPackageId(grouped);

        // Load duration plan settings (same as /packages page)
        const pkgYearsWanted: Record<string, number> = {};
        for (const p of mapped) {
          const n = p.name.trim().toLowerCase();
          const t = p.type.trim().toLowerCase();
          const isMarketing3y = n === 'growth' || t === 'growth' || n === 'pro' || t === 'pro';
          pkgYearsWanted[p.id] = isMarketing3y ? 3 : 1;
        }

        const keys = pkgIds.map((id) => `order_subscription_plans:${id}`);
        const [settingsRes, legacyRes, durationsRes] = await Promise.all([
          (supabase as any).from('website_settings').select('key,value').in('key', keys),
          (supabase as any).from('website_settings').select('value').eq('key', 'order_subscription_plans').maybeSingle(),
          supabase
            .from('package_durations')
            .select('package_id,duration_months,discount_percent,is_active,sort_order')
            .in('package_id', pkgIds)
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
            .order('duration_months', { ascending: true }),
        ]);

        const parsePlanMeta = (value: unknown, yearsWanted: number): DurationPlanMeta | null => {
          const list = Array.isArray(value) ? (value as any[]) : [];
          const row = list.find((r) => Number(r?.years) === Number(yearsWanted));
          if (!row) return null;
          const baseN = Number(row?.base_price_idr);
          const discN = Number(row?.discount_percent);
          const manualOverride = typeof row?.manual_override === 'boolean' ? row.manual_override : false;
          const overrideN = row?.override_price_idr == null ? null : Number(row.override_price_idr);
          const finalRaw = row?.final_price_idr ?? row?.price_usd;
          const finalN = Number(finalRaw);
          if (!Number.isFinite(baseN)) return null;
          return {
            years: Number(yearsWanted),
            basePriceIdr: Math.max(0, baseN),
            discountPercent: Number.isFinite(discN) ? discN : 0,
            manualOverride,
            overridePriceIdr: Number.isFinite(overrideN) ? overrideN : null,
            finalPriceIdr: Number.isFinite(finalN) ? Math.max(0, finalN) : null,
          };
        };

        const legacyYear1 = parsePlanMeta(legacyRes?.data?.value, 1);

        const planMap: Record<string, DurationPlanMeta> = {};
        if (Array.isArray(settingsRes?.data)) {
          for (const r of settingsRes.data as any[]) {
            const key = String(r?.key ?? '');
            const pkgId = key.split(':')[1];
            if (!pkgId) continue;
            const yearsWanted = Number(pkgYearsWanted[pkgId] ?? 1);
            const meta = parsePlanMeta(r?.value, yearsWanted);
            if (meta) planMap[pkgId] = meta;
          }
        }
        if (legacyYear1) {
          for (const p of mapped) {
            const n = p.name.trim().toLowerCase();
            const t = p.type.trim().toLowerCase();
            const isMonthly = n === 'growth' || n === 'pro' || t === 'growth' || t === 'pro';
            if (!isMonthly && !planMap[p.id]) planMap[p.id] = legacyYear1;
          }
        }
        setDurationPlanByPackageId(planMap);

        // Durations fallback
        const discMap: Record<string, number> = {};
        if (Array.isArray(durationsRes?.data)) {
          for (const row of durationsRes.data as any[]) {
            const pid = String(row.package_id);
            const wantedMonths = Math.max(12, Number(pkgYearsWanted[pid] ?? 1) * 12);
            if (Number(row.duration_months) === wantedMonths && Number.isFinite(Number(row.discount_percent))) {
              discMap[pid] = Number(row.discount_percent);
            }
          }
        }
        setDurationDiscountByPackageId(discMap);
      }
    } catch (error) {
      console.error('Error fetching packages:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPackages();
  }, [fetchPackages]);

  const handlePackageSelect = (pkgId: string, price: number, addOns: Record<string, number>) => {
    // If admin assigned a package, don't allow changing
    if (adminAssignedPkgId && pkgId !== adminAssignedPkgId) return;
    setSelectedPackage(pkgId);
    setTotalPrice(price);
    setSelectedAddOns(addOns);
  };

  const handleContinue = async () => {
    if (!user || !selectedPackage) return;

    setIsSubmitting(true);
    try {
      const selectedEntries = Object.entries(selectedAddOns || {}).filter(([, qty]) => Number(qty) > 0);
      const selectedAddOnIds = selectedEntries.map(([addOnId]) => addOnId);

      if (selectedEntries.length > 0) {
        const { error: selUpsertErr } = await (supabase as any)
          .from('onboarding_add_on_selections')
          .upsert(
            selectedEntries.map(([addOnId, qty]) => ({
              user_id: user.id,
              add_on_id: addOnId,
              quantity: Number(qty) || 0,
            })),
            { onConflict: 'user_id,add_on_id' }
          );
        if (selUpsertErr) throw selUpsertErr;
      }

      if (selectedAddOnIds.length > 0) {
        const { error: selDelErr } = await (supabase as any)
          .from('onboarding_add_on_selections')
          .delete()
          .eq('user_id', user.id)
          .not('add_on_id', 'in', `(${selectedAddOnIds.join(',')})`);
        if (selDelErr) throw selDelErr;
      } else {
        const { error: selClearErr } = await (supabase as any)
          .from('onboarding_add_on_selections')
          .delete()
          .eq('user_id', user.id);
        if (selClearErr) throw selClearErr;
      }

      const { error: packageError } = await (supabase as any).from('user_packages').insert({
        user_id: user.id,
        package_id: selectedPackage,
        status: 'pending',
        duration_months: adminAssignedDuration ?? 1,
      });
      if (packageError) throw packageError;

      const { error: businessError } = await supabase
        .from('businesses')
        .update({ onboarding_completed: true })
        .eq('user_id', user.id);
      if (businessError) throw businessError;

      sessionStorage.removeItem('onboarding_firstName');
      sessionStorage.removeItem('onboarding_lastName');
      sessionStorage.removeItem('onboarding_businessStage');
      sessionStorage.removeItem('onboarding_businessName');
      sessionStorage.removeItem('onboarding_businessType');
      sessionStorage.removeItem('onboarding_country');
      sessionStorage.removeItem('onboarding_city');
      sessionStorage.removeItem('onboarding_phoneNumber');

      const packageName = packages.find((p) => p.id === selectedPackage)?.name;
      toast({
        title: 'Welcome aboard!',
        description: `Your ${packageName} package request is awaiting approval.`,
      });

      navigate('/dashboard/user');
    } catch (error: any) {
      console.error('Error in handleContinue:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to save package. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading packages...</div>
      </div>
    );
  }

  const isMonthlyBase = (pkg: Package) => {
    const n = pkg.name.trim().toLowerCase();
    const t = pkg.type.trim().toLowerCase();
    return n === 'growth' || n === 'pro' || t === 'growth' || t === 'pro';
  };

  // Sort: starter first, then growth, then pro
  const sortedPackages = [...packages].sort((a, b) => {
    const order = (p: Package) => {
      const n = p.name.trim().toLowerCase();
      const t = p.type.trim().toLowerCase();
      if (n === 'starter' || t === 'starter') return 0;
      if (n === 'growth' || t === 'growth') return 1;
      if (n === 'pro' || t === 'pro') return 2;
      return 3;
    };
    return order(a) - order(b);
  });

  const selectedPkgName = packages.find((p) => p.id === selectedPackage)?.name;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 px-4 py-12">
      <Button
        variant="ghost"
        onClick={() => navigate('/onboarding/online-presence')}
        className="absolute top-6 left-6 flex items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <div className="max-w-6xl mx-auto space-y-8 pt-8 animate-fade-in">
        {/* Progress indicator */}
        <div className="flex justify-center gap-2">
          <div className="h-2 w-8 rounded-full bg-primary" />
          <div className="h-2 w-8 rounded-full bg-primary" />
          <div className="h-2 w-8 rounded-full bg-primary" />
          <div className="h-2 w-8 rounded-full bg-primary" />
        </div>

        <div className="text-center space-y-2">
          <div className="text-sm font-medium text-primary mb-2">STEP 4</div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Choose Your Package</h1>
          <p className="text-muted-foreground">
            {businessStage === 'new'
              ? 'Select the plan that fits your new business needs'
              : 'Select the plan to grow your existing business'}
          </p>
        </div>

        {adminAssignedPkgId && (
          <div className="mx-auto max-w-2xl rounded-lg border border-primary/30 bg-primary/5 p-4 text-center text-sm text-foreground">
            <p className="font-medium">Paket telah ditentukan oleh admin</p>
            <p className="text-muted-foreground mt-1">
              Paket: <span className="font-medium text-foreground">{packages.find((p) => p.id === adminAssignedPkgId)?.name ?? '—'}</span>
              {adminAssignedDuration ? (
                <> · Durasi: <span className="font-medium text-foreground">{adminAssignedDuration >= 12 ? `${adminAssignedDuration / 12} Tahun` : `${adminAssignedDuration} Bulan`}</span></>
              ) : null}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Paket yang dipilih tidak dapat diubah.</p>
          </div>
        )}

        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap gap-8 justify-center">
            {sortedPackages.map((pkg) => {
              const isDisabled = !!adminAssignedPkgId && pkg.id !== adminAssignedPkgId;
              return (
                <div key={pkg.id} className={isDisabled ? "opacity-50 pointer-events-none" : ""}>
                  <PackageCard
                    name={pkg.name}
                    type={pkg.type}
                    description={pkg.description}
                    basePrice={pkg.price}
                    features={pkg.features}
                    addOns={[]}
                    isBestSeller={pkg.is_best_seller}
                    isRecommended={pkg.is_recommended}
                    isVip={pkg.is_vip}
                    isPopular={businessStage === 'new' ? pkg.type === 'growth' : pkg.type === 'scale'}
                    isSelected={selectedPackage === pkg.id}
                    isMonthlyBase={isMonthlyBase(pkg)}
                    durationPlan={durationPlanByPackageId[pkg.id] ?? null}
                    durationDiscountFallback={durationDiscountByPackageId[pkg.id] ?? 0}
                    hideAddOns
                    hidePricing
                    onSelect={(price) => handlePackageSelect(pkg.id, price, {})}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-center gap-4 pt-4">
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate('/packages')}
            className="px-8"
          >
            Buy Package
          </Button>
          <Button
            size="lg"
            onClick={handleContinue}
            disabled={isSubmitting || !selectedPackage}
            className="px-8"
          >
            {isSubmitting
              ? 'Setting up...'
              : selectedPkgName
                ? `Continue with ${selectedPkgName}`
                : 'Select a package to continue'}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
