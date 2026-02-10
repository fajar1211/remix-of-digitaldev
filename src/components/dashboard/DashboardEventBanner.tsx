import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useSupabaseRealtimeReload } from "@/hooks/useSupabaseRealtimeReload";

import {
  defaultDashboardBannerSettings,
  sanitizeDashboardBannerSettings,
  type DashboardBanner,
  type DashboardBannerAudience,
  type DashboardBannerSettings,
} from "@/pages/dashboard/admin/dashboard-banners/types";

const SETTINGS_KEY = "dashboard_banners";

function normalizeCtaHref(raw: string) {
  const href = String(raw ?? "").trim();
  if (!href) return null;
  // Allow internal routes (/dashboard/...) and anchors (#section)
  if (href.startsWith("/") || href.startsWith("#")) return href;
  // If already absolute, keep it.
  if (/^https?:\/\//i.test(href)) return href;
  // Otherwise treat as a domain and default to https.
  return `https://${href}`;
}

function isBannerActive(banner: DashboardBanner, now: Date, audience: DashboardBannerAudience) {
  if (banner.isPublished === false) return false;

  const shouldShow = audience === "user" ? banner.showOnUserOverview === true : banner.showOnAssistOverview === true;
  if (!shouldShow) return false;

  const start = banner.startsAt ? new Date(banner.startsAt) : null;
  const end = banner.endsAt ? new Date(banner.endsAt) : null;

  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
}

export function DashboardEventBanner({ audience, className }: { audience: DashboardBannerAudience; className?: string }) {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<DashboardBannerSettings>(defaultDashboardBannerSettings);

  const loadSettings = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("website_settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();

    if (error) {
      console.error("Failed to load dashboard banners", error);
      setSettings(defaultDashboardBannerSettings);
    } else {
      setSettings(sanitizeDashboardBannerSettings(data?.value));
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      await loadSettings();
      if (!mounted) return;
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [loadSettings]);

  // Auto-refresh when admin updates banner settings (alignment, schedule, etc.).
  useSupabaseRealtimeReload({
    channelName: `dashboard-banners:${audience}`,
    targets: [{ table: "website_settings", filter: `key=eq.${SETTINGS_KEY}` }],
    debounceMs: 300,
    onChange: loadSettings,
  });

  const activeBanner = useMemo(() => {
    const now = new Date();
    const active = (settings.banners ?? []).filter((b) => isBannerActive(b, now, audience));
    // newer (later startsAt) wins
    active.sort((a, b) => String(b.startsAt ?? "").localeCompare(String(a.startsAt ?? "")));
    return active[0] ?? null;
  }, [audience, settings.banners]);

  if (loading || !activeBanner) return null;

  const marqueeText = [activeBanner.title, activeBanner.subtitle].filter(Boolean).join(" — ");
  const textEffect = (activeBanner as any).textEffect ?? "marquee";

  const ctaHref = activeBanner.ctaHref ? normalizeCtaHref(activeBanner.ctaHref) : null;

  const titleAlign = (activeBanner as any).titleAlign ?? "left";
  const subtitleAlign = (activeBanner as any).subtitleAlign ?? "left";
  const alignClass = (align: string) =>
    align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";

  const alignJustify = (align: string) =>
    align === "center" ? "justify-center" : align === "right" ? "justify-end" : "justify-start";

  const effectSpanClass = (effect: string) => {
    if (effect === "pulse") return "motion-reduce:animate-none animate-pulse";
    if (effect === "blink") return "dashboard-banner-blink motion-reduce:animate-none";
    if (effect === "glow") return "dashboard-banner-glow";
    if (effect === "shake") return "dashboard-banner-shake motion-reduce:animate-none";
    if (effect === "bounce") return "dashboard-banner-bounce motion-reduce:animate-none";
    if (effect === "slide") return "dashboard-banner-slide motion-reduce:animate-none";
    if (effect === "fade") return "dashboard-banner-fade motion-reduce:animate-none";
    if (effect === "flip") return "dashboard-banner-flip motion-reduce:animate-none";
    return "";
  };

  return (
    <div className={cn(className)}>
      <Card className="border border-border bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            {textEffect === "marquee" ? (
              <>
                {/* Marquee text: scrolls without shifting the overall page layout */}
                <div className="space-y-1">
                  <div className={cn("relative overflow-hidden whitespace-nowrap flex", alignJustify(titleAlign))}>
                    <div className="dashboard-banner-marquee motion-reduce:animate-none">
                      <span className={cn("min-w-full text-sm font-semibold text-foreground", alignClass(titleAlign))}>
                        {activeBanner.title}
                      </span>
                      <span className={cn("min-w-full text-sm font-semibold text-foreground", alignClass(titleAlign))}>
                        {activeBanner.title}
                      </span>
                      <span className={cn("min-w-full text-sm font-semibold text-foreground", alignClass(titleAlign))}>
                        {activeBanner.title}
                      </span>
                    </div>
                  </div>

                  {activeBanner.subtitle ? (
                    <div className={cn("relative overflow-hidden whitespace-nowrap flex", alignJustify(subtitleAlign))}>
                      <div className="dashboard-banner-marquee motion-reduce:animate-none">
                        <span className={cn("min-w-full text-sm text-muted-foreground", alignClass(subtitleAlign))}>
                          {activeBanner.subtitle}
                        </span>
                        <span className={cn("min-w-full text-sm text-muted-foreground", alignClass(subtitleAlign))}>
                          {activeBanner.subtitle}
                        </span>
                        <span className={cn("min-w-full text-sm text-muted-foreground", alignClass(subtitleAlign))}>
                          {activeBanner.subtitle}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>

                <style>
                  {`
                    .dashboard-banner-marquee {
                      display: inline-flex;
                      align-items: center;
                      gap: 0;
                      will-change: transform;
                      animation: dashboard-banner-marquee 18s linear infinite;
                    }

                    @keyframes dashboard-banner-marquee {
                      0% { transform: translateX(0); }
                      100% { transform: translateX(-33.333%); }
                    }

                    @media (prefers-reduced-motion: reduce) {
                      .dashboard-banner-marquee { animation: none; }
                    }
                  `}
                </style>
              </>
            ) : textEffect === "none" ? (
              <div className="space-y-1">
                <div className={cn("text-sm font-semibold text-foreground", alignClass(titleAlign))}>{activeBanner.title}</div>
                {activeBanner.subtitle ? (
                  <div className={cn("text-sm text-muted-foreground", alignClass(subtitleAlign))}>{activeBanner.subtitle}</div>
                ) : null}
              </div>
            ) : (
              <>
                {textEffect === "typewriter" ? (
                  // Keep alignment on a full-width wrapper; animate only the inner text.
                  <div className={cn("w-full", alignClass(titleAlign))}>
                    <span
                      className={cn(
                        "inline-block text-sm font-semibold text-foreground",
                        "dashboard-banner-typewriter motion-reduce:animate-none",
                      )}
                    >
                      {marqueeText}
                    </span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className={cn("w-full", alignClass(titleAlign))}>
                      <span className={cn("inline-block text-sm font-semibold text-foreground", effectSpanClass(textEffect))}>
                        {activeBanner.title}
                      </span>
                    </div>
                    {activeBanner.subtitle ? (
                      <div className={cn("w-full", alignClass(subtitleAlign))}>
                        <span className={cn("inline-block text-sm text-muted-foreground", effectSpanClass(textEffect))}>
                          {activeBanner.subtitle}
                        </span>
                      </div>
                    ) : null}
                  </div>
                )}

                <style>
                  {`
                    .dashboard-banner-blink {
                      animation: dashboard-banner-blink 1s step-end infinite;
                    }

                    @keyframes dashboard-banner-blink {
                      0%, 49% { opacity: 1; }
                      50%, 100% { opacity: 0.15; }
                    }

                    .dashboard-banner-glow {
                      text-shadow:
                        0 0 14px hsl(var(--primary) / 0.35),
                        0 0 30px hsl(var(--primary) / 0.18);
                    }

                    .dashboard-banner-shake {
                      display: inline-block;
                      will-change: transform;
                      animation: dashboard-banner-shake 1.2s ease-in-out infinite;
                    }

                    @keyframes dashboard-banner-shake {
                      0%, 100% { transform: translateX(0); }
                      10% { transform: translateX(-1px); }
                      20% { transform: translateX(2px); }
                      30% { transform: translateX(-3px); }
                      40% { transform: translateX(2px); }
                      50% { transform: translateX(-1px); }
                      60% { transform: translateX(1px); }
                      70% { transform: translateX(-2px); }
                      80% { transform: translateX(2px); }
                      90% { transform: translateX(-1px); }
                    }

                    .dashboard-banner-bounce {
                      display: inline-block;
                      will-change: transform;
                      animation: dashboard-banner-bounce 1.1s ease-in-out infinite;
                    }

                    @keyframes dashboard-banner-bounce {
                      0%, 100% { transform: translateY(0); }
                      50% { transform: translateY(-3px); }
                    }

                    .dashboard-banner-slide {
                      display: inline-block;
                      will-change: transform;
                      animation: dashboard-banner-slide 2.6s ease-in-out infinite;
                    }

                    @keyframes dashboard-banner-slide {
                      0%, 100% { transform: translateX(0); }
                      50% { transform: translateX(-10px); }
                    }

                    .dashboard-banner-fade {
                      display: inline-block;
                      will-change: opacity;
                      animation: dashboard-banner-fade 1.6s ease-in-out infinite;
                    }

                    @keyframes dashboard-banner-fade {
                      0%, 100% { opacity: 1; }
                      50% { opacity: 0.35; }
                    }

                    .dashboard-banner-typewriter {
                      display: inline-block;
                      overflow: hidden;
                      white-space: nowrap;
                      max-width: 100%;
                      border-right: 2px solid hsl(var(--border));
                      animation: dashboard-banner-typing 3.2s steps(40, end) infinite,
                                 dashboard-banner-caret 0.85s step-end infinite;
                    }

                    @keyframes dashboard-banner-typing {
                      0% { width: 0; }
                      45% { width: 100%; }
                      80% { width: 100%; }
                      100% { width: 0; }
                    }

                    @keyframes dashboard-banner-caret {
                      0%, 49% { border-right-color: transparent; }
                      50%, 100% { border-right-color: hsl(var(--border)); }
                    }

                    .dashboard-banner-flip {
                      display: inline-block;
                      transform-origin: 50% 55%;
                      will-change: transform;
                      animation: dashboard-banner-flip 2.4s ease-in-out infinite;
                    }

                    @keyframes dashboard-banner-flip {
                      0%, 100% { transform: perspective(600px) rotateX(0deg); }
                      50% { transform: perspective(600px) rotateX(18deg); }
                    }

                    @media (prefers-reduced-motion: reduce) {
                      .dashboard-banner-blink { animation: none; }
                      .dashboard-banner-shake { animation: none; }
                      .dashboard-banner-bounce { animation: none; }
                      .dashboard-banner-slide { animation: none; }
                      .dashboard-banner-fade { animation: none; }
                      .dashboard-banner-typewriter {
                        animation: none;
                        border-right: none;
                        width: auto;
                      }
                      .dashboard-banner-flip { animation: none; }
                    }
                  `}
                </style>
              </>
            )}
          </div>

          {activeBanner.ctaLabel && ctaHref ? (
            <Button asChild size="sm">
              <a href={ctaHref} target="_blank" rel="noopener noreferrer">
                {activeBanner.ctaLabel}
              </a>
            </Button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
