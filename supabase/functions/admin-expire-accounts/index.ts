// Supabase Edge Function: admin-expire-accounts
// Admin-only action to mark accounts as expired when their active package has passed expires_at.
//
// Rules:
// - Find user_packages where activated_at IS NOT NULL and expires_at < now()
// - For those users, set profiles.account_status='expired' and payment_active=false
// - Do not modify package rows here to avoid enum/status mismatch across environments

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json(500, { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return json(401, { error: "Unauthorized" });

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: requester, error: requesterErr } = await admin.auth.getUser(token);
    if (requesterErr || !requester?.user) return json(401, { error: "Unauthorized" });

    const { data: roleRows, error: roleErr } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", requester.user.id);
    if (roleErr) throw roleErr;

    const roles = (roleRows ?? []).map((r: any) => String(r.role));
    const isAllowed = roles.includes("admin") || roles.includes("super_admin");
    if (!isAllowed) return json(403, { error: "Forbidden" });

    const nowIso = new Date().toISOString();

    // Find packages that were activated but are already expired.
    const { data: expiredPkgs, error: pkErr } = await admin
      .from("user_packages")
      .select("id,user_id,expires_at")
      .not("activated_at", "is", null)
      .not("expires_at", "is", null)
      .lt("expires_at", nowIso)
      .limit(1000);
    if (pkErr) throw pkErr;

    const userIds = uniq(((expiredPkgs as any[]) ?? []).map((r) => String(r.user_id)).filter(Boolean));
    if (userIds.length === 0) {
      return json(200, { ok: true, updated_users: 0 });
    }

    // Mark only currently-active profiles as expired.
    const { error: updErr } = await admin
      .from("profiles")
      .update({ account_status: "expired", payment_active: false, updated_at: nowIso })
      .in("id", userIds)
      .eq("account_status", "active");
    if (updErr) throw updErr;

    return json(200, { ok: true, updated_users: userIds.length, user_ids: userIds });
  } catch (e) {
    console.error("admin-expire-accounts error:", e);
    return json(500, { error: e instanceof Error ? e.message : String(e) });
  }
});
