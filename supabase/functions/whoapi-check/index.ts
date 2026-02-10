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

    const url = new URL("http://api.whoapi.com/");
    url.searchParams.set("apikey", apiKey);
    url.searchParams.set("r", "whois");
    url.searchParams.set("domain", domain);

    const resp = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    const json = await resp.json().catch(() => null);

    if (!resp.ok) {
      const msg = (json && (json as any).error) ? String((json as any).error) : `WhoAPI request failed (${resp.status})`;
      return new Response(JSON.stringify({ error: msg, raw: json }), {
        status: resp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const registered = (json as any)?.whois?.registered;
    const registeredStr = typeof registered === "string" ? registered.toLowerCase() : null;
    const status =
      registeredStr === "no" ? "available" : registeredStr === "yes" ? "unavailable" : ("unknown" as const);

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
