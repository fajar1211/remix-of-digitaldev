import type { NavigateFunction } from "react-router-dom";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { invokeWithAuth } from "@/lib/invokeWithAuth";

import type { SitemapFormValue, SitemapStatus } from "@/components/super-admin/SitemapIntegrationCard";

const SETTINGS_FN = "super-admin-sitemap-settings";

type GetResponse = {
  configured: boolean;
  updated_at: string | null;
  settings: {
    base_url: string | null;
    include_static_pages: boolean;
    include_blog_posts: boolean;
    custom_paths: string[];
  } | null;
  sitemap_url: string | null;
};

export function useSitemapIntegration({ navigate }: { navigate: NavigateFunction }) {
  const [loading, setLoading] = useState(false);

  const [status, setStatus] = useState<SitemapStatus>({ configured: false, updatedAt: null, sitemapUrl: null });
  const [value, setValue] = useState<SitemapFormValue>({
    baseUrl: "",
    includeStaticPages: true,
    includeBlogPosts: true,
    customPathsText: "",
  });

  const onChange = (patch: Partial<SitemapFormValue>) => setValue((v) => ({ ...v, ...patch }));

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const { data, error } = await invokeWithAuth<GetResponse>(SETTINGS_FN, { action: "get" });
      if (error) throw error;

      const s = (data as any)?.settings ?? null;
      setStatus({
        configured: Boolean((data as any)?.configured),
        updatedAt: ((data as any)?.updated_at ?? null) as any,
        sitemapUrl: ((data as any)?.sitemap_url ?? null) as any,
      });

      setValue((prev) => ({
        ...prev,
        baseUrl: String(s?.base_url ?? prev.baseUrl ?? ""),
        includeStaticPages: Boolean(s?.include_static_pages ?? prev.includeStaticPages),
        includeBlogPosts: Boolean(s?.include_blog_posts ?? prev.includeBlogPosts),
        customPathsText: Array.isArray(s?.custom_paths) ? s.custom_paths.join("\n") : prev.customPathsText,
      }));
    } catch (e: any) {
      console.error(e);
      if (String(e?.message ?? "").toLowerCase().includes("unauthorized")) {
        toast.error("Your session has expired. Please sign in again.");
        navigate("/super-admin/login", { replace: true });
        return;
      }
      toast.error(e?.message || "Unable to load sitemap status.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parseCustomPaths = (raw: string) =>
    raw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const baseUrl = value.baseUrl.trim();
      if (!baseUrl) throw new Error("Base URL wajib diisi.");
      if (!/^https?:\/\//i.test(baseUrl)) throw new Error("Base URL harus diawali http:// atau https://");

      const customPaths = parseCustomPaths(value.customPathsText);
      const { error } = await invokeWithAuth<any>(SETTINGS_FN, {
        action: "set",
        settings: {
          base_url: baseUrl,
          include_static_pages: Boolean(value.includeStaticPages),
          include_blog_posts: Boolean(value.includeBlogPosts),
          custom_paths: customPaths,
        },
      });
      if (error) throw error;

      toast.success("Sitemap settings saved.");
      await fetchStatus();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Unable to save sitemap settings.");
    } finally {
      setLoading(false);
    }
  };

  const onClear = async () => {
    setLoading(true);
    try {
      const { error } = await invokeWithAuth<any>(SETTINGS_FN, { action: "clear" });
      if (error) throw error;
      toast.success("Sitemap has been disabled.");
      await fetchStatus();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Unable to disable sitemap.");
    } finally {
      setLoading(false);
    }
  };

  const onOpenSitemap = () => {
    if (!status.sitemapUrl) return;
    window.open(status.sitemapUrl, "_blank", "noopener,noreferrer");
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
      onOpenSitemap,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loading, status, value],
  );
}
