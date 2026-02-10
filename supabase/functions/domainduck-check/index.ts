import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CheckRequest = {
  domain: string;
};

type DomainDuckAvailability = "true" | "false" | "premium" | "blocked";

function toError(e: unknown, fallbackMessage = "Unknown error"): Error {
  if (e instanceof Error) return e;
  // Supabase/PostgREST errors are often plain objects (not instanceof Error)
  if (e && typeof e === "object") {
    const anyE = e as any;
    const msg =
      typeof anyE?.message === "string"
        ? anyE.message
        : typeof anyE?.error_description === "string"
          ? anyE.error_description
          : fallbackMessage;
    const err = new Error(msg);
    // Attach useful fields for debugging (will be stringified in response)
    (err as any).code = anyE?.code;
    (err as any).details = anyE?.details;
    (err as any).hint = anyE?.hint;
    return err;
  }
  return new Error(typeof e === "string" ? e : fallbackMessage);
}

function errorToJson(e: unknown) {
  const err = toError(e);
  const anyErr = err as any;
  return {
    message: err.message,
    code: anyErr.code ?? null,
    details: anyErr.details ?? null,
    hint: anyErr.hint ?? null,
  };
}

function normalizeDomain(raw: string): string {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) return "";
  return v.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function coerceAvailability(input: unknown): DomainDuckAvailability {
  const v = String(input ?? "").trim().toLowerCase();
  if (v === "true" || v === "false" || v === "premium" || v === "blocked") return v;
  return "blocked";
}

async function getDomainDuckKey(admin: any): Promise<string | null> {
  const { data: row, error } = await admin
    .from("integration_secrets")
    .select("ciphertext,iv")
    .eq("provider", "domainduck")
    .eq("name", "api_key")
    .maybeSingle();
  if (error) throw toError(error, "Gagal mengambil DomainDuck key");
  if (!row) return null;

  const ciphertext = String((row as any).ciphertext ?? "");
  const iv = String((row as any).iv ?? "");
  if (!ciphertext || !iv) return null;
  if (iv !== "plain") {
    const err = new Error("DomainDuck key harus disimpan plaintext (iv='plain')");
    (err as any).status = 400;
    throw err;
  }
  return ciphertext;
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => null)) as CheckRequest | null;
    const domain = normalizeDomain(body?.domain ?? "");
    if (!domain) {
      return new Response(JSON.stringify({ error: "domain is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const apiKey = await getDomainDuckKey(admin);
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "DomainDuck key belum diset (domainduck/api_key)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enforce quota (250 calls per API key) and increment atomically
    const keyHash = await sha256Hex(apiKey);
     const { data: usageRows, error: usageErr } = await admin.rpc("increment_domainduck_usage", { p_key_hash: keyHash });
     if (usageErr) throw toError(usageErr, "Gagal update quota DomainDuck");
    const usage = Array.isArray(usageRows) ? usageRows[0] : usageRows;
    const exhausted = Boolean((usage as any)?.exhausted);
    if (exhausted) {
      return new Response(
        JSON.stringify({
          error: "Kuota DomainDuck habis",
          usage: { used: (usage as any)?.used_count ?? 250, limit: (usage as any)?.usage_limit ?? 250 },
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const url = new URL("https://v1.api.domainduck.io/api/get/");
    url.searchParams.set("domain", domain);
    url.searchParams.set("apikey", apiKey);

    const resp = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    const text = await resp.text();
    if (!resp.ok) {
      return new Response(
        JSON.stringify({
          error: `DomainDuck error (${resp.status})`,
          details: text,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const json = JSON.parse(text) as Record<string, unknown>;
    const availability = coerceAvailability(json?.availability);

    return new Response(JSON.stringify({ availability, usage: { used: (usage as any)?.used_count ?? null, limit: (usage as any)?.usage_limit ?? 250 } }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const status = (e as any)?.status && Number.isFinite((e as any).status) ? Number((e as any).status) : 500;
    return new Response(JSON.stringify({ error: errorToJson(e) }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
