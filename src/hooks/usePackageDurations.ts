import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { PackageDurationRow } from "@/lib/packageDurations";

export function usePackageDurations(packageId?: string | null) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<PackageDurationRow[]>([]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!packageId) {
        setRows([]);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await (supabase as any)
          .from("package_durations")
          .select("id,package_id,duration_months,discount_percent,is_active,sort_order")
          .eq("package_id", packageId)
          .order("sort_order", { ascending: true })
          .order("duration_months", { ascending: true });

        if (error) throw error;
        if (!mounted) return;
        setRows(((data as any[]) ?? []) as PackageDurationRow[]);
      } catch {
        if (mounted) setRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [packageId]);

  return { loading, rows };
}
