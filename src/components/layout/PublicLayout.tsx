import { ReactNode } from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { Ga4Script } from '@/components/analytics/Ga4Script';
import { GscVerificationMeta } from '@/components/analytics/GscVerificationMeta';
import { SchemaJsonLd } from '@/components/analytics/SchemaJsonLd';

interface PublicLayoutProps {
  children: ReactNode;
}

export function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <Ga4Script />
      <GscVerificationMeta />
      <SchemaJsonLd />
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}