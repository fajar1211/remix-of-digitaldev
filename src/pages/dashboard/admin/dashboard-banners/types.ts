export type DashboardBannerAudience = "user" | "assist";

export type DashboardBannerTextAlign = "left" | "center" | "right";

export type DashboardBannerTextEffect =
  | "marquee"
  | "blink"
  | "pulse"
  | "glow"
  | "shake"
  | "bounce"
  | "slide"
  | "fade"
  | "typewriter"
  | "flip"
  | "none";

export type DashboardBanner = {
  id: string;
  title: string;
  subtitle?: string | null;
  titleAlign?: DashboardBannerTextAlign | null;
  subtitleAlign?: DashboardBannerTextAlign | null;
  textEffect?: DashboardBannerTextEffect | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  startsAt?: string | null; // ISO
  endsAt?: string | null; // ISO
  isPublished?: boolean;
  showOnUserOverview?: boolean;
  showOnAssistOverview?: boolean;
};

export type DashboardBannerSettings = {
  banners: DashboardBanner[];
};

export const defaultDashboardBannerSettings: DashboardBannerSettings = {
  banners: [],
};

export function sanitizeDashboardBannerSettings(value: unknown): DashboardBannerSettings {
  if (!value || typeof value !== "object") return defaultDashboardBannerSettings;
  const v = value as any;

  const banners = Array.isArray(v.banners)
    ? v.banners
        .filter(Boolean)
        .map((b: any): DashboardBanner => ({
          id: String(b.id ?? crypto.randomUUID()),
          title: String(b.title ?? ""),
          subtitle: b.subtitle == null ? null : String(b.subtitle),
          titleAlign: b.titleAlign === "left" || b.titleAlign === "center" || b.titleAlign === "right" ? b.titleAlign : "left",
          subtitleAlign:
            b.subtitleAlign === "left" || b.subtitleAlign === "center" || b.subtitleAlign === "right" ? b.subtitleAlign : "left",
          textEffect:
            b.textEffect === "marquee" ||
            b.textEffect === "blink" ||
            b.textEffect === "pulse" ||
            b.textEffect === "glow" ||
            b.textEffect === "shake" ||
            b.textEffect === "bounce" ||
            b.textEffect === "slide" ||
            b.textEffect === "fade" ||
            b.textEffect === "typewriter" ||
            b.textEffect === "flip" ||
            b.textEffect === "none"
              ? b.textEffect
              : "marquee",
          ctaLabel: b.ctaLabel == null ? null : String(b.ctaLabel),
          ctaHref: b.ctaHref == null ? null : String(b.ctaHref),
          startsAt: b.startsAt == null ? null : String(b.startsAt),
          endsAt: b.endsAt == null ? null : String(b.endsAt),
          isPublished: b.isPublished === false ? false : true,
          showOnUserOverview: b.showOnUserOverview === true,
          showOnAssistOverview: b.showOnAssistOverview === true,
        }))
        .filter((b: DashboardBanner) => b.title.trim().length > 0)
    : [];

  return { banners };
}
