// Supabase Edge Function: admin-create-user
// Creates a new auth user without email confirmation, assigns role=user, and seeds businesses/profile.
// Supports firstName, lastName, province, city, packageId, durationMonths from admin form.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, x-supabase-client-platform, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  businessName?: string;
  phone?: string;
  province?: string;
  city?: string;
  packageId?: string;
  durationMonths?: number;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: requester, error: requesterErr } = await admin.auth.getUser(token);
    if (requesterErr || !requester?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorize requester: admin or super_admin only
    const { data: roleRow, error: roleErr } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", requester.user.id)
      .maybeSingle();

    if (roleErr) throw roleErr;
    const role = roleRow?.role;
    if (role !== "admin" && role !== "super_admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Payload;
    const email = (body.email ?? "").trim();
    const password = body.password ?? "";

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!password || password.length < 6) {
      return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const firstName = (body.firstName ?? "").trim();
    const lastName = (body.lastName ?? "").trim();
    const fullName = (body.fullName ?? "").trim() || `${firstName} ${lastName}`.trim();

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: fullName || email,
        firstName,
        lastName,
        role: "user",
      },
    });

    if (createErr) throw createErr;
    const newUser = created.user;
    if (!newUser) throw new Error("Failed to create user");

    // Seed businesses row (optional fields)
    const businessName = (body.businessName ?? "").trim();
    const province = (body.province ?? "").trim();
    const city = (body.city ?? "").trim();

    await admin.from("businesses").insert({
      user_id: newUser.id,
      first_name: firstName || null,
      last_name: lastName || null,
      business_name: businessName || null,
      email: email,
      phone_number: (body.phone ?? "").trim() || null,
      country: "Indonesia",
      state: province || null,
      city: city || null,
    });

    // Update profile extra fields (profile row already created by trigger)
    const phone = (body.phone ?? "").trim();
    const profileUpdate: Record<string, unknown> = {};
    if (fullName) profileUpdate.name = fullName;
    if (phone) profileUpdate.phone = phone;
    if (province) profileUpdate.state = province;
    if (city) profileUpdate.city = city;
    profileUpdate.country = "Indonesia";

    if (Object.keys(profileUpdate).length > 0) {
      await admin
        .from("profiles")
        .update(profileUpdate)
        .eq("id", newUser.id);
    }

    // Insert user_packages if packageId provided
    const packageId = (body.packageId ?? "").trim();
    const durationMonths = Number(body.durationMonths ?? 0);
    if (packageId) {
      await admin.from("user_packages").insert({
        user_id: newUser.id,
        package_id: packageId,
        status: "pending",
        duration_months: durationMonths > 0 ? durationMonths : 1,
      });
    }

    return new Response(
      JSON.stringify({ id: newUser.id, email: newUser.email, created_at: newUser.created_at }),
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
