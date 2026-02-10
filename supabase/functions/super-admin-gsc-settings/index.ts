import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SETTINGS_KEY = "gsc_verification_token";

type Payload =
  | { action: "get" }
  | { action: "clear" }
  | {
      action: "set";
      token: string;
    };

function normalizeToken(input: unknown): string {
  const v = String(input ?? "").trim();
  if (!v) throw new Error("Verification token wajib diisi");
  if (!/^[A-Za-z0-9._-]{10,256}$/.test(v)) throw new Error("Format token tidak valid");
  return v;
}

function maskToken(token: string): string {
  const v = String(token ?? "").trim();
  if (!v) return "";
  const tail = v.slice(-4);
  const headLen = Math.min(4, v.length);
  const head = v.slice(0, headLen);
  const middleLen = Math.max(0, v.length - (head.length + tail.length));
  return `${head}${"*".repeat(middleLen)}${tail}`;
}

async function writeAuditLog(admin: any, params: { actorUserId: string; action: string; provider: string; metadata?: Record<string, unknown> }) {
  await admin.from("super_admin_audit_logs").insert({
    actor_user_id: params.actorUserId,
    action: params.action,
    provider: params.provider,
    metadata: params.metadata ?? {},
  });
}

async function requireSuperAdmin(admin: any, userId: string) {
  const { data: roleRow, error: roleErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (roleErr) return { ok: false as const, status: 500, error: roleErr.message };
  if ((roleRow as any)?.role !== "super_admin") return { ok: false as const, status: 403, error: "Forbidden" };
  return { ok: true as const, userId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authed = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsErr } = await authed.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const authz = await requireSuperAdmin(admin, String(claimsData.claims.sub));
    if (!authz.ok) {
      return new Response(JSON.stringify({ error: authz.error }), {
        status: authz.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Payload;

    if (body.action === "get") {
      const { data, error } = await admin.from("website_settings").select("value,updated_at").eq("key", SETTINGS_KEY).maybeSingle();
      if (error) throw error;

      const raw = data?.value;
      const tokenValue = typeof raw === "string" ? raw : null;
      return new Response(
        JSON.stringify({
          configured: Boolean(tokenValue),
          updated_at: data ? String((data as any).updated_at) : null,
          token_masked: tokenValue ? maskToken(tokenValue) : null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (body.action === "set") {
      const tokenValue = normalizeToken((body as any).token);
      const { error } = await admin.from("website_settings").upsert({ key: SETTINGS_KEY, value: tokenValue }, { onConflict: "key" });
      if (error) throw error;

      await writeAuditLog(admin, {
        actorUserId: String(claimsData.claims.sub),
        action: "set_setting",
        provider: "gsc",
        metadata: { key: SETTINGS_KEY, user_agent: req.headers.get("user-agent") },
      });

      return new Response(JSON.stringify({ ok: true, token_masked: maskToken(tokenValue) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "clear") {
      const { error } = await admin.from("website_settings").delete().eq("key", SETTINGS_KEY);
      if (error) throw error;

      await writeAuditLog(admin, {
        actorUserId: String(claimsData.claims.sub),
        action: "clear_setting",
        provider: "gsc",
        metadata: { key: SETTINGS_KEY, user_agent: req.headers.get("user-agent") },
      });

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
