import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type ActivityMap = Record<string, string>; // peerId -> ISO timestamp

function peerIdForMessage(userId: string, row: { sender_id: string; receiver_id: string }) {
  return row.sender_id === userId ? row.receiver_id : row.sender_id;
}

export function useRealtimeContactActivity(params: {
  userId: string | null | undefined;
  contactIds: string[];
}) {
  const { userId, contactIds } = params;

  const [lastActivityById, setLastActivityById] = useState<ActivityMap>({});
  const contactIdSetRef = useRef<Set<string>>(new Set());

  const contactIdsKey = useMemo(() => contactIds.join("|"), [contactIds]);

  useEffect(() => {
    contactIdSetRef.current = new Set(contactIds);
  }, [contactIdsKey]);

  const bumpActivity = useMemo(() => {
    return (peerId: string, iso: string) => {
      setLastActivityById((prev) => {
        const current = prev[peerId];
        if (current && new Date(current).getTime() >= new Date(iso).getTime()) return prev;
        return { ...prev, [peerId]: iso };
      });
    };
  }, []);

  // Initial fetch: resolve the latest message timestamp per contact
  useEffect(() => {
    const run = async () => {
      if (!userId) return;
      if (contactIds.length === 0) {
        setLastActivityById({});
        return;
      }

      // Fetch recent messages for these threads, newest first.
      // NOTE: We only need sender_id/receiver_id/created_at to compute activity.
      const inList = contactIds.join(",");
      const { data, error } = await (supabase as any)
        .from("messages")
        .select("sender_id,receiver_id,created_at")
        .or(
          `and(sender_id.eq.${userId},receiver_id.in.(${inList})),and(receiver_id.eq.${userId},sender_id.in.(${inList}))`
        )
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) return;

      const next: ActivityMap = {};
      for (const row of data ?? []) {
        const peerId = peerIdForMessage(userId, row);
        if (!contactIdSetRef.current.has(peerId)) continue;
        if (!next[peerId]) next[peerId] = row.created_at;
      }

      setLastActivityById(next);
    };

    run();
    // Re-fetch only when the contact set changes
  }, [userId, contactIdsKey]);

  // Realtime updates: keep activity up-to-date for both incoming and outgoing messages
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`contact-activity-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new as any;
          const involved = row?.sender_id === userId || row?.receiver_id === userId;
          if (!involved) return;

          const peerId = peerIdForMessage(userId, row);
          if (!contactIdSetRef.current.has(peerId)) return;

          bumpActivity(peerId, row.created_at);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, bumpActivity]);

  return { lastActivityById, bumpActivity };
}
