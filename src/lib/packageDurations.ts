export type PackageDurationRow = {
  id: string;
  package_id: string;
  duration_months: number;
  discount_percent: number;
  is_active: boolean;
  sort_order: number;
};

export type DurationOption = {
  months: number;
  label: string;
  discountPercent: number;
  isFromDb: boolean;
};

export function formatDurationLabel(months: number): string {
  if (months === 1) return "1 Month";
  if (months === 6) return "6 Months";
  if (months === 12) return "1 Year";
  if (months === 24) return "2 Years";
  if (months === 36) return "3 Years";
  if (months % 12 === 0) return `${months / 12} Years`;
  return `${months} Months`;
}

export function buildDurationOptionsFromDb(rows: PackageDurationRow[] | undefined | null): DurationOption[] {
  const active = (rows || []).filter((r) => r.is_active);
  const sorted = [...active].sort((a, b) => {
    const sa = Number(a.sort_order ?? 0);
    const sb = Number(b.sort_order ?? 0);
    if (sa !== sb) return sa - sb;
    return a.duration_months - b.duration_months;
  });

  // Always include 1 month option so onboarding can require a duration even if DB has none.
  const base: DurationOption[] = [
    { months: 1, label: formatDurationLabel(1), discountPercent: 0, isFromDb: false },
  ];

  const fromDb: DurationOption[] = sorted.map((r) => ({
    months: Number(r.duration_months),
    label: formatDurationLabel(Number(r.duration_months)),
    discountPercent: Number(r.discount_percent ?? 0),
    isFromDb: true,
  }));

  // Avoid duplicates if DB contains 1 month.
  const merged = [...base];
  for (const opt of fromDb) {
    if (!merged.some((m) => m.months === opt.months)) merged.push(opt);
  }

  merged.sort((a, b) => a.months - b.months);
  return merged;
}

export function computeDiscountedTotal(params: {
  monthlyPrice: number;
  months: number;
  discountPercent: number;
}): number {
  const monthly = Number(params.monthlyPrice || 0);
  const months = Number(params.months || 1);
  const discount = Math.min(100, Math.max(0, Number(params.discountPercent || 0)));
  const total = monthly * months;
  return Math.round(total * (1 - discount / 100));
}

export const DEFAULT_DURATION_PRESETS: Array<{ months: number; discountPercent: number; sortOrder: number }>= [
  { months: 6, discountPercent: 5, sortOrder: 10 },
  { months: 12, discountPercent: 10, sortOrder: 20 },
  { months: 24, discountPercent: 15, sortOrder: 30 },
  { months: 36, discountPercent: 20, sortOrder: 40 },
];
