export type ServiceIconKey = "globe" | "message" | "code" | "file" | "handshake";

export type ServiceItem = {
  icon: ServiceIconKey;
  title: string;
  description: string;
  features: string[];
};

export type ServicesPageSettings = {
  heroTitle: string;
  heroSubtitle: string;
  ctaTitle: string;
  ctaSubtitle: string;
  services: ServiceItem[];
};

export const defaultServicesSettings: ServicesPageSettings = {
  heroTitle: "Marketing Services That Actually Help",
  heroSubtitle: "No fluff, no jargon. Just practical marketing support from your dedicated assist.",
  ctaTitle: "Ready to Get Started?",
  ctaSubtitle: "Check out our packages to find the right level of support for your business.",
  services: [
    {
      icon: "globe",
      title: "Google Business Profile (GMB) Setup",
      description: "Get found by local customers searching for your services.",
      features: [
        "Complete profile setup and optimization",
        "Photos and business information",
        "Review response management",
        "Regular posts and updates",
        "Insights and performance tracking",
      ],
    },
    {
      icon: "message",
      title: "Social Media Posting",
      description: "Build your brand with consistent, engaging social content.",
      features: [
        "Content calendar planning",
        "Custom graphics and visuals",
        "Platform-specific optimization",
        "Hashtag strategy",
        "Engagement and community building",
      ],
    },
    {
      icon: "code",
      title: "Website Development",
      description: "Beautiful, fast websites that convert visitors into customers.",
      features: [
        "Modern, responsive design",
        "Mobile-first approach",
        "SEO-friendly structure",
        "Fast loading speeds",
        "Easy content management",
      ],
    },
    {
      icon: "file",
      title: "Blog & SEO Content",
      description: "Attract organic traffic with quality content that ranks.",
      features: [
        "Keyword research and strategy",
        "SEO-optimized blog posts",
        "Content that builds authority",
        "Regular publishing schedule",
        "Performance analytics",
      ],
    },
    {
      icon: "handshake",
      title: "Ongoing Marketing Assistance",
      description: "Your dedicated assist for all marketing needs.",
      features: [
        "Weekly strategy calls",
        "Task management and execution",
        "Performance reporting",
        "Quick response times",
        "Flexible task prioritization",
      ],
    },
  ],
};

function toStr(v: unknown) {
  return typeof v === "string" ? v : "";
}

function toStrArray(v: unknown) {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string") as string[];
}

const allowedIconKeys: ServiceIconKey[] = ["globe", "message", "code", "file", "handshake"];

export function sanitizeServicesSettings(value: unknown): ServicesPageSettings {
  if (!value || typeof value !== "object") return defaultServicesSettings;
  const obj = value as any;

  const services = Array.isArray(obj.services)
    ? (obj.services as any[])
        .map((raw) => {
          if (!raw || typeof raw !== "object") return null;
          const r = raw as any;
          const icon = allowedIconKeys.includes(r.icon) ? (r.icon as ServiceIconKey) : ("globe" as ServiceIconKey);

          const title = toStr(r.title);
          const description = toStr(r.description);
          const features = toStrArray(r.features).filter(Boolean);

          if (!title) return null;
          return { icon, title, description, features } satisfies ServiceItem;
        })
        .filter(Boolean)
    : [];

  const normalized: ServicesPageSettings = {
    heroTitle: toStr(obj.heroTitle) || defaultServicesSettings.heroTitle,
    heroSubtitle: toStr(obj.heroSubtitle) || defaultServicesSettings.heroSubtitle,
    ctaTitle: toStr(obj.ctaTitle) || defaultServicesSettings.ctaTitle,
    ctaSubtitle: toStr(obj.ctaSubtitle) || defaultServicesSettings.ctaSubtitle,
    services: services.length ? (services as ServiceItem[]) : defaultServicesSettings.services,
  };

  return normalized;
}
