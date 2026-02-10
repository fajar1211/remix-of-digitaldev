import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const SETTINGS_KEY = "robots_txt_settings";

type Settings = {
  enabled: boolean;
  user_agent: string;
  allow: string[];
  disallow: string[];
  sitemap: string;
};

function normalizeLines(arr: unknown): string[] {
  const raw = Array.isArray(arr) ? arr : [];
  const out: string[] = [];
  for (const v of raw) {
    const s = String(v ?? "").trim();
    if (!s) continue;
    if (!s.startsWith("/")) continue;
    out.push(s);
  }
  return Array.from(new Set(out));
}

function buildRobotsTxt(settings: Settings): string {
  const lines: string[] = [];
  lines.push(`User-agent: ${String(settings.user_agent ?? "*").trim() || "*"}`);

  const allow = normalizeLines(settings.allow);
  const disallow = normalizeLines(settings.disallow);

  for (const p of allow.length ? allow : ["/"]) lines.push(`Allow: ${p}`);
  for (const p of disallow) lines.push(`Disallow: ${p}`);

  const sitemap = String(settings.sitemap ?? "").trim();
  if (sitemap) lines.push(`Sitemap: ${sitemap}`);

  return lines.join("\n") + "\n";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") {
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
    const { data: settingsRow, error: settingsErr } = await admin.from("website_settings").select("value").eq("key", SETTINGS_KEY).maybeSingle();
    if (settingsErr) throw settingsErr;
    const settings = (settingsRow as any)?.value as Partial<Settings> | undefined;

    if (!settings || settings.enabled === false) {
      return new Response("Not found", {
        status: 404,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    const txt = buildRobotsTxt({
      enabled: true,
      user_agent: String(settings.user_agent ?? "*"),
      allow: Array.isArray(settings.allow) ? settings.allow : ["/"],
      disallow: Array.isArray(settings.disallow) ? settings.disallow : [],
      sitemap: String(settings.sitemap ?? ""),
    });

    return new Response(txt, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
        // Do not cache aggressively (crawler-friendly)
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
