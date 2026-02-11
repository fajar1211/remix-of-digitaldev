import { useWebsiteLayoutSettings } from "@/hooks/useWebsiteLayout";

/**
 * Shared brand logo + name header used in onboarding & orientation pages.
 * Syncs with /dashboard/admin/website/layout settings (Brand Name + Logo).
 */
export function BrandHeader() {
  const { settings, loading, hasCache } = useWebsiteLayoutSettings();
  const showPlaceholder = loading && !hasCache;

  return (
    <div className="flex items-center justify-center gap-2">
      {showPlaceholder ? (
        <>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted animate-pulse" />
          <div className="h-6 w-40 rounded bg-muted animate-pulse" />
        </>
      ) : settings.header.logoUrl ? (
        <>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted overflow-hidden">
            <img
              src={settings.header.logoUrl}
              alt={settings.header.logoAlt || settings.header.brandName}
              loading="lazy"
              className="h-full w-full object-contain"
            />
          </div>
          <span className="text-2xl font-bold text-foreground">{settings.header.brandName}</span>
        </>
      ) : (
        <>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <span className="text-2xl font-bold text-primary-foreground">
              {settings.header.brandMarkText}
            </span>
          </div>
          <span className="text-2xl font-bold text-foreground">{settings.header.brandName}</span>
        </>
      )}
    </div>
  );
}
