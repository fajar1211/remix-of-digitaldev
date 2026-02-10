import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DomainDuckAvailability = "true" | "false" | "premium" | "blocked";

type State = {
  loading: boolean;
  error: string | null;
  availability: DomainDuckAvailability | null;
};

export function useDomainDuckCheck(domain: string, { enabled = true, debounceMs = 450 } = {}) {
  const [state, setState] = useState<State>({ loading: false, error: null, availability: null });
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const d = String(domain ?? "").trim();
    if (!d) {
      setState({ loading: false, error: null, availability: null });
      return;
    }

    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const { data, error } = await supabase.functions.invoke("domainduck-check", {
          body: { domain: d },
        });
        if (error) throw error;
        const availability = (data as any)?.availability as DomainDuckAvailability | undefined;
        setState({ loading: false, error: null, availability: availability ?? "blocked" });
      } catch (e: any) {
        setState({ loading: false, error: e?.message ?? "Failed to check domain", availability: null });
      }
    }, debounceMs);

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [debounceMs, domain, enabled]);

  return state;
}
