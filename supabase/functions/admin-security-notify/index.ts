// Supabase Edge Function: admin-security-notify
// Sends security notification emails (password change / email change) via Resend.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload =
  | {
      type: "password_changed";
      to: string;
      newPassword: string;
    }
  | {
      type: "email_change_requested";
      to: string;
      oldEmail: string;
      newEmail: string;
    };

function isEmail(v: unknown): v is string {
  return typeof v === "string" && v.includes("@") && v.length <= 255;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!resendKey) {
      return new Response(JSON.stringify({ error: "Missing RESEND_API_KEY" }), {
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

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const { data: requester, error: requesterErr } = await admin.auth.getUser(token);
    if (requesterErr || !requester?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleRow, error: roleErr } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", requester.user.id)
      .maybeSingle();

    if (roleErr) throw roleErr;
    if (roleRow?.role !== "admin" && roleRow?.role !== "super_admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Payload;

    const resend = new Resend(resendKey);

    if (body.type === "password_changed") {
      if (!isEmail(body.to)) {
        return new Response(JSON.stringify({ error: "Invalid recipient email" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (typeof body.newPassword !== "string" || body.newPassword.length < 8 || body.newPassword.length > 128) {
        return new Response(JSON.stringify({ error: "Invalid password" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const subject = "[Security] Admin account password changed";
      const html = `
        <h2>Admin account password changed</h2>
        <p>If you did not perform this change, please contact your technical team immediately.</p>
        <p><strong>New password:</strong> ${escapeHtml(body.newPassword)}</p>
        <p>Time: ${new Date().toISOString()}</p>
      `;

      const emailResponse = await resend.emails.send({
        from: "EasyMarketingAssist <onboarding@resend.dev>",
        to: [body.to],
        subject,
        html,
      });

      return new Response(JSON.stringify({ ok: true, emailResponse }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.type === "email_change_requested") {
      if (!isEmail(body.to) || !isEmail(body.oldEmail) || !isEmail(body.newEmail)) {
        return new Response(JSON.stringify({ error: "Invalid email" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const subject = "[Security] Admin account email change requested";
      const html = `
        <h2>Admin account email change requested</h2>
        <p>An email change has been requested for the admin account.</p>
        <p><strong>Old email:</strong> ${escapeHtml(body.oldEmail)}</p>
        <p><strong>New email:</strong> ${escapeHtml(body.newEmail)}</p>
        <p>If you did not perform this change, please contact your technical team immediately.</p>
        <p>Time: ${new Date().toISOString()}</p>
      `;

      const emailResponse = await resend.emails.send({
        from: "EasyMarketingAssist <onboarding@resend.dev>",
        to: [body.to],
        subject,
        html,
      });

      return new Response(JSON.stringify({ ok: true, emailResponse }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unsupported type" }), {
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

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
