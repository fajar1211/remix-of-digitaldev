import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SETTINGS_KEY = "sitemap_settings";
const SITEMAP_FN = "sitemap-xml";
const SITEMAP_FN_URL = "https://supiwygxypfqjzoqmlaq.functions.supabase.co";

type Settings = {
  base_url: string;
  include_static_pages: boolean;
  include_blog_posts: boolean;
  custom_paths: string[];
};

type Payload =
  | { action: "get" }
  | { action: "clear" }
  | {
      action: "set";
      settings: Settings;
    };

function normalizeBaseUrl(input: unknown): string {
  const v = String(input ?? "").trim();
  if (!v) throw new Error("Base URL wajib diisi");
  if (!/^https?:\/\//i.test(v)) throw new Error("Base URL harus diawali http:// atau https://");
  return v.replace(/\/+$/, "");
}

function normalizeCustomPaths(input: unknown): string[] {
  const arr = Array.isArray(input) ? input : [];
  const out: string[] = [];
  for (const raw of arr) {
    const v = String(raw ?? "").trim();
    if (!v) continue;
    if (!v.startsWith("/")) throw new Error(`Custom path harus diawali "/": ${v}`);
    if (v.length > 200) throw new Error(`Custom path terlalu panjang: ${v.slice(0, 40)}...`);
    if (/\s/.test(v)) throw new Error(`Custom path tidak boleh mengandung spasi: ${v}`);
    out.push(v);
  }
  if (out.length > 200) throw new Error("Terlalu banyak custom paths (maks 200)");
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
          configured: Boolean(settings?.base_url),
          updated_at: data ? String((data as any).updated_at) : null,
          settings: settings
            ? {
                base_url: String(settings.base_url ?? ""),
                include_static_pages: Boolean(settings.include_static_pages ?? true),
                include_blog_posts: Boolean(settings.include_blog_posts ?? true),
                custom_paths: Array.isArray(settings.custom_paths) ? settings.custom_paths.map((p: any) => String(p)) : [],
              }
            : null,
          sitemap_url: `${SITEMAP_FN_URL}/${SITEMAP_FN}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (body.action === "set") {
      const incoming = (body as any).settings ?? {};
      const settings: Settings = {
        base_url: normalizeBaseUrl(incoming.base_url),
        include_static_pages: Boolean(incoming.include_static_pages),
        include_blog_posts: Boolean(incoming.include_blog_posts),
        custom_paths: normalizeCustomPaths(incoming.custom_paths),
      };

      const { error } = await admin.from("website_settings").upsert({ key: SETTINGS_KEY, value: settings }, { onConflict: "key" });
      if (error) throw error;

      await writeAuditLog(admin, {
        actorUserId: String(claimsData.claims.sub),
        action: "set_setting",
        provider: "sitemap",
        metadata: { key: SETTINGS_KEY, user_agent: req.headers.get("user-agent") },
      });

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "clear") {
      const { error } = await admin.from("website_settings").delete().eq("key", SETTINGS_KEY);
      if (error) throw error;

      await writeAuditLog(admin, {
        actorUserId: String(claimsData.claims.sub),
        action: "clear_setting",
        provider: "sitemap",
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
