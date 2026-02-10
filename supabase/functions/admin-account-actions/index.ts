// Supabase Edge Function: admin-account-actions
// Admin-only actions for managing business users:
// - reset_password: send password reset email via Supabase Auth
// - change_email: change user's email (requires confirmation to new email)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  // Supabase JS adds x-supabase-client-platform; include it to avoid CORS 'Failed to fetch' in browsers.
  "Access-Control-Allow-Headers": "authorization, x-client-info, x-supabase-client-platform, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload =
  | {
      action: "reset_password";
      email: string;
    }
  | {
      action: "set_profile_status";
      user_id: string;
      status: string;
    }
  | {
      action: "get_user_email";
      user_id: string;
    }
  | {
      action: "delete_user";
      user_id: string;
    }
  | {
      action: "change_email";
      user_id: string;
      new_email: string;
    };

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getErrorMessage(e: unknown) {
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

async function sendPasswordResetEmail(params: { to: string; actionLink: string }) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL");
  if (!apiKey || !from) {
    throw new Error("Missing RESEND_API_KEY or RESEND_FROM_EMAIL");
  }

  const resend = new Resend(apiKey);

  await resend.emails.send({
    from,
    to: [params.to],
    subject: "Reset your password",
    html: `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.5;">
        <h2 style="margin: 0 0 12px;">Reset your password</h2>
        <p style="margin: 0 0 16px;">Click the button below to reset your password.</p>
        <p style="margin: 0 0 20px;">
          <a href="${params.actionLink}" style="display: inline-block; padding: 10px 14px; border-radius: 10px; text-decoration: none; background: #111827; color: #ffffff;">
            Reset password
          </a>
        </p>
        <p style="margin: 0; font-size: 12px; color: #6b7280;">If you did not request this, you can ignore this email.</p>
      </div>
    `,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json(500, { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return json(401, { error: "Unauthorized" });

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: requester, error: requesterErr } = await admin.auth.getUser(token);
    if (requesterErr || !requester?.user) return json(401, { error: "Unauthorized" });

    // Authorize requester: admin or super_admin
    const { data: roleRows, error: roleErr } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", requester.user.id);

    if (roleErr) throw roleErr;
    const isAdminOrSuperAdmin = (roleRows ?? []).some((r) => r.role === "admin" || r.role === "super_admin");
    if (!isAdminOrSuperAdmin) return json(403, { error: "Forbidden" });

    const body = (await req.json()) as Payload;

    if (body.action === "reset_password") {
      const email = String(body.email ?? "").trim();
      if (!email) return json(400, { error: "email is required" });

      const origin = req.headers.get("origin") ?? "";
      const redirectTo = origin ? `${origin}/auth/reset-password` : undefined;

      // Avoid Supabase Auth email rate limits by generating the recovery link
      // and sending the email via Resend instead of `resetPasswordForEmail`.
      const { data, error } = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: redirectTo ? { redirectTo } : undefined,
      } as any);
      if (error) throw error;

      const actionLink = (data as any)?.properties?.action_link as string | undefined;
      if (!actionLink) throw new Error("Failed to generate password reset link");

      await sendPasswordResetEmail({ to: email, actionLink });

      return json(200, { ok: true });
    }

    if (body.action === "set_profile_status") {
      const userId = String(body.user_id ?? "").trim();
      let status = String(body.status ?? "").trim().toLowerCase();
      if (!userId) return json(400, { error: "user_id is required" });
      if (!status) return json(400, { error: "status is required" });

      // We standardize on profiles.account_status.
      // Back-compat: old UI/clients may still send "inactive".
      if (status === "inactive") status = "nonactive";

      if (status !== "active" && status !== "nonactive") {
        return json(400, { error: "status must be 'active' or 'nonactive'" });
      }

      const { error } = await admin.from("profiles").update({ account_status: status }).eq("id", userId);
      if (error) throw error;

      return json(200, { ok: true, user_id: userId, status });
    }

    if (body.action === "change_email") {
      const userId = String(body.user_id ?? "").trim();
      const newEmail = String(body.new_email ?? "").trim();
      if (!userId) return json(400, { error: "user_id is required" });
      if (!newEmail) return json(400, { error: "new_email is required" });

      const { data, error } = await admin.auth.admin.updateUserById(userId, {
        email: newEmail,
      });
      if (error) throw error;

      return json(200, { ok: true, user_id: data.user?.id, email: data.user?.email });
    }

    if (body.action === "get_user_email") {
      const userId = String(body.user_id ?? "").trim();
      if (!userId) return json(400, { error: "user_id is required" });

      const { data, error } = await admin.auth.admin.getUserById(userId);
      if (error) throw error;

      // Supabase keeps the old email in `email` until the new email is confirmed.
      // When a change is pending, `email_change` can contain the new email.
      return json(200, {
        ok: true,
        user_id: data.user?.id,
        email: data.user?.email ?? null,
        pending_email: (data.user as any)?.email_change ?? null,
      });
    }

    if (body.action === "delete_user") {
      const userId = String(body.user_id ?? "").trim();
      if (!userId) return json(400, { error: "user_id is required" });

      // 1) Fetch business ids (for content_items cleanup)
      const { data: businesses, error: businessesErr } = await admin
        .from("businesses")
        .select("id")
        .eq("user_id", userId);
      if (businessesErr) throw businessesErr;
      const businessIds = (businesses ?? []).map((b) => b.id).filter(Boolean);

      // 2) Delete app data (order matters where possible)
      if (businessIds.length > 0) {
        const { error: contentItemsErr } = await admin.from("content_items").delete().in("business_id", businessIds);
        if (contentItemsErr) throw contentItemsErr;
      }

      // Delete items directly tied to the user id
      const deletions = [
        admin.from("task_work_logs").delete().eq("user_id", userId),
        admin.from("tasks").delete().eq("user_id", userId),
        admin.from("task_recurring_rules").delete().eq("user_id", userId),
        admin.from("user_content").delete().eq("user_id", userId),
        admin.from("user_gallery").delete().eq("user_id", userId),
        admin.from("chat_clears").delete().eq("user_id", userId),
        admin.from("chat_clears").delete().eq("peer_id", userId),
        admin.from("messages").delete().eq("sender_id", userId),
        admin.from("messages").delete().eq("receiver_id", userId),
        admin.from("orders").delete().eq("user_id", userId),
        admin.from("invoices").delete().eq("user_id", userId),
        admin.from("user_packages").delete().eq("user_id", userId),
        admin.from("user_roles").delete().eq("user_id", userId),
        admin.from("businesses").delete().eq("user_id", userId),
        admin.from("profiles").delete().eq("id", userId),
      ];

      const results = await Promise.all(deletions);
      const firstErr = results.find((r) => (r as any)?.error)?.error as any;
      if (firstErr) throw firstErr;

      // 3) Finally delete Auth user
      const { error: authDeleteErr } = await admin.auth.admin.deleteUser(userId);
      if (authDeleteErr) throw authDeleteErr;

      return json(200, { ok: true, user_id: userId });
    }

    return json(400, { error: "Invalid action" });
  } catch (e) {
    console.error("admin-account-actions error:", e);
    return json(500, { error: getErrorMessage(e) });
  }
});
