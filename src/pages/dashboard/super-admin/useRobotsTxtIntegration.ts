import type { NavigateFunction } from "react-router-dom";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { invokeWithAuth } from "@/lib/invokeWithAuth";

import type { RobotsTxtFormValue, RobotsTxtStatus } from "@/components/super-admin/RobotsTxtIntegrationCard";

const SETTINGS_FN = "super-admin-robots-txt-settings";
const DEFAULT_SITEMAP_URL = "https://supiwygxypfqjzoqmlaq.functions.supabase.co/sitemap-xml";

type GetResponse = {
  configured: boolean;
  updated_at: string | null;
  robots_url: string | null;
  settings: {
    enabled: boolean;
    user_agent: string;
    allow: string[];
    disallow: string[];
    sitemap: string;
  } | null;
};

function splitLines(raw: string): string[] {
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function hasDisallowAll(disallow: string[]): boolean {
  return disallow.map((s) => s.trim()).some((p) => p === "/");
}

export function useRobotsTxtIntegration({ navigate }: { navigate: NavigateFunction }) {
  const [loading, setLoading] = useState(false);

  const [status, setStatus] = useState<RobotsTxtStatus>({ configured: false, updatedAt: null, robotsUrl: null });
  const [value, setValue] = useState<RobotsTxtFormValue>({
    enabled: true,
    userAgent: "*",
    allowText: "/",
    disallowText: "",
    sitemapUrl: DEFAULT_SITEMAP_URL,
  });

  const onChange = (patch: Partial<RobotsTxtFormValue>) => setValue((v) => ({ ...v, ...patch }));

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const { data, error } = await invokeWithAuth<GetResponse>(SETTINGS_FN, { action: "get" });
      if (error) throw error;

      const s = (data as any)?.settings ?? null;
      setStatus({
        configured: Boolean((data as any)?.configured),
        updatedAt: ((data as any)?.updated_at ?? null) as any,
        robotsUrl: ((data as any)?.robots_url ?? null) as any,
      });

      setValue((prev) => ({
        ...prev,
        enabled: Boolean(s?.enabled ?? prev.enabled),
        userAgent: String(s?.user_agent ?? prev.userAgent ?? "*"),
        allowText: Array.isArray(s?.allow) ? s.allow.join("\n") : prev.allowText,
        disallowText: Array.isArray(s?.disallow) ? s.disallow.join("\n") : prev.disallowText,
        sitemapUrl: String(s?.sitemap ?? prev.sitemapUrl ?? DEFAULT_SITEMAP_URL),
      }));
    } catch (e: any) {
      console.error(e);
      if (String(e?.message ?? "").toLowerCase().includes("unauthorized")) {
        toast.error("Your session has expired. Please sign in again.");
        navigate("/super-admin/login", { replace: true });
        return;
      }
      toast.error(e?.message || "Unable to load robots.txt status.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showDisallowAllWarning = useMemo(() => hasDisallowAll(splitLines(value.disallowText)), [value.disallowText]);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userAgent = value.userAgent.trim() || "*";
      const sitemap = value.sitemapUrl.trim();
      if (!/^https?:\/\//i.test(sitemap)) throw new Error("Sitemap URL harus diawali http:// atau https://");

      const allow = splitLines(value.allowText);
      const disallow = splitLines(value.disallowText);

      // Client-side quick validation (server tetap validasi lagi)
      for (const p of [...allow, ...disallow]) {
        if (!p.startsWith("/")) throw new Error(`Path harus diawali "/": ${p}`);
      }

      const { error } = await invokeWithAuth<any>(SETTINGS_FN, {
        action: "set",
        settings: {
          enabled: Boolean(value.enabled),
          user_agent: userAgent,
          allow,
          disallow,
          sitemap,
        },
      });
      if (error) throw error;

      toast.success("Robots.txt settings saved.");
      await fetchStatus();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Unable to save robots.txt settings.");
    } finally {
      setLoading(false);
    }
  };

  const onClear = async () => {
    setLoading(true);
    try {
      const { error } = await invokeWithAuth<any>(SETTINGS_FN, { action: "clear" });
      if (error) throw error;
      toast.success("Robots.txt has been disabled.");
      await fetchStatus();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Unable to disable robots.txt.");
    } finally {
      setLoading(false);
    }
  };

  const onOpenRobots = () => {
    if (!status.robotsUrl) return;
    window.open(status.robotsUrl, "_blank", "noopener,noreferrer");
  };

  return useMemo(
    () => ({
      loading,
      status,
      value,
      onChange,
      onSave,
      onRefresh: fetchStatus,
      onClear,
      onOpenRobots,
      showDisallowAllWarning,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loading, status, value, showDisallowAllWarning],
  );
}
