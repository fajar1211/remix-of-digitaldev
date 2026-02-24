// Supabase Edge Function: whoapi-check
// Checks domain availability via WhoAPI (whois.registered: 'no' => available, 'yes' => unavailable).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CheckRequest = {
  domain: string;
};

function normalizeDomain(raw: string) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .replace(/\s+/g, "");
}

async function getWhoapiApiKey(admin: any): Promise<string | null> {
  const { data, error } = await admin
    .from("integration_secrets")
    .select("ciphertext")
    .eq("provider", "whoapi")
    .eq("name", "api_key")
    .maybeSingle();
  if (error) throw error;
  return data ? String((data as any).ciphertext ?? "").trim() || null : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const apiKey = await getWhoapiApiKey(admin);
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "WhoAPI API key not configured" }), {
        status: 412,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as CheckRequest;
    const domain = normalizeDomain(body?.domain);
    if (!domain || !domain.includes(".")) {
      return new Response(JSON.stringify({ error: "domain is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authToken = /^token=/i.test(apiKey) ? apiKey : `TOKEN=${apiKey}`;

    const url = new URL("https://whoisjson.com/api/v1/domain-availability");
    url.searchParams.set("domain", domain);

    const resp = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: authToken,
      },
    });
    const json = await resp.json().catch(() => null);

    if (!resp.ok) {
      const msgFromBody =
        (json && ((json as any).error || (json as any).message || (json as any).detail)) ||
        `WhoisJSON request failed (${resp.status})`;
      const normalizedError =
        resp.status === 401 || resp.status === 403
          ? "Invalid WhoisJSON token. Please check token di Integrations lalu simpan ulang."
          : String(msgFromBody);

      return new Response(JSON.stringify({ error: normalizedError, raw: json }), {
        status: resp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const availableRaw =
      (json as any)?.available ?? (json as any)?.availability ?? (json as any)?.is_available ?? (json as any)?.data?.available;
    const registeredRaw = (json as any)?.registered ?? (json as any)?.data?.registered;

    const availableStr = typeof availableRaw === "string" ? availableRaw.toLowerCase() : null;
    const registeredStr = typeof registeredRaw === "string" ? registeredRaw.toLowerCase() : null;

    const status =
      availableRaw === true || availableStr === "true" || availableStr === "available"
        ? "available"
        : availableRaw === false || availableStr === "false" || availableStr === "unavailable" || availableStr === "taken"
          ? "unavailable"
          : registeredStr === "yes" || registeredStr === "true"
            ? "unavailable"
            : registeredStr === "no" || registeredStr === "false"
              ? "available"
              : ("unknown" as const);

    return new Response(
      JSON.stringify({
        domain,
        status,
        registered: registeredStr,
        raw: json,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
