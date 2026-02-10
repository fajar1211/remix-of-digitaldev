import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SETTINGS_KEY = "schema_settings";

type Settings = {
  enabled: boolean;
  business_name: string;
  website_url: string;
  logo_url: string | null;
  same_as: string[];
  site_name: string;
};

type Payload =
  | { action: "get" }
  | { action: "clear" }
  | {
      action: "set";
      settings: Settings;
    };

function normalizeName(input: unknown, label: string) {
  const v = String(input ?? "").trim();
  if (!v) throw new Error(`${label} wajib diisi`);
  if (v.length > 200) throw new Error(`${label} terlalu panjang (maks 200 karakter)`);
  return v;
}

function normalizeUrl(input: unknown, label: string, required: boolean) {
  const v = String(input ?? "").trim();
  if (!v) {
    if (required) throw new Error(`${label} wajib diisi`);
    return null;
  }
  if (!/^https?:\/\//i.test(v)) throw new Error(`${label} harus diawali http:// atau https://`);
  if (v.length > 800) throw new Error(`${label} terlalu panjang`);
  return v;
}

function normalizeSameAs(input: unknown): string[] {
  const arr = Array.isArray(input) ? input : [];
  const out: string[] = [];
  for (const raw of arr) {
    const v = String(raw ?? "").trim();
    if (!v) continue;
    if (!/^https?:\/\//i.test(v)) throw new Error(`SameAs harus berupa http(s) URL: ${v}`);
    if (v.length > 800) throw new Error("SameAs URL terlalu panjang");
    out.push(v);
  }
  if (out.length > 50) throw new Error("SameAs terlalu banyak (maks 50)");
  return Array.from(new Set(out));
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
  const { data: roleRow, error: roleErr } = await admin.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
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

      const raw = (data as any)?.value;
      const settings = raw && typeof raw === "object" ? (raw as any) : null;

      return new Response(
        JSON.stringify({
          configured: Boolean(settings?.enabled),
          updated_at: data ? String((data as any).updated_at) : null,
          settings: settings
            ? {
                enabled: Boolean(settings.enabled ?? true),
                business_name: String(settings.business_name ?? ""),
                website_url: String(settings.website_url ?? ""),
                logo_url: settings.logo_url ? String(settings.logo_url) : null,
                same_as: Array.isArray(settings.same_as) ? settings.same_as.map((u: any) => String(u)) : [],
                site_name: String(settings.site_name ?? ""),
              }
            : null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (body.action === "set") {
      const incoming = (body as any).settings ?? {};

      const businessName = normalizeName(incoming.business_name, "Business Name");
      const websiteUrl = normalizeUrl(incoming.website_url, "Website URL", true) as string;
      const logoUrl = normalizeUrl(incoming.logo_url, "Logo URL", false);
      const sameAs = normalizeSameAs(incoming.same_as);
      const siteName = String(incoming.site_name ?? "").trim() || businessName;

      const settings: Settings = {
        enabled: Boolean(incoming.enabled ?? true),
        business_name: businessName,
        website_url: websiteUrl,
        logo_url: logoUrl,
        same_as: sameAs,
        site_name: normalizeName(siteName, "Site Name"),
      };

      const { error } = await admin.from("website_settings").upsert({ key: SETTINGS_KEY, value: settings }, { onConflict: "key" });
      if (error) throw error;

      await writeAuditLog(admin, {
        actorUserId: String(claimsData.claims.sub),
        action: "set_setting",
        provider: "schema",
        metadata: { key: SETTINGS_KEY, user_agent: req.headers.get("user-agent") },
      });

      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (body.action === "clear") {
      const { error } = await admin.from("website_settings").delete().eq("key", SETTINGS_KEY);
      if (error) throw error;

      await writeAuditLog(admin, {
        actorUserId: String(claimsData.claims.sub),
        action: "clear_setting",
        provider: "schema",
        metadata: { key: SETTINGS_KEY, user_agent: req.headers.get("user-agent") },
      });

      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
