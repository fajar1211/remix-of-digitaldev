import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type WatchTarget = {
  table: string;
  filter?: string;
};

type Options = {
  channelName: string;
  targets: WatchTarget[];
  /** Debounce time for consolidating bursts of realtime events. */
  debounceMs?: number;
  /** Callback to run after debounce when any watched table changes. */
  onChange: () => void | Promise<void>;
};

/**
 * Subscribe to Supabase realtime changes and trigger a debounced reload callback.
 *
 * Purpose: make screens auto-sync without changing existing feature flows.
 */
export function useSupabaseRealtimeReload({ channelName, targets, debounceMs = 250, onChange }: Options) {
  const timerRef = useRef<number | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Avoid re-subscribing on every render when callers pass inline arrays.
  const targetsKey = JSON.stringify(targets);

  useEffect(() => {
    // Cleanup any previous channel (hot reload safety)
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const schedule = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        try {
          void onChange();
        } catch (e) {
          console.error("Realtime reload callback failed", e);
        }
      }, debounceMs);
    };

    const ch = supabase.channel(channelName);

    for (const t of targets) {
      ch.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: t.table,
          ...(t.filter ? { filter: t.filter } : {}),
        },
        () => {
          // Keep logs minimal but useful
          // console.log(`[realtime:${channelName}] change in ${t.table}`);
          schedule();
        },
      );
    }

    channelRef.current = ch;
    ch.subscribe();

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, debounceMs, onChange, targetsKey]);
}
