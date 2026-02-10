// Supabase Edge Function: super-admin-login-link
// Generates a Supabase magic link for a target user, so Super Admin can open a new tab logged-in

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = {
  target_user_id: string;
};

const roleToRedirectPath = (role: string) => {
  const r = String(role ?? "").toLowerCase().trim();
  if (r === "assist" || r === "assistant") return "/dashboard/assist";
  if (r === "admin") return "/dashboard/admin";
  if (r === "super_admin" || r === "super admin") return "/dashboard/super-admin";
  return "/dashboard/user";
};

const textEncoder = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array) {
  // base64url without padding
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signImpersonationToken(secret: string, payload: Record<string, unknown>) {
  const header = { alg: "HS256", typ: "JWT" };
  const encHeader = base64UrlEncode(textEncoder.encode(JSON.stringify(header)));
  const encPayload = base64UrlEncode(textEncoder.encode(JSON.stringify(payload)));
  const signingInput = `${encHeader}.${encPayload}`;

  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, textEncoder.encode(signingInput));
  const encSig = base64UrlEncode(new Uint8Array(sig));
  return `${signingInput}.${encSig}`;
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

    const origin = req.headers.get("origin");
    if (!origin) {
      return new Response(JSON.stringify({ error: "Missing origin header" }), {
        status: 400,
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

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data: requester, error: requesterErr } = await admin.auth.getUser(token);
    if (requesterErr || !requester?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorize requester: super_admin only
    const { data: roleRow, error: roleErr } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", requester.user.id)
      .maybeSingle();
    if (roleErr) throw roleErr;
    if (roleRow?.role !== "super_admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Payload;
    const targetUserId = String(body?.target_user_id ?? "").trim();
    if (!targetUserId) {
      return new Response(JSON.stringify({ error: "target_user_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: profile, error: profileErr }, { data: targetRole, error: targetRoleErr }] = await Promise.all([
      admin.from("profiles").select("email").eq("id", targetUserId).maybeSingle(),
      admin.from("user_roles").select("role").eq("user_id", targetUserId).maybeSingle(),
    ]);
    if (profileErr) throw profileErr;
    if (targetRoleErr) throw targetRoleErr;

    const email = String((profile as any)?.email ?? "").trim();
    if (!email) {
      return new Response(JSON.stringify({ error: "Target user has no email in profiles" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const redirectTo = `${origin}${roleToRedirectPath(String((targetRole as any)?.role))}`;

    // Add signed token so dashboards can bypass onboarding/orientation checks ONLY for this magic-link session.
    // Token is verified server-side by edge function `super-admin-impersonation-verify`.
    const signed = await signImpersonationToken(serviceRoleKey, {
      sub: targetUserId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 10, // 10 minutes
      typ: "sa_impersonation",
    });

    const url = new URL(redirectTo);
    url.searchParams.set("imp", signed);
    const redirectToWithToken = url.toString();

    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: redirectToWithToken },
    });

    if (linkErr) throw linkErr;
    const action_link = (link as any)?.properties?.action_link as string | undefined;
    if (!action_link) throw new Error("Failed to generate action_link");

    return new Response(JSON.stringify({ action_link, redirect_to: redirectToWithToken }), {
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
