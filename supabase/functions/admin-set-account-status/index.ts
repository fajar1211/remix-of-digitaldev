// Supabase Edge Function: admin-set-account-status
// Admin-only action to update profiles.account_status for a user.
// Intended for managing Business User onboarding states (pending/approved/active/etc.).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  // Supabase JS adds x-supabase-client-platform; include it to avoid CORS 'Failed to fetch' in browsers.
  "Access-Control-Allow-Headers": "authorization, x-client-info, x-supabase-client-platform, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AllowedStatus = "pending" | "approved" | "active" | "suspended" | "expired";

type Payload = {
  user_id: string;
  account_status: AllowedStatus;
};

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const m = Number(months || 0);
  if (!Number.isFinite(m) || m <= 0) return d;
  d.setMonth(d.getMonth() + m);
  return d;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeStatus(v: unknown): AllowedStatus | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "pending") return "pending";
  if (s === "approved") return "approved";
  if (s === "active") return "active";
  if (s === "suspended") return "suspended";
  if (s === "expired") return "expired";
  return null;
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

    const body = (await req.json()) as Payload;
    const userId = String(body?.user_id ?? "").trim();
    const nextStatus = normalizeStatus(body?.account_status);

    if (!userId) return json(400, { error: "user_id is required" });
    if (!nextStatus) return json(400, { error: "account_status is invalid" });

    const { error } = await admin.from("profiles").update({ account_status: nextStatus }).eq("id", userId);
    if (error) throw error;

    // Keep user_packages workflow in sync with account_status so the user dashboard can show:
    // pending -> Awaiting Approval
    // approved -> Awaiting Payment
    // active -> Active since + Expires on
    //
    // IMPORTANT BUSINESS RULE:
    // - We only set activation timestamps + calculate expiry when the account moves to ACTIVE.
    // - APPROVED should NOT start the subscription clock.
    if (nextStatus === "approved" || nextStatus === "active") {
      const { data: latestPkg, error: pkgErr } = await admin
        .from("user_packages")
        .select("id,status,duration_months,started_at,activated_at")
        .eq("user_id", userId)
        .in("status", ["pending", "approved", "active"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (pkgErr) throw pkgErr;

      if (latestPkg?.id) {
        const currentStatus = String((latestPkg as any).status ?? "").toLowerCase().trim();

        if (nextStatus === "approved") {
          // Move pending -> approved (do not touch dates)
          if (currentStatus === "pending") {
            const { error: upErr } = await admin
              .from("user_packages")
              .update({ status: "approved" })
              .eq("id", (latestPkg as any).id);
            if (upErr) throw upErr;
          }
        }

        if (nextStatus === "active") {
          // Activate latest request (pending/approved) and set activation+expiry based on duration.
          // Expiry is counted from the moment we activate (Approved -> Active).
          if (currentStatus !== "active") {
            const now = new Date();

            // If we ever re-activate a package (e.g., suspended -> active later),
            // we keep historical activation timestamps if already present.
            const activatedAt = (latestPkg as any).activated_at ? new Date(String((latestPkg as any).activated_at)) : now;
            const startedAt = (latestPkg as any).started_at ? new Date(String((latestPkg as any).started_at)) : activatedAt;

            const months = Math.max(1, Number((latestPkg as any).duration_months ?? 1));
            const expiresAt = addMonths(activatedAt, months);

            const updatePayload: Record<string, unknown> = {
              status: "active",
              // Only set these fields if they're missing, to preserve historical values.
              activated_at: (latestPkg as any).activated_at ? undefined : activatedAt.toISOString(),
              started_at: (latestPkg as any).started_at ? undefined : startedAt.toISOString(),
              expires_at: expiresAt.toISOString(),
            };

            // Remove undefined keys so PostgREST doesn't complain.
            Object.keys(updatePayload).forEach((k) => updatePayload[k] === undefined && delete updatePayload[k]);

            const { error: upErr } = await admin.from("user_packages").update(updatePayload).eq("id", (latestPkg as any).id);
            if (upErr) throw upErr;
          }
        }
      }
    }

    return json(200, { ok: true, user_id: userId, account_status: nextStatus });
  } catch (e) {
    console.error("admin-set-account-status error:", e);
    return json(500, { error: e instanceof Error ? e.message : String(e) });
  }
});
