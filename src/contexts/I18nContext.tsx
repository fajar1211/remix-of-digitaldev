import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { dict, formatTemplate, type Lang } from "@/i18n/dict";

type I18nContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: keyof typeof dict, vars?: Record<string, string | number>) => string;
};

const STORAGE_KEY = "app_lang";

function detectLang(): Lang {
  if (typeof window === "undefined") return "id";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "id" || stored === "en") return stored;

  const nav = (navigator.language || "").toLowerCase();
  return nav.startsWith("id") ? "id" : "en";
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, _setLang] = useState<Lang>(() => detectLang());

  const setLang = useCallback((next: Lang) => {
    _setLang(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback<I18nContextValue["t"]>((key, vars) => {
    const entry = dict[key];
    if (!entry) return String(key);
    const raw = entry[lang] ?? entry.id;
    return formatTemplate(raw, vars);
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
