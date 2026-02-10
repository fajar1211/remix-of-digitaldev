// Supabase Edge Function: super-admin-impersonation-verify
// Verifies a signed impersonation token placed in dashboard redirect URLs.
// Purpose: allow Super Admin to open a user's dashboard even if onboarding/orientation is incomplete,
// without allowing users to bypass onboarding by simply adding a query param.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = { token: string };

const textEncoder = new TextEncoder();

function base64UrlToBytes(input: string) {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function base64UrlEncode(bytes: Uint8Array) {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function safeJsonParse(input: string) {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

async function verifyTokenHmac(secret: string, token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false as const, error: "Invalid token format" };
  const [h, p, s] = parts;

  const headerJson = safeJsonParse(new TextDecoder().decode(base64UrlToBytes(h)));
  const payloadJson = safeJsonParse(new TextDecoder().decode(base64UrlToBytes(p)));
  if (!headerJson || !payloadJson) return { ok: false as const, error: "Invalid token" };
  if (headerJson.alg !== "HS256") return { ok: false as const, error: "Invalid token alg" };

  const signingInput = `${h}.${p}`;
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const sigOk = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlToBytes(s),
    textEncoder.encode(signingInput),
  );
  if (!sigOk) return { ok: false as const, error: "Invalid signature" };

  const now = Math.floor(Date.now() / 1000);
  const exp = Number(payloadJson.exp ?? 0);
  if (!exp || exp < now) return { ok: false as const, error: "Token expired" };
  if (payloadJson.typ !== "sa_impersonation") return { ok: false as const, error: "Invalid token type" };

  const sub = String(payloadJson.sub ?? "").trim();
  if (!sub) return { ok: false as const, error: "Invalid subject" };

  return { ok: true as const, sub };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!bearer) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Payload;
    const token = String(body?.token ?? "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "token is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const verified = await verifyTokenHmac(serviceRoleKey, token);
    if (!verified.ok) {
      return new Response(JSON.stringify({ allow: false, error: verified.error }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data: me, error: meErr } = await admin.auth.getUser(bearer);
    if (meErr || !me?.user) {
      return new Response(JSON.stringify({ allow: false, error: "Unauthorized" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only allow if token is bound to currently logged-in user
    const allow = me.user.id === verified.sub;

    return new Response(JSON.stringify({ allow }), {
      status: 200,
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
