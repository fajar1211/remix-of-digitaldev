import { useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Align = "left" | "center" | "right";

type TextEffect =
  | "none"
  | "blink"
  | "pulse"
  | "glow"
  | "shake"
  | "bounce"
  | "slide"
  | "fade"
  | "typewriter"
  | "flip"
  | "marquee";

export type HomepagePromo = {
  id: string;
  title: string;
  subtitle?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  textEffect?: TextEffect;
  titleAlign?: Align;
  subtitleAlign?: Align;
  startsAt?: string | null; // ISO
  endsAt?: string | null; // ISO
  isPublished?: boolean;
};

const SETTINGS_KEY = "homepage_promos";

type PromoSettings = {
  promos: HomepagePromo[];
};

function normalizeCtaHref(raw: string) {
  const href = String(raw ?? "").trim();
  if (!href) return null;
  if (href.startsWith("/") || href.startsWith("#")) return href;
  if (/^https?:\/\//i.test(href)) return href;
  return `https://${href}`;
}

function alignClass(align: Align) {
  if (align === "center") return "text-center";
  if (align === "right") return "text-right";
  return "text-left";
}

function alignJustify(align: Align) {
  if (align === "center") return "justify-center";
  if (align === "right") return "justify-end";
  return "justify-start";
}

function effectSpanClass(effect: TextEffect) {
  switch (effect) {
    case "blink":
      return "animate-[promo-blink_1.1s_steps(2,end)_infinite]";
    case "pulse":
      return "pulse";
    case "glow":
      return "drop-shadow-[0_0_14px_hsl(var(--primary)/0.35)]";
    case "shake":
      return "animate-[shake_0.6s_ease-in-out_infinite]";
    case "bounce":
      return "animate-bounce";
    case "slide":
      return "animate-[promo-slide_1.2s_ease-in-out_infinite]";
    case "fade":
      return "animate-[promo-fade_1.8s_ease-in-out_infinite]";
    case "flip":
      return "animate-[promo-flip_1.6s_ease-in-out_infinite]";
    default:
      return "";
  }
}

function sanitizeSettings(value: unknown): PromoSettings {
  if (!value || typeof value !== "object") return { promos: [] };
  const v = value as any;
  const promos = Array.isArray(v.promos) ? v.promos : [];
  return {
    promos: promos
      .filter(Boolean)
      .map((p: any): HomepagePromo => ({
        id: String(p.id ?? crypto.randomUUID()),
        title: String(p.title ?? ""),
        subtitle: p.subtitle == null ? null : String(p.subtitle),
        ctaLabel: p.ctaLabel == null ? null : String(p.ctaLabel),
        ctaHref: p.ctaHref == null ? null : String(p.ctaHref),
        imageUrl: p.imageUrl == null ? null : String(p.imageUrl),
        imageAlt: p.imageAlt == null ? null : String(p.imageAlt),
        textEffect:
          p.textEffect === "blink" ||
          p.textEffect === "pulse" ||
          p.textEffect === "glow" ||
          p.textEffect === "shake" ||
          p.textEffect === "bounce" ||
          p.textEffect === "slide" ||
          p.textEffect === "fade" ||
          p.textEffect === "typewriter" ||
          p.textEffect === "flip" ||
          p.textEffect === "marquee"
            ? p.textEffect
            : "none",
        titleAlign: p.titleAlign === "center" || p.titleAlign === "right" ? p.titleAlign : "left",
        subtitleAlign: p.subtitleAlign === "center" || p.subtitleAlign === "right" ? p.subtitleAlign : "left",
        startsAt: p.startsAt == null ? null : String(p.startsAt),
        endsAt: p.endsAt == null ? null : String(p.endsAt),
        isPublished: p.isPublished === false ? false : true,
      }))
      .filter((p: HomepagePromo) => p.title.trim().length > 0),
  };
}

function isPromoActive(promo: HomepagePromo, now: Date) {
  if (promo.isPublished === false) return false;

  const start = promo.startsAt ? new Date(promo.startsAt) : null;
  const end = promo.endsAt ? new Date(promo.endsAt) : null;

  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
}

export function HomePromoBanner({ className }: { className?: string }) {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<PromoSettings>({ promos: [] });
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("website_settings")
        .select("value")
        .eq("key", SETTINGS_KEY)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        console.error("Failed to load homepage promos", error);
        setSettings({ promos: [] });
      } else {
          setSettings(sanitizeSettings(data?.value));
      }
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const activePromo = useMemo(() => {
    const now = new Date();
    const active = (settings.promos ?? []).filter((p) => isPromoActive(p, now));
    // pick the one that starts the latest (closest) so newer promos win
    active.sort((a, b) => String(b.startsAt ?? "").localeCompare(String(a.startsAt ?? "")));
    return active[0] ?? null;
  }, [settings.promos]);

  // Expose the banner height to the page so the hero can offset itself responsively.
  // This prevents the banner from covering hero text on desktop/tablet/mobile.
  useEffect(() => {
    const reset = () => document.documentElement.style.setProperty("--homepage-promo-height", "0px");

    if (loading || !activePromo) {
      reset();
      return;
    }

    const el = rootRef.current;
    if (!el) {
      reset();
      return;
    }

    const setVar = () => {
      const h = Math.ceil(el.getBoundingClientRect().height || 0);
      document.documentElement.style.setProperty("--homepage-promo-height", `${h}px`);
    };

    setVar();
    window.addEventListener("resize", setVar);
    return () => {
      window.removeEventListener("resize", setVar);
      reset();
    };
  }, [activePromo?.id, loading]);

  if (loading || !activePromo) return null;

  const textEffect: TextEffect = (activePromo.textEffect ?? "none") as TextEffect;
  const titleAlign: Align = (activePromo.titleAlign ?? "left") as Align;
  const subtitleAlign: Align = (activePromo.subtitleAlign ?? "left") as Align;
  const ctaHref = activePromo.ctaHref ? normalizeCtaHref(activePromo.ctaHref) : null;

  return (
    <div ref={rootRef} className={cn("container", className)}>
      <Card className="border border-border bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Make the text area take the available width so text-align settings are visually accurate */}
          <div className="min-w-0 flex-1">
            {textEffect === "marquee" ? (
              <div className="space-y-1">
                <div className={cn("relative overflow-hidden whitespace-nowrap flex", alignJustify(titleAlign))}>
                  <div className="homepage-promo-marquee motion-reduce:animate-none">
                    <span className={cn("min-w-full text-sm font-semibold text-foreground", alignClass(titleAlign))}>
                      {activePromo.title}
                    </span>
                    <span className={cn("min-w-full text-sm font-semibold text-foreground", alignClass(titleAlign))}>
                      {activePromo.title}
                    </span>
                    <span className={cn("min-w-full text-sm font-semibold text-foreground", alignClass(titleAlign))}>
                      {activePromo.title}
                    </span>
                  </div>
                </div>

                {activePromo.subtitle ? (
                  <div className={cn("relative overflow-hidden whitespace-nowrap flex", alignJustify(subtitleAlign))}>
                    <div className="homepage-promo-marquee motion-reduce:animate-none">
                      <span className={cn("min-w-full text-xs text-muted-foreground", alignClass(subtitleAlign))}>
                        {activePromo.subtitle}
                      </span>
                      <span className={cn("min-w-full text-xs text-muted-foreground", alignClass(subtitleAlign))}>
                        {activePromo.subtitle}
                      </span>
                      <span className={cn("min-w-full text-xs text-muted-foreground", alignClass(subtitleAlign))}>
                        {activePromo.subtitle}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : textEffect === "typewriter" ? (
              <div className="space-y-1">
                <div className={cn("w-full", alignClass(titleAlign))}>
                  <span
                    className={cn(
                      "inline-block text-sm font-semibold text-foreground",
                      "homepage-promo-typewriter motion-reduce:animate-none"
                    )}
                  >
                    {activePromo.title}
                  </span>
                </div>

                {activePromo.subtitle ? (
                  <div className={cn("w-full", alignClass(subtitleAlign))}>
                    <span
                      className={cn(
                        "inline-block text-xs text-muted-foreground",
                        "homepage-promo-typewriter motion-reduce:animate-none"
                      )}
                    >
                      {activePromo.subtitle}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-1">
                <div className={cn("w-full", alignClass(titleAlign))}>
                  <span className={cn("inline-block text-sm font-semibold text-foreground truncate", effectSpanClass(textEffect))}>
                    {activePromo.title}
                  </span>
                </div>
                {activePromo.subtitle ? (
                  <div className={cn("w-full", alignClass(subtitleAlign))}>
                    <span className={cn("inline-block text-xs text-muted-foreground line-clamp-2", effectSpanClass(textEffect))}>
                      {activePromo.subtitle}
                    </span>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {activePromo.ctaLabel && ctaHref ? (
            <Button asChild size="sm">
              <a href={ctaHref} target="_blank" rel="noopener noreferrer">
                {activePromo.ctaLabel}
              </a>
            </Button>
          ) : null}
        </div>
      </Card>

      {/* Keep promo-specific keyframes local, but ALWAYS available for every effect */}
      <style>
        {`
          .homepage-promo-marquee {
            display: inline-flex;
            align-items: center;
            gap: 0;
            will-change: transform;
            animation: homepage-promo-marquee 18s linear infinite;
          }

          @keyframes homepage-promo-marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-33.333%); }
          }

          @keyframes promo-slide {
            0% { transform: translateX(0); }
            50% { transform: translateX(10px); }
            100% { transform: translateX(0); }
          }

          @keyframes promo-flip {
            0% { transform: rotateX(0deg); }
            50% { transform: rotateX(180deg); }
            100% { transform: rotateX(360deg); }
          }

          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-2px); }
            40% { transform: translateX(2px); }
            60% { transform: translateX(-2px); }
            80% { transform: translateX(2px); }
          }

          @keyframes promo-blink {
            0% { opacity: 1; }
            50% { opacity: 0; }
            100% { opacity: 1; }
          }

          @keyframes promo-fade {
            0% { opacity: 0.2; }
            50% { opacity: 1; }
            100% { opacity: 0.2; }
          }

          .homepage-promo-typewriter {
            overflow: hidden;
            border-right: 2px solid currentColor;
            white-space: nowrap;
            max-width: 100%;
            animation: promo-typewriter 2.2s steps(28, end) infinite;
          }

          @keyframes promo-typewriter {
            0% { width: 0; }
            60% { width: 100%; }
            100% { width: 100%; }
          }

          @media (prefers-reduced-motion: reduce) {
            .homepage-promo-marquee,
            .homepage-promo-typewriter {
              animation: none;
            }
          }
        `}
      </style>
    </div>
  );
}
