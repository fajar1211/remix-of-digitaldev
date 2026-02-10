import type { FormEvent } from "react";
import type { NavigateFunction } from "react-router-dom";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { invokeWithAuth } from "@/lib/invokeWithAuth";

import type { SchemaFormValue, SchemaStatus } from "@/components/super-admin/SchemaIntegrationCard";

const SETTINGS_FN = "super-admin-schema-settings";

type GetResponse = {
  configured: boolean;
  updated_at: string | null;
  settings: {
    enabled: boolean;
    business_name: string;
    website_url: string;
    logo_url: string | null;
    same_as: string[];
    site_name: string;
  } | null;
};

function splitLines(raw: string): string[] {
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function useSchemaIntegration({ navigate }: { navigate: NavigateFunction }) {
  const [loading, setLoading] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const [status, setStatus] = useState<SchemaStatus>({ configured: false, updatedAt: null });
  const [value, setValue] = useState<SchemaFormValue>({
    enabled: true,
    businessName: "",
    websiteUrl: origin,
    logoUrl: "",
    sameAsText: "",
    siteName: "",
  });

  const onChange = (patch: Partial<SchemaFormValue>) => setValue((v) => ({ ...v, ...patch }));

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const { data, error } = await invokeWithAuth<GetResponse>(SETTINGS_FN, { action: "get" });
      if (error) throw error;

      const s = (data as any)?.settings ?? null;
      setStatus({
        configured: Boolean((data as any)?.configured),
        updatedAt: ((data as any)?.updated_at ?? null) as any,
      });

      setValue((prev) => ({
        ...prev,
        enabled: Boolean(s?.enabled ?? prev.enabled),
        businessName: String(s?.business_name ?? prev.businessName ?? ""),
        websiteUrl: String(s?.website_url ?? prev.websiteUrl ?? origin),
        logoUrl: String(s?.logo_url ?? prev.logoUrl ?? ""),
        sameAsText: Array.isArray(s?.same_as) ? s.same_as.join("\n") : prev.sameAsText,
        siteName: String(s?.site_name ?? prev.siteName ?? ""),
      }));
    } catch (e: any) {
      console.error(e);
      if (String(e?.message ?? "").toLowerCase().includes("unauthorized")) {
        toast.error("Your session has expired. Please sign in again.");
        navigate("/super-admin/login", { replace: true });
        return;
      }
      toast.error(e?.message || "Unable to load schema status.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Keep websiteUrl synced with current domain (auto).
    setValue((v) => ({ ...v, websiteUrl: v.websiteUrl || origin }));
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const businessName = value.businessName.trim();
      if (!businessName) throw new Error("Business Name wajib diisi.");

      const websiteUrl = (value.websiteUrl || origin).trim();
      if (!/^https?:\/\//i.test(websiteUrl)) throw new Error("Website URL harus diawali http:// atau https://");

      const logoUrl = value.logoUrl.trim();
      if (logoUrl && !/^https?:\/\//i.test(logoUrl)) throw new Error("Logo URL harus berupa http(s) URL.");

      const sameAs = splitLines(value.sameAsText);
      for (const u of sameAs) {
        if (!/^https?:\/\//i.test(u)) throw new Error(`SameAs harus berupa http(s) URL: ${u}`);
      }

      const siteName = (value.siteName.trim() || businessName).trim();

      const { error } = await invokeWithAuth<any>(SETTINGS_FN, {
        action: "set",
        settings: {
          enabled: Boolean(value.enabled),
          business_name: businessName,
          website_url: websiteUrl,
          logo_url: logoUrl || null,
          same_as: sameAs,
          site_name: siteName,
        },
      });
      if (error) throw error;

      toast.success("Schema settings saved.");
      await fetchStatus();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Unable to save schema settings.");
    } finally {
      setLoading(false);
    }
  };

  const onClear = async () => {
    setLoading(true);
    try {
      const { error } = await invokeWithAuth<any>(SETTINGS_FN, { action: "clear" });
      if (error) throw error;
      toast.success("Schema has been disabled.");
      await fetchStatus();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Unable to disable schema.");
    } finally {
      setLoading(false);
    }
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
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loading, status, value],
  );
}
