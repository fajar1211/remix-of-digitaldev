export type PageKey = "home" | "services" | "packages" | "about" | "contact" | "blog";

export type PageMetaRow = {
  key: PageKey;
  label: string;
  path: string;
  metaTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  ogImageUrl: string;
  ogImageAlt: string;
};

export type PageMetaSettingsBlob = {
  pages: Record<string, {
    metaTitle: string;
    metaDescription: string;
    canonicalUrl?: string;
    ogImageUrl?: string;
    ogImageAlt?: string;
  }>;
};

export const PAGE_META_SETTINGS_KEY = "page_meta";

export function defaultRows(origin: string): PageMetaRow[] {
  return [
    {
      key: "home",
      label: "Home",
      path: "/",
      metaTitle: "EasyMarketingAssist | Easy Digital Marketing",
      metaDescription: "Search a domain and get a professional website in minutes.",
      canonicalUrl: `${origin}/`,
      ogImageUrl: "",
      ogImageAlt: "",
    },
    {
      key: "services",
      label: "Services",
      path: "/services",
      metaTitle: "Services | EasyMarketingAssist",
      metaDescription: "Marketing services that actually help — SEO, social media, GMB, and more.",
      canonicalUrl: `${origin}/services`,
      ogImageUrl: "",
      ogImageAlt: "",
    },
    {
      key: "packages",
      label: "Packages",
      path: "/packages",
      metaTitle: "Packages & Pricing | EasyMarketingAssist",
      metaDescription: "Simple, transparent pricing for marketing assistance packages.",
      canonicalUrl: `${origin}/packages`,
      ogImageUrl: "",
      ogImageAlt: "",
    },
    {
      key: "about",
      label: "About",
      path: "/about",
      metaTitle: "About Us | EasyMarketingAssist",
      metaDescription: "Marketing made personal — work directly with a dedicated marketing assist.",
      canonicalUrl: `${origin}/about`,
      ogImageUrl: "",
      ogImageAlt: "",
    },
    {
      key: "contact",
      label: "Contact",
      path: "/contact",
      metaTitle: "Contact | EasyMarketingAssist",
      metaDescription: "Have a question or ready to get started? Contact EasyMarketingAssist.",
      canonicalUrl: `${origin}/contact`,
      ogImageUrl: "",
      ogImageAlt: "",
    },
    {
      key: "blog",
      label: "Blog (Listing)",
      path: "/blog",
      metaTitle: "Blog | EasyMarketingAssist",
      metaDescription: "Marketing tips and insights to help you grow your business online.",
      canonicalUrl: `${origin}/blog`,
      ogImageUrl: "",
      ogImageAlt: "",
    },
  ];
}

export function rowsToBlob(rows: PageMetaRow[]): PageMetaSettingsBlob {
  const pages: PageMetaSettingsBlob["pages"] = {};
  rows.forEach((r) => {
    pages[r.key] = {
      metaTitle: r.metaTitle,
      metaDescription: r.metaDescription,
      canonicalUrl: r.canonicalUrl || undefined,
      ogImageUrl: r.ogImageUrl || undefined,
      ogImageAlt: r.ogImageAlt || undefined,
    };
  });
  return { pages };
}

export function blobToRows(blob: unknown, origin: string): PageMetaRow[] {
  const defaults = defaultRows(origin);
  if (!blob || typeof blob !== "object") return defaults;
  const v = blob as any;
  const pages = v.pages;
  if (!pages || typeof pages !== "object") return defaults;

  return defaults.map((d) => {
    const raw = (pages as any)[d.key];
    if (!raw || typeof raw !== "object") return d;
    return {
      ...d,
      metaTitle: typeof raw.metaTitle === "string" ? raw.metaTitle : d.metaTitle,
      metaDescription: typeof raw.metaDescription === "string" ? raw.metaDescription : d.metaDescription,
      canonicalUrl: typeof raw.canonicalUrl === "string" ? raw.canonicalUrl : d.canonicalUrl,
      ogImageUrl: typeof raw.ogImageUrl === "string" ? raw.ogImageUrl : d.ogImageUrl,
      ogImageAlt: typeof raw.ogImageAlt === "string" ? raw.ogImageAlt : d.ogImageAlt,
    };
  });
}
