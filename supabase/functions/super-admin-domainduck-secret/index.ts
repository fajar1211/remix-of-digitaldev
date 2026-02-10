// Supabase Edge Function: super-admin-domainduck-secret
// Stores DomainDuck API key in public.integration_secrets (plaintext, iv='plain').

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload =
  | { action: "get" }
  | { action: "reveal" }
  | { action: "clear" }
  | {
      action: "set";
      api_key: string;
    };

type Usage = {
  used: number;
  limit: number;
  exhausted: boolean;
};

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function maskKey(key: string): string {
  const v = String(key ?? "").trim();
  if (!v) return "";
  const tail = v.slice(-4);
  return `${"*".repeat(Math.max(0, v.length - 4))}${tail}`;
}

async function writeAuditLog(admin: any, params: { actorUserId: string; action: string; provider: string; metadata?: Record<string, unknown> }) {
  await admin.from("super_admin_audit_logs").insert({
    actor_user_id: params.actorUserId,
    action: params.action,
    provider: params.provider,
    metadata: params.metadata ?? {},
  });
}

async function getUsage(admin: any, keyHash: string): Promise<Usage> {
  const { data, error } = await admin
    .from("domainduck_api_usage")
    .select("used_count,usage_limit")
    .eq("key_hash", keyHash)
    .maybeSingle();
  if (error) throw error;

  const used = Number((data as any)?.used_count ?? 0);
  const limit = Number((data as any)?.usage_limit ?? 250);
  return { used, limit, exhausted: used >= limit };
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

    // Verify JWT using signing keys (verify_jwt=false)
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
      const { data, error } = await admin
        .from("integration_secrets")
        .select("updated_at,ciphertext,iv")
        .eq("provider", "domainduck")
        .eq("name", "api_key")
        .maybeSingle();
      if (error) throw error;

      let usage: Usage | null = null;
      if (data) {
        const iv = String((data as any)?.iv ?? "");
        const ciphertext = String((data as any)?.ciphertext ?? "");
        if (iv === "plain" && ciphertext) {
          const keyHash = await sha256Hex(ciphertext);
          usage = await getUsage(admin, keyHash);
        }
      }

      const apiKeyMasked =
        data && String((data as any)?.iv ?? "") === "plain" ? maskKey(String((data as any)?.ciphertext ?? "")) : null;

      return new Response(
        JSON.stringify({
          configured: Boolean(data),
          updated_at: data ? String((data as any).updated_at) : null,
          usage,
          api_key_masked: apiKeyMasked,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (body.action === "reveal") {
      const { data, error } = await admin
        .from("integration_secrets")
        .select("updated_at,ciphertext,iv")
        .eq("provider", "domainduck")
        .eq("name", "api_key")
        .maybeSingle();
      if (error) throw error;

      const iv = String((data as any)?.iv ?? "");
      const key = iv === "plain" ? String((data as any)?.ciphertext ?? "") : "";
      if (!key) {
        return new Response(JSON.stringify({ error: "API key belum diset" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await writeAuditLog(admin, {
        actorUserId: String(claimsData.claims.sub),
        action: "reveal_secret",
        provider: "domainduck",
        metadata: {
          name: "api_key",
          user_agent: req.headers.get("user-agent"),
        },
      });

      return new Response(
        JSON.stringify({
          api_key: key,
          api_key_masked: maskKey(key),
          updated_at: data ? String((data as any).updated_at) : null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (body.action === "set") {
      const apiKey = String((body as any).api_key ?? "").trim();
      if (!apiKey) {
        return new Response(JSON.stringify({ error: "api_key is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (/\s/.test(apiKey) || apiKey.length < 8) {
        return new Response(JSON.stringify({ error: "Invalid api_key format" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Read old key hash (to reset usage properly)
      const { data: oldRow } = await admin
        .from("integration_secrets")
        .select("ciphertext,iv")
        .eq("provider", "domainduck")
        .eq("name", "api_key")
        .maybeSingle();

      const oldCipher = String((oldRow as any)?.ciphertext ?? "");
      const oldIv = String((oldRow as any)?.iv ?? "");
      const oldHash = oldIv === "plain" && oldCipher ? await sha256Hex(oldCipher) : null;

      const { error } = await admin.from("integration_secrets").upsert(
        {
          provider: "domainduck",
          name: "api_key",
          ciphertext: apiKey,
          iv: "plain",
        },
        { onConflict: "provider,name" },
      );
      if (error) throw error;

      // Reset usage for new key (0/250). Remove old usage row if exists.
      const newHash = await sha256Hex(apiKey);
      if (oldHash && oldHash !== newHash) {
        await admin.from("domainduck_api_usage").delete().eq("key_hash", oldHash);
      }
      const { error: usageErr } = await admin.from("domainduck_api_usage").upsert(
        {
          key_hash: newHash,
          used_count: 0,
          usage_limit: 250,
        },
        { onConflict: "key_hash" },
      );
      if (usageErr) throw usageErr;

      const usage = await getUsage(admin, newHash);

      return new Response(JSON.stringify({ ok: true, usage }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "clear") {
      const { data: oldRow } = await admin
        .from("integration_secrets")
        .select("ciphertext,iv")
        .eq("provider", "domainduck")
        .eq("name", "api_key")
        .maybeSingle();

      const oldCipher = String((oldRow as any)?.ciphertext ?? "");
      const oldIv = String((oldRow as any)?.iv ?? "");
      const oldHash = oldIv === "plain" && oldCipher ? await sha256Hex(oldCipher) : null;

      const { error } = await admin.from("integration_secrets").delete().eq("provider", "domainduck").eq("name", "api_key");
      if (error) throw error;

      if (oldHash) {
        await admin.from("domainduck_api_usage").delete().eq("key_hash", oldHash);
      }

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
