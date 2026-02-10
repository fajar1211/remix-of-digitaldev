import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export type BusinessTypeRow = {
  id: string;
  category: string;
  type: string;
  is_active: boolean;
  sort_order: number;
};

export type BusinessTypeCategory = {
  category: string;
  types: string[];
};

type Options = {
  /** When true, returns empty list if DB has no rows (no fallback). */
  noFallback?: boolean;
  fallback?: BusinessTypeCategory[];
};

export function useBusinessTypes(options?: Options) {
  const [rows, setRows] = useState<BusinessTypeRow[]>([]);
  const [categoryOrders, setCategoryOrders] = useState<Array<{ name: string; sort_order: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isOthers = (value: unknown) => String(value ?? "").trim().toLowerCase() === "others";
  const compareWithOthersLast = (a: unknown, b: unknown) => {
    const ao = isOthers(a);
    const bo = isOthers(b);
    if (ao && !bo) return 1;
    if (!ao && bo) return -1;
    return String(a ?? "").localeCompare(String(b ?? ""));
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [{ data: bt, error: btErr }, { data: cats, error: catsErr }] = await Promise.all([
          (supabase as any)
            .from("business_types")
            .select("id, category, type, is_active, sort_order")
            .eq("is_active", true)
            .order("category", { ascending: true })
            .order("sort_order", { ascending: true })
            .order("type", { ascending: true }),
          (supabase as any)
            .from("business_type_categories")
            .select("name, sort_order")
            .order("sort_order", { ascending: true })
            .order("name", { ascending: true }),
        ]);

        if (btErr) throw btErr;

        if (!cancelled) {
          setRows((bt ?? []) as BusinessTypeRow[]);
          // If categories table isn't readable in some contexts, ignore.
          if (!catsErr) setCategoryOrders((cats ?? []) as any);
        }
      } catch (e: any) {
        if (!cancelled) {
          setRows([]);
          setCategoryOrders([]);
          setError(e?.message ? String(e.message) : "Failed to load business types");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const categories: BusinessTypeCategory[] = useMemo(() => {
    const orderMap = new Map(categoryOrders.map((c) => [c.name, Number(c.sort_order ?? 0)]));

    const map = new Map<string, Array<{ type: string; sort_order: number }>>();
    for (const r of rows) {
      const cat = String(r.category ?? "").trim();
      const type = String(r.type ?? "").trim();
      if (!cat || !type) continue;
      const arr = map.get(cat) ?? [];
      arr.push({ type, sort_order: Number(r.sort_order ?? 0) });
      map.set(cat, arr);
    }

    const result = Array.from(map.entries()).map(([category, types]) => {
      const seen = new Set<string>();
      const unique = types.filter((t) => {
        if (seen.has(t.type)) return false;
        seen.add(t.type);
        return true;
      });

      unique.sort((a, b) => {
        const byOrder = a.sort_order - b.sort_order;
        if (byOrder !== 0) return byOrder;
        return compareWithOthersLast(a.type, b.type);
      });

      return {
        category,
        types: unique.map((t) => t.type),
      };
    });

    result.sort((a, b) => {
      const ao = isOthers(a.category);
      const bo = isOthers(b.category);
      if (ao && !bo) return 1;
      if (!ao && bo) return -1;
      const byOrder = (orderMap.get(a.category) ?? 0) - (orderMap.get(b.category) ?? 0);
      if (byOrder !== 0) return byOrder;
      return compareWithOthersLast(a.category, b.category);
    });

    if (result.length === 0 && !options?.noFallback) {
      return options?.fallback ?? [];
    }

    return result;
  }, [categoryOrders, options?.fallback, options?.noFallback, rows]);

  return { categories, loading, error, rows };
}
