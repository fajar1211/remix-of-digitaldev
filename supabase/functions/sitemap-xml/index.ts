import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const SETTINGS_KEY = "sitemap_settings";

type Settings = {
  base_url: string;
  include_static_pages?: boolean;
  include_blog_posts?: boolean;
  custom_paths?: string[];
};

function xmlEscape(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeBaseUrl(v: string) {
  return v.replace(/\/+$/, "");
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
    const settings = (settingsRow as any)?.value as Settings | undefined;

    const baseUrl = String(settings?.base_url ?? "").trim();
    if (!baseUrl) {
      return new Response("Sitemap not configured", {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const base = normalizeBaseUrl(baseUrl);
    const includeStatic = settings?.include_static_pages !== false;
    const includePosts = settings?.include_blog_posts !== false;
    const customPaths = Array.isArray(settings?.custom_paths) ? settings!.custom_paths!.map((p) => String(p).trim()).filter(Boolean) : [];

    const nowIso = new Date().toISOString();

    const urls: Array<{ loc: string; lastmod: string }> = [];

    if (includeStatic) {
      const pages = ["", "/about", "/services", "/contact", "/blog"];
      for (const path of pages) {
        urls.push({ loc: `${base}${path}`, lastmod: nowIso });
      }
    }

    for (const path of customPaths) {
      if (!path.startsWith("/")) continue;
      urls.push({ loc: `${base}${path}`, lastmod: nowIso });
    }

    if (includePosts) {
      const publishCutoff = nowIso;
      const { data: posts, error: postsErr } = await admin
        .from("blog_posts")
        .select("slug,updated_at,publish_at")
        .is("deleted_at", null)
        .eq("status", "published")
        .eq("visibility", "public")
        .eq("no_index", false)
        .or(`publish_at.is.null,publish_at.lte.${publishCutoff}`)
        .limit(1000);

      if (postsErr) throw postsErr;
      for (const p of posts ?? []) {
        const slug = String((p as any).slug ?? "").trim();
        if (!slug) continue;
        const updatedAt = String((p as any).updated_at ?? nowIso);
        urls.push({ loc: `${base}/blog/${slug}`, lastmod: updatedAt });
      }
    }

    // De-dupe
    const seen = new Set<string>();
    const unique = urls.filter((u) => {
      if (seen.has(u.loc)) return false;
      seen.add(u.loc);
      return true;
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      unique
        .map(
          (u) =>
            `  <url>\n` +
            `    <loc>${xmlEscape(u.loc)}</loc>\n` +
            `    <lastmod>${xmlEscape(u.lastmod)}</lastmod>\n` +
            `  </url>`,
        )
        .join("\n") +
      `\n</urlset>`;

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=300",
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
