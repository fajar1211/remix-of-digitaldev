// Edge Function: admin-message-monitor
// Admin-only read access to Assist chats (bypasses RLS using service role).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Action = "list_assists" | "list_peers" | "fetch_thread";

type Payload = {
  action: Action;
  assistId?: string;
  peerId?: string;
  limit?: number;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Missing server configuration" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    // Verify requester and role
    const { data: requester, error: requesterErr } = await admin.auth.getUser(token);
    if (requesterErr || !requester?.user) return json({ error: "Unauthorized" }, 401);

    const { data: roleRow, error: roleErr } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", requester.user.id)
      .maybeSingle();
    if (roleErr) throw roleErr;
    if (roleRow?.role !== "admin" && roleRow?.role !== "super_admin") return json({ error: "Forbidden" }, 403);

    const body = (await req.json().catch(() => ({}))) as Partial<Payload>;
    const action = String(body.action ?? "").trim() as Action;
    const limit = Math.min(1000, Math.max(50, Number(body.limit ?? 300)));

    if (action === "list_assists") {
      // Return ALL assists (all statuses), sorted by full name.
      const { data, error } = await admin
        .from("user_roles")
        .select("user_id, profiles:profiles(id,name,email,avatar_url,account_status)")
        .eq("role", "assist");
      if (error) throw error;

      const assists = (data ?? [])
        .map((row: any) => {
          const p = row?.profiles ?? {};
          return {
            id: String(p.id ?? row.user_id),
            name: String(p.name ?? ""),
            email: String(p.email ?? ""),
            avatar_url: (p.avatar_url ?? null) as string | null,
            status: String(p.account_status ?? "").toLowerCase() || "unknown",
          };
        })
        .sort((a: any, b: any) => String(a.name ?? "").localeCompare(String(b.name ?? ""), "en-US"));

      return json({ assists });
    }

    if (action === "list_peers") {
      const assistId = String(body.assistId ?? "").trim();
      if (!assistId) return json({ error: "assistId is required" }, 400);

      const { data: rows, error } = await admin
        .from("messages")
        .select("sender_id,receiver_id,created_at")
        .or(`sender_id.eq.${assistId},receiver_id.eq.${assistId}`)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;

      const lastByPeer: Record<string, string> = {};
      for (const r of (rows ?? []) as any[]) {
        const sid = String(r.sender_id);
        const rid = String(r.receiver_id);
        const peerId = sid === assistId ? rid : sid;
        if (!peerId || peerId === assistId) continue;
        if (!lastByPeer[peerId]) lastByPeer[peerId] = String(r.created_at);
      }

      const peerIds = Object.keys(lastByPeer);
      if (peerIds.length === 0) return json({ peers: [] });

      const { data: profiles, error: profErr } = await admin
        .from("profiles")
        .select("id,name,email,avatar_url,business_name")
        .in("id", peerIds);
      if (profErr) throw profErr;

      // Try to enrich business_name from businesses table (more accurate for user accounts).
      const { data: bizRows } = await admin
        .from("businesses")
        .select("user_id,business_name")
        .in("user_id", peerIds);

      const businessNameByUserId: Record<string, string> = {};
      for (const b of (bizRows ?? []) as any[]) {
        const uid = String(b.user_id ?? "");
        const bn = String(b.business_name ?? "").trim();
        if (uid && bn && !businessNameByUserId[uid]) businessNameByUserId[uid] = bn;
      }

      const peerRows = (profiles ?? []).map((p: any) => ({
        id: String(p.id),
        name: String(p.name ?? ""),
        email: String(p.email ?? ""),
        avatar_url: (p.avatar_url ?? null) as string | null,
        business_name: (businessNameByUserId[String(p.id)] ?? p.business_name ?? null) as string | null,
        last_message_at: lastByPeer[String(p.id)] ?? null,
      }));

      peerRows.sort((a: any, b: any) => String(b.last_message_at ?? "").localeCompare(String(a.last_message_at ?? "")));

      return json({ peers: peerRows });
    }

    if (action === "fetch_thread") {
      const assistId = String(body.assistId ?? "").trim();
      const peerId = String(body.peerId ?? "").trim();
      if (!assistId || !peerId) return json({ error: "assistId and peerId are required" }, 400);

      const { data, error } = await admin
        .from("messages")
        .select("id,sender_id,receiver_id,content,file_url,is_read,created_at")
        .or(
          `and(sender_id.eq.${assistId},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${assistId})`
        )
        .order("created_at", { ascending: true })
        .limit(limit);
      if (error) throw error;

      return json({ messages: data ?? [] });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return json({ error: message }, 500);
  }
});
