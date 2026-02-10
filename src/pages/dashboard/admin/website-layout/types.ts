export type NavLinkItem = {
  href: string;
  label: string;
};

export type FooterLinkItem = {
  href: string;
  label: string;
};

export type WebsiteLayoutSettings = {
  header: {
    brandName: string;
    /** Optional logo URL (if set, replaces brandMarkText in UI). */
    logoUrl?: string | null;
    logoAlt?: string | null;
    brandMarkText: string;
    navLinks: NavLinkItem[];
    primaryCtaLabel: string;
    primaryCtaHref: string;
    secondaryCtaLabel: string;
    secondaryCtaHref: string;
  };
  footer: {
    tagline: string;
    quickLinksTitle: string;
    quickLinks: FooterLinkItem[];
    servicesTitle: string;
    services: string[];
    contactTitle: string;
    contactEmail: string;
    contactPhone: string;
    contactAddress: string;
    copyrightText: string;
    privacyHref: string;
    termsHref: string;
  };
};

export const defaultWebsiteLayoutSettings: WebsiteLayoutSettings = {
  header: {
    brandName: "EasyMarketingAssist",
    logoUrl: null,
    logoAlt: "EasyMarketingAssist logo",
    brandMarkText: "E",
    navLinks: [
      { href: "/", label: "Home" },
      { href: "/services", label: "Services" },
      { href: "/packages", label: "Packages" },
      { href: "/blog", label: "Blog" },
      { href: "/about", label: "About Us" },
      { href: "/contact", label: "Contact" },
    ],
    secondaryCtaLabel: "Login",
    secondaryCtaHref: "/auth",
    primaryCtaLabel: "Get Started",
    primaryCtaHref: "/packages",
  },
  footer: {
    tagline: "Your dedicated marketing assist for growing your business online. Personal support, not a big agency.",
    quickLinksTitle: "Quick Links",
    quickLinks: [
      { href: "/services", label: "Services" },
      { href: "/packages", label: "Packages" },
      { href: "/blog", label: "Blog" },
      { href: "/about", label: "About Us" },
    ],
    servicesTitle: "Services",
    services: [
      "Google Business Profile",
      "Social Media Posting",
      "Website Development",
      "Blog & SEO Content",
    ],
    contactTitle: "Contact",
    contactEmail: "hello@easymarketingassist.com",
    contactPhone: "+1 (555) 123-4567",
    contactAddress: "Available worldwide for remote clients",
    copyrightText: "EasyMarketingAssist. All rights reserved.",
    privacyHref: "/privacy",
    termsHref: "/terms",
  },
};

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

const asString = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback);

const asNullableString = (v: unknown, fallback: string | null) => (typeof v === "string" ? v : fallback);

const asArray = <T>(v: unknown, fallback: T[]): T[] => (Array.isArray(v) ? (v as T[]) : fallback);

export function sanitizeWebsiteLayoutSettings(value: unknown): WebsiteLayoutSettings {
  if (!isObject(value)) return defaultWebsiteLayoutSettings;

  const headerRaw = isObject(value.header) ? value.header : {};
  const footerRaw = isObject(value.footer) ? value.footer : {};

  const navLinksRaw = asArray<unknown>((headerRaw as any).navLinks, defaultWebsiteLayoutSettings.header.navLinks);
  const navLinks = navLinksRaw
    .map((x) => {
      if (!isObject(x)) return null;
      const href = asString(x.href, "").trim();
      const label = asString(x.label, "").trim();
      if (!href || !label) return null;
      return { href, label } as NavLinkItem;
    })
    .filter(Boolean) as NavLinkItem[];

  const quickLinksRaw = asArray<unknown>((footerRaw as any).quickLinks, defaultWebsiteLayoutSettings.footer.quickLinks);
  const quickLinks = quickLinksRaw
    .map((x) => {
      if (!isObject(x)) return null;
      const href = asString(x.href, "").trim();
      const label = asString(x.label, "").trim();
      if (!href || !label) return null;
      return { href, label } as FooterLinkItem;
    })
    .filter(Boolean) as FooterLinkItem[];

  const servicesRaw = asArray<unknown>((footerRaw as any).services, defaultWebsiteLayoutSettings.footer.services);
  const services = servicesRaw.map((x) => (typeof x === "string" ? x : "")).map((x) => x.trim()).filter(Boolean);

  return {
    header: {
      brandName: asString((headerRaw as any).brandName, defaultWebsiteLayoutSettings.header.brandName),
      logoUrl: asNullableString((headerRaw as any).logoUrl, defaultWebsiteLayoutSettings.header.logoUrl ?? null),
      logoAlt: asNullableString((headerRaw as any).logoAlt, defaultWebsiteLayoutSettings.header.logoAlt ?? null),
      brandMarkText: asString((headerRaw as any).brandMarkText, defaultWebsiteLayoutSettings.header.brandMarkText),
      navLinks: navLinks.length ? navLinks : defaultWebsiteLayoutSettings.header.navLinks,
      primaryCtaLabel: asString((headerRaw as any).primaryCtaLabel, defaultWebsiteLayoutSettings.header.primaryCtaLabel),
      primaryCtaHref: asString((headerRaw as any).primaryCtaHref, defaultWebsiteLayoutSettings.header.primaryCtaHref),
      secondaryCtaLabel: asString(
        (headerRaw as any).secondaryCtaLabel,
        defaultWebsiteLayoutSettings.header.secondaryCtaLabel
      ),
      secondaryCtaHref: asString((headerRaw as any).secondaryCtaHref, defaultWebsiteLayoutSettings.header.secondaryCtaHref),
    },
    footer: {
      tagline: asString((footerRaw as any).tagline, defaultWebsiteLayoutSettings.footer.tagline),
      quickLinksTitle: asString((footerRaw as any).quickLinksTitle, defaultWebsiteLayoutSettings.footer.quickLinksTitle),
      quickLinks: quickLinks.length ? quickLinks : defaultWebsiteLayoutSettings.footer.quickLinks,
      servicesTitle: asString((footerRaw as any).servicesTitle, defaultWebsiteLayoutSettings.footer.servicesTitle),
      services: services.length ? services : defaultWebsiteLayoutSettings.footer.services,
      contactTitle: asString((footerRaw as any).contactTitle, defaultWebsiteLayoutSettings.footer.contactTitle),
      contactEmail: asString((footerRaw as any).contactEmail, defaultWebsiteLayoutSettings.footer.contactEmail),
      contactPhone: asString((footerRaw as any).contactPhone, defaultWebsiteLayoutSettings.footer.contactPhone),
      contactAddress: asString((footerRaw as any).contactAddress, defaultWebsiteLayoutSettings.footer.contactAddress),
      copyrightText: asString((footerRaw as any).copyrightText, defaultWebsiteLayoutSettings.footer.copyrightText),
      privacyHref: asString((footerRaw as any).privacyHref, defaultWebsiteLayoutSettings.footer.privacyHref),
      termsHref: asString((footerRaw as any).termsHref, defaultWebsiteLayoutSettings.footer.termsHref),
    },
  };
}
