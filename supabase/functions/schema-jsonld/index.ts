import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

function safeString(input: unknown, max = 500) {
  const v = String(input ?? "").trim();
  if (!v) return "";
  return v.length > max ? v.slice(0, max) : v;
}

function safeUrl(input: unknown) {
  const v = safeString(input, 800);
  if (!v) return "";
  if (!/^https?:\/\//i.test(v)) return "";
  return v;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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
    const { data: row, error: err } = await admin.from("website_settings").select("value").eq("key", SETTINGS_KEY).maybeSingle();
    if (err) throw err;

    const settings = (row as any)?.value as Settings | undefined;
    if (!settings || settings.enabled === false) {
      return new Response(
        JSON.stringify({
          enabled: false,
          jsonld: [],
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const businessName = safeString(settings.business_name, 200);
    const websiteUrl = safeUrl(settings.website_url);
    const logoUrl = safeUrl(settings.logo_url);
    const siteName = safeString(settings.site_name || businessName, 200) || businessName;
    const sameAs = Array.isArray(settings.same_as) ? settings.same_as.map(safeUrl).filter(Boolean) : [];

    if (!businessName || !websiteUrl) {
      return new Response(
        JSON.stringify({
          enabled: false,
          jsonld: [],
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const org: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: businessName,
      url: websiteUrl,
    };
    if (logoUrl) org.logo = logoUrl;
    if (sameAs.length) org.sameAs = sameAs;

    const website: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: siteName,
      url: websiteUrl,
    };

    return new Response(
      JSON.stringify({
        enabled: true,
        jsonld: [org, website],
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json; charset=utf-8",
          // Tidak di-cache agresif
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
