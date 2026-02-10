import { useEffect, useMemo, useState } from 'react';
import { Award, Check, Crown, Minus, Plus, Star } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface AddOn {
  id: string;
  addOnKey?: string;
  label: string;
  pricePerUnit: number;
  unitStep: number;
  unit: string;
  maxQuantity?: number | null;
}

export interface DurationPlanMeta {
  years: number;
  basePriceIdr: number;
  discountPercent: number;
  manualOverride: boolean;
  overridePriceIdr: number | null;
  finalPriceIdr: number | null;
}

interface PackageCardProps {
  name: string;
  type: string;
  description: string;
  basePrice: number;
  features: string[];
  addOns?: AddOn[];
  isPopular?: boolean;
  isBestSeller?: boolean;
  isRecommended?: boolean;
  isVip?: boolean;
  isSelected?: boolean;
  isMonthlyBase?: boolean;
  durationPlan?: DurationPlanMeta | null;
  durationDiscountFallback?: number;
  hideAddOns?: boolean;
  hidePricing?: boolean;
  onSelect: (totalPrice: number, addOns: Record<string, number>) => void;
}

export default function PackageCard({
  name,
  type,
  description,
  basePrice,
  features,
  addOns = [],
  isPopular = false,
  isBestSeller = false,
  isRecommended = false,
  isVip = false,
  isSelected = false,
  isMonthlyBase = false,
  durationPlan = null,
  durationDiscountFallback = 0,
  hideAddOns = false,
  hidePricing = false,
  onSelect,
}: PackageCardProps) {
  const [selectedAddOns, setSelectedAddOns] = useState<Record<string, number>>({});

  const totalPrice = useMemo(() => {
    return addOns.reduce((sum, addOn) => {
      const quantity = selectedAddOns[addOn.id] || 0;
      return sum + quantity * addOn.pricePerUnit;
    }, basePrice);
  }, [addOns, basePrice, selectedAddOns]);

  useEffect(() => {
    if (!isSelected) return;
    onSelect(totalPrice, selectedAddOns);
  }, [isSelected, onSelect, selectedAddOns, totalPrice]);

  const handleAddOnChange = (addOnId: string, delta: number, unitStep: number, maxQuantity?: number | null) => {
    setSelectedAddOns((prev) => {
      const current = prev[addOnId] || 0;
      const rawNext = Math.max(0, current + delta * unitStep);
      const next =
        maxQuantity === null || maxQuantity === undefined
          ? rawNext
          : Math.min(Math.max(0, Number(maxQuantity)), rawNext);
      return { ...prev, [addOnId]: next };
    });
  };

  const n = name.trim().toLowerCase();
  const t = type.trim().toLowerCase();
  const isGrowth = n === 'growth' || t === 'growth';
  const isPro = n === 'pro' || t === 'pro';

  // Pricing display logic matching /packages
  const renderPricing = () => {
    const planMeta = durationPlan ?? (isMonthlyBase
      ? {
          years: isGrowth || isPro ? 3 : 1,
          basePriceIdr: basePrice,
          discountPercent: durationDiscountFallback,
          manualOverride: false,
          overridePriceIdr: null,
          finalPriceIdr: null,
        }
      : undefined);

    const baseFromPlan = Number(planMeta?.basePriceIdr ?? NaN);
    const baseFallback = basePrice;
    const base = Number.isFinite(baseFromPlan) && baseFromPlan > 0 ? baseFromPlan : baseFallback;
    const years = Math.max(1, Number(planMeta?.years ?? 1));
    const discountPercent = Number.isFinite(Number(planMeta?.discountPercent))
      ? Number(planMeta?.discountPercent)
      : durationDiscountFallback;

    const hasPlan = Boolean(planMeta) && base > 0;
    if (!hasPlan) {
      return (
        <span className="text-4xl font-bold text-foreground">
          Rp {Number(basePrice).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
        </span>
      );
    }

    const manualFinal = planMeta?.manualOverride ? (planMeta.overridePriceIdr ?? planMeta.finalPriceIdr) : null;
    const normalDisplay = isMonthlyBase ? Math.max(0, base) : Math.max(0, base * years);
    const discountedDisplay =
      typeof manualFinal === 'number' && Number.isFinite(manualFinal)
        ? Math.max(0, manualFinal)
        : isMonthlyBase
          ? Math.max(0, base * (1 - discountPercent / 100))
          : Math.max(0, normalDisplay * (1 - discountPercent / 100));

    const headlineDisplay = discountedDisplay;
    const suffix = isMonthlyBase ? '/bulan' : isGrowth && years === 3 ? '/ 3 tahun' : '/ tahun';
    const afterLabel = isMonthlyBase
      ? 'Harga setelah diskon / bulan'
      : isGrowth && years === 3
        ? 'Harga / 3 tahun setelah diskon'
        : 'Harga / tahun setelah diskon';
    const normalLabel = isMonthlyBase
      ? `Harga Normal / Bulan: ${normalDisplay.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`
      : `Harga Normal / tahun: Rp ${normalDisplay.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm font-semibold text-primary">
            {isGrowth || isPro ? 'Diskon Hingga' : 'Diskon'}
          </span>
          <span className="text-3xl md:text-4xl font-extrabold text-primary">{Math.round(discountPercent)}%</span>
        </div>
        <div className="text-sm text-muted-foreground line-through">{normalLabel}</div>
        <div className="text-4xl font-bold text-foreground">
          Rp {headlineDisplay.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
          <span className="ml-2 align-middle text-sm font-medium text-muted-foreground">{suffix}</span>
        </div>
        <div className="text-xs text-muted-foreground">{afterLabel}</div>
      </div>
    );
  };

  const hasBadges = isBestSeller || isRecommended || isVip || isPopular;

  return (
    <Card
      className={cn(
        'relative flex w-full max-w-sm flex-col shadow-soft cursor-pointer transition-all duration-300 will-change-transform',
        'sm:basis-[calc(50%-1rem)] lg:basis-[calc(33.333%-1.34rem)]',
        isSelected
          ? 'border-primary/50 bg-primary/5 -translate-y-0.5 shadow-lg ring-2 ring-primary'
          : 'hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/50',
      )}
      onClick={() => onSelect(totalPrice, selectedAddOns)}
    >
      {/* Top glow bar */}
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-1 rounded-t-lg',
          isSelected ? 'bg-primary' : 'bg-muted',
        )}
      />
      {/* Selected radial accent */}
      {isSelected && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,hsl(var(--primary)/0.18)_0%,transparent_60%)]"
        />
      )}
      {hasBadges && (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-4 pb-0">
          {isBestSeller && (
            <Badge variant="secondary" className="gap-1 px-3 py-1 shadow-sm">
              <Award className="h-3.5 w-3.5" />
              Terlaris
            </Badge>
          )}
          {(isRecommended || isPopular) && (
            <Badge variant="default" className="gap-1 px-3 py-1 shadow-sm">
              <Star className="h-3.5 w-3.5" />
              Rekomendasi
            </Badge>
          )}
          {isVip && (
            <Badge variant="outline" className="gap-1 px-3 py-1 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50">
              <Crown className="h-3.5 w-3.5" />
              VIP
            </Badge>
          )}
        </div>
      )}

      <CardHeader className="text-center pb-4">
        <CardDescription className="text-primary font-medium uppercase text-xs">{type}</CardDescription>
        <CardTitle className="text-xl">{name}</CardTitle>
        {!hidePricing && <div className="mt-4">{renderPricing()}</div>}
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        {description && <p className="text-sm text-muted-foreground text-center mb-6">{description}</p>}

        <ul className="space-y-3">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-3 text-sm">
              <Check className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
              <span className="text-foreground">{feature}</span>
            </li>
          ))}
        </ul>

        {!hideAddOns && addOns.length > 0 && (
          <div className="space-y-3 pt-4 border-t">
            <p className="text-sm font-medium text-muted-foreground">Optional Add-ons</p>
            {addOns.map((addOn) => (
              <div
                key={addOn.id}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex-1">
                  <p className="text-sm font-semibold">{addOn.addOnKey ?? addOn.id}</p>
                  <p className="text-xs text-muted-foreground">{addOn.label}</p>
                  <p className="text-xs text-muted-foreground">
                    +${addOn.pricePerUnit} for {addOn.unitStep} {addOn.unit}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleAddOnChange(addOn.id, -1, addOn.unitStep, addOn.maxQuantity)}
                    disabled={(selectedAddOns[addOn.id] || 0) === 0}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center text-sm font-medium">
                    {selectedAddOns[addOn.id] || 0}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleAddOnChange(addOn.id, 1, addOn.unitStep, addOn.maxQuantity)}
                    disabled={
                      addOn.maxQuantity !== null &&
                      addOn.maxQuantity !== undefined &&
                      (selectedAddOns[addOn.id] || 0) >= Number(addOn.maxQuantity)
                    }
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-6">
        <Button
          className="w-full"
          variant={isSelected ? 'default' : 'outline'}
        >
          {isSelected ? 'Selected' : 'Select This Package'}
        </Button>
      </CardFooter>
    </Card>
  );
}
