import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { BusinessTypeRow, CategoryGroup, CategoryOrderRow } from "./types";
import { compareWithOthersLast, isOthers } from "./sort";

// Note: react-hook-form + zod defaults can produce a type where fields are optional.
// We still rely on Zod validation in the form layer to ensure required fields.
type CreateOrEditPayload = {
  category?: string;
  type?: string;
  sort_order?: number;
  is_active?: boolean;
};

export function useBusinessTypesAdmin() {
  const { toast } = useToast();
  const [rows, setRows] = useState<BusinessTypeRow[]>([]);
  const [categoryOrders, setCategoryOrders] = useState<CategoryOrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);

      const [{ data: typesData, error: typesErr }, { data: catsData, error: catsErr }] = await Promise.all([
        (supabase as any)
          .from("business_types")
          .select("id, category, type, is_active, sort_order, created_at")
          .order("category", { ascending: true })
          .order("sort_order", { ascending: true })
          .order("type", { ascending: true }),
        (supabase as any)
          .from("business_type_categories")
          .select("name, sort_order, is_active")
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
      ]);

      if (typesErr) throw typesErr;
      if (catsErr) throw catsErr;

      const typeRows = ((typesData ?? []) as BusinessTypeRow[]).map((r) => ({
        ...r,
        sort_order: r.sort_order ?? 0,
      }));

      // Ensure category rows exist in business_type_categories
      const uniqueCategories = Array.from(new Set(typeRows.map((r) => r.category)));
      const existing = new Set(((catsData ?? []) as CategoryOrderRow[]).map((c) => c.name));
      const missing = uniqueCategories.filter((c) => !existing.has(c));

      if (missing.length > 0) {
        const maxSort = Math.max(
          -1,
          ...((catsData ?? []) as CategoryOrderRow[]).map((c) => Number(c.sort_order ?? 0)),
        );

        const payload = missing.map((name, i) => ({
          name,
          sort_order: isOthers(name) ? 999999 : maxSort + 1 + i,
          is_active: true,
        }));

        const { error: upsertErr } = await (supabase as any)
          .from("business_type_categories")
          .upsert(payload, { onConflict: "name" });
        if (upsertErr) throw upsertErr;

        // Re-fetch categories to include inserted ones
        const { data: cats2, error: cats2Err } = await (supabase as any)
          .from("business_type_categories")
          .select("name, sort_order, is_active")
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true });
        if (cats2Err) throw cats2Err;
        setCategoryOrders((cats2 ?? []) as CategoryOrderRow[]);
      } else {
        setCategoryOrders((catsData ?? []) as CategoryOrderRow[]);
      }

      setRows(typeRows);
    } catch (e: any) {
      console.error("fetch business types admin failed:", e);
      setRows([]);
      setCategoryOrders([]);
      toast({
        variant: "destructive",
        title: "Failed to load",
        description: e?.message ? String(e.message) : "Could not load Business Types.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const categoryCount = useMemo(() => new Set(rows.map((r) => r.category)).size, [rows]);

  const grouped = useMemo<CategoryGroup[]>(() => {
    const orderMap = new Map(categoryOrders.map((c) => [c.name, Number(c.sort_order ?? 0)]));
    const map = new Map<string, BusinessTypeRow[]>();

    for (const r of rows) {
      const arr = map.get(r.category) ?? [];
      arr.push(r);
      map.set(r.category, arr);
    }

    const groups = Array.from(map.entries()).map(([category, types]) => {
      const copy = [...types];
      copy.sort((a, b) => {
        // order first, then keep Others type at bottom
        const byOrder = (a.sort_order ?? 0) - (b.sort_order ?? 0);
        if (byOrder !== 0) return byOrder;
        return compareWithOthersLast(a.type, b.type, "asc");
      });

      return {
        category,
        sort_order: orderMap.get(category) ?? (isOthers(category) ? 999999 : 0),
        types: copy,
      };
    });

    groups.sort((a, b) => {
      // primary: category sort order, secondary: name (with Others last)
      const ao = isOthers(a.category);
      const bo = isOthers(b.category);
      if (ao && !bo) return 1;
      if (!ao && bo) return -1;
      const byOrder = (a.sort_order ?? 0) - (b.sort_order ?? 0);
      if (byOrder !== 0) return byOrder;
      return compareWithOthersLast(a.category, b.category, "asc");
    });

    return groups;
  }, [categoryOrders, rows]);

  const createType = useCallback(
    async (values: CreateOrEditPayload) => {
      try {
        const payload = {
          category: String(values.category ?? "").trim(),
          type: String(values.type ?? "").trim(),
          sort_order: Number(values.sort_order ?? 0),
          is_active: Boolean(values.is_active ?? true),
        };

        const { error } = await (supabase as any).from("business_types").insert(payload);
        if (error) throw error;

        toast({ title: "Saved", description: "Business Type created." });
        await fetchAll();
      } catch (e: any) {
        toast({
          variant: "destructive",
          title: "Create failed",
          description: e?.message ? String(e.message) : "Could not create Business Type.",
        });
        throw e;
      }
    },
    [fetchAll, toast],
  );

  const updateType = useCallback(
    async (id: string, values: CreateOrEditPayload) => {
      try {
        const payload = {
          category: String(values.category ?? "").trim(),
          type: String(values.type ?? "").trim(),
          sort_order: Number(values.sort_order ?? 0),
          is_active: Boolean(values.is_active ?? true),
        };

        const { error } = await (supabase as any).from("business_types").update(payload).eq("id", id);
        if (error) throw error;

        toast({ title: "Saved", description: "Business Type updated." });
        await fetchAll();
      } catch (e: any) {
        toast({
          variant: "destructive",
          title: "Update failed",
          description: e?.message ? String(e.message) : "Could not update Business Type.",
        });
        throw e;
      }
    },
    [fetchAll, toast],
  );

  const toggleActive = useCallback(
    async (id: string, next: boolean) => {
      try {
        const { error } = await (supabase as any).from("business_types").update({ is_active: next }).eq("id", id);
        if (error) throw error;
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, is_active: next } : r)));
      } catch (e: any) {
        toast({
          variant: "destructive",
          title: "Update failed",
          description: e?.message ? String(e.message) : "Could not update status.",
        });
      }
    },
    [toast],
  );

  const removeType = useCallback(
    async (id: string) => {
      try {
        const { error } = await (supabase as any).from("business_types").delete().eq("id", id);
        if (error) throw error;
        setRows((prev) => prev.filter((r) => r.id !== id));
        toast({ title: "Deleted", description: "Business Type deleted." });
      } catch (e: any) {
        toast({
          variant: "destructive",
          title: "Delete failed",
          description: e?.message ? String(e.message) : "Could not delete Business Type.",
        });
      }
    },
    [toast],
  );

  const moveType = useCallback(
    async (category: string, typeId: string, dir: "up" | "down") => {
      const group = grouped.find((g) => g.category === category);
      if (!group) return;

      const types = group.types;
      const idx = types.findIndex((t) => t.id === typeId);
      if (idx < 0) return;

      // Don't move Others type and don't move anything past Others
      if (isOthers(types[idx]?.type)) return;
      if (dir === "down" && isOthers(types[idx + 1]?.type)) return;

      const swapWith = dir === "up" ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= types.length) return;
      if (isOthers(types[swapWith]?.type)) return;

      try {
        // Reindex within category so reorder works even if sort_order values are equal.
        const next = [...types];
        const tmp = next[idx];
        next[idx] = next[swapWith];
        next[swapWith] = tmp;

        const updates = next.map((t, i) => ({
          id: t.id,
          sort_order: isOthers(t.type) ? 999999 : i * 10,
        }));

        // Use UPDATE (not UPSERT) to avoid accidental inserts with missing NOT NULL columns.
        const results = await Promise.all(
          updates.map((u) => (supabase as any).from("business_types").update({ sort_order: u.sort_order }).eq("id", u.id)),
        );
        const firstErr = results.find((r: any) => r?.error)?.error;
        if (firstErr) throw firstErr;

        const nextMap = new Map(updates.map((u) => [u.id, u.sort_order]));
        setRows((prev) => prev.map((r) => (nextMap.has(r.id) ? { ...r, sort_order: nextMap.get(r.id)! } : r)));
      } catch (e: any) {
        toast({
          variant: "destructive",
          title: "Reorder failed",
          description: e?.message ? String(e.message) : "Could not reorder type.",
        });
      }
    },
    [grouped, toast],
  );

  const moveCategory = useCallback(
    async (category: string, dir: "up" | "down") => {
      if (isOthers(category)) return;

      // Only reorder among non-Others categories
      const movable = grouped.filter((g) => !isOthers(g.category));
      const idx = movable.findIndex((g) => g.category === category);
      if (idx < 0) return;

      const swapWith = dir === "up" ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= movable.length) return;

      try {
        const next = [...movable];
        const tmp = next[idx];
        next[idx] = next[swapWith];
        next[swapWith] = tmp;

        const updates = next.map((g, i) => ({ name: g.category, sort_order: i * 10 }));

        const results = await Promise.all(
          updates.map((u) =>
            (supabase as any)
              .from("business_type_categories")
              .update({ sort_order: u.sort_order })
              .eq("name", u.name),
          ),
        );
        const firstErr = results.find((r: any) => r?.error)?.error;
        if (firstErr) throw firstErr;

        // Keep Others always last
        const merged = new Map<string, number>(updates.map((u) => [u.name, u.sort_order]));
        setCategoryOrders((prev) =>
          prev.map((c) =>
            c.name === "Others" || isOthers(c.name)
              ? { ...c, sort_order: 999999 }
              : merged.has(c.name)
                ? { ...c, sort_order: merged.get(c.name)! }
                : c,
          ),
        );
      } catch (e: any) {
        toast({
          variant: "destructive",
          title: "Reorder failed",
          description: e?.message ? String(e.message) : "Could not reorder category.",
        });
      }
    },
    [grouped, toast],
  );

  return {
    loading,
    rows,
    grouped,
    categoryCount,
    createType,
    updateType,
    toggleActive,
    removeType,
    moveType,
    moveCategory,
    refetch: fetchAll,
  };
}
