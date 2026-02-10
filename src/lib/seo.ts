export type SeoMetaInput = {
  title: string;
  description?: string | null;
  canonicalUrl?: string | null;
  og?: {
    type?: string; // website | article
    title?: string;
    description?: string;
    url?: string;
    imageUrl?: string | null;
    imageAlt?: string | null;
  };
};

function ensureMetaByName(name: string) {
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  return el;
}

function ensureMetaByProperty(property: string) {
  let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  return el;
}

function ensureCanonicalLink() {
  let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.appendChild(canonical);
  }
  return canonical;
}

export function applySeoMeta(input: SeoMetaInput) {
  const title = (input.title || "").trim().slice(0, 60);
  if (title) document.title = title;

  const description = (input.description || "").trim().slice(0, 160);
  if (description) ensureMetaByName("description").setAttribute("content", description);

  const canonicalHref = (input.canonicalUrl || "").trim();
  if (canonicalHref) ensureCanonicalLink().setAttribute("href", canonicalHref);

  const og = input.og;
  if (!og) return;

  const ogTitle = (og.title ?? title).trim().slice(0, 60);
  const ogDescription = (og.description ?? description).trim().slice(0, 160);
  const ogUrl = (og.url ?? canonicalHref).trim();
  const ogType = (og.type ?? "website").trim() || "website";

  if (ogTitle) ensureMetaByProperty("og:title").setAttribute("content", ogTitle);
  if (ogDescription) ensureMetaByProperty("og:description").setAttribute("content", ogDescription);
  if (ogUrl) ensureMetaByProperty("og:url").setAttribute("content", ogUrl);
  ensureMetaByProperty("og:type").setAttribute("content", ogType);

  if (og.imageUrl) {
    ensureMetaByProperty("og:image").setAttribute("content", og.imageUrl);
    if (og.imageAlt) ensureMetaByProperty("og:image:alt").setAttribute("content", og.imageAlt);
  }
}
