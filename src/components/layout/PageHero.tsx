import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  title: ReactNode;
  subtitle?: ReactNode;
  backgroundImage: string;
  className?: string;
  children?: ReactNode;
};

/**
 * Page hero dengan background image, overlay gradient transparan, desain minimal & bersih.
 * Digunakan untuk halaman Services, Packages, Blog, About, Contact agar konsisten dan profesional.
 */
export function PageHero({ title, subtitle, backgroundImage, className, children }: Props) {
  return (
    <section className={cn("relative overflow-hidden py-20 md:py-28", className)}>
      {/* Background Image */}
      <div className="absolute inset-0 -z-10">
        <img
          src={backgroundImage}
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover"
          loading="lazy"
        />
        {/* Overlay gradient untuk keterbacaan teks */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/85 to-background/90" />
      </div>

      <div className="relative container">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground text-balance">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">{subtitle}</p>
          ) : null}
          {children ? <div className="mt-8">{children}</div> : null}
        </div>
      </div>
    </section>
  );
}
