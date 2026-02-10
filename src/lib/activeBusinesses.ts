import { supabase } from "@/integrations/supabase/client";

export type ActiveBusinessRow = {
  id: string;
  business_name: string | null;
  user_id: string;
  business_number?: number | null;
};

async function fetchActiveUserIds(): Promise<string[]> {
  // Single source of truth: profiles.account_status + profiles.payment_active (synced from user_packages)
  const { data, error } = await (supabase as any)
    .from("profiles")
    .select("id")
    .or("account_status.eq.active,payment_active.eq.true")
    .limit(1000);

  if (error) throw error;
  return ((data as any[]) ?? []).map((r) => r.id).filter(Boolean);
}

export async function fetchActiveBusinesses(options?: {
  select?: string;
  orderByBusinessName?: boolean;
}): Promise<ActiveBusinessRow[]> {
  const activeUserIds = await fetchActiveUserIds();
  if (activeUserIds.length === 0) return [];

  const select = options?.select ?? "id, business_name, user_id";

  let q = (supabase as any).from("businesses").select(select).in("user_id", activeUserIds);
  if (options?.orderByBusinessName !== false) {
    q = q.order("business_name", { ascending: true, nullsFirst: false });
  }

  const { data, error } = await q;
  if (error) throw error;
  return ((data as any[]) ?? []) as ActiveBusinessRow[];
}
