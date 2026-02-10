// Supabase Edge Function: admin-set-payment-active
// Admin-only: toggle payment access for a business user.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  // Supabase JS adds x-supabase-client-platform; include it to avoid CORS 'Failed to fetch' in browsers.
  "Access-Control-Allow-Headers": "authorization, x-client-info, x-supabase-client-platform, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = {
  user_id: string;
  payment_active: boolean;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

    // Authorize requester: admin only
    const { data: roleRow, error: roleErr } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", requester.user.id)
      .maybeSingle();

    if (roleErr) throw roleErr;
    if (roleRow?.role !== "admin") return json(403, { error: "Forbidden" });

    const body = (await req.json()) as Payload;
    const userId = String(body.user_id ?? "").trim();
    const paymentActive = Boolean(body.payment_active);
    if (!userId) return json(400, { error: "user_id is required" });

    const { error: updateErr } = await admin
      .from("profiles")
      .update({ payment_active: paymentActive, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (updateErr) throw updateErr;

    return json(200, { ok: true, user_id: userId, payment_active: paymentActive });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return json(500, { error: message });
  }
});
