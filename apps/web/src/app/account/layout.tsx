import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { fetchSiteConfig, fetchLayoutConfig } from '@/lib/site-config';
import { AccountStoreGuard } from './AccountStoreGuard';

/**
 * Server layout for all /account/* pages.
 *
 * Being a Next.js layout.tsx (not a regular component), this runs only ONCE
 * when the user first navigates into the /account route group, then is kept
 * alive for subsequent navigations between /account/orders, /account/profile,
 * etc. — it is NOT re-executed on every page change.
 *
 * This is the architectural fix for the infinite /settings/site and
 * /settings/layout API requests: previously those fetches lived inside
 * <MainLayout>, a regular server component used inside each page, which
 * re-ran on every RSC fetch triggered by client-side navigation.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const [config, layout] = await Promise.all([fetchSiteConfig(), fetchLayoutConfig()]);

  const brand = {
    brandName:        config.brandName,
    logoUrl:          config.logoUrl,
    announcementText: config.announcementText,
    announcementCode: config.announcementCode,
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header brand={brand} />
      <main className="flex-1">
        <AccountStoreGuard>{children}</AccountStoreGuard>
      </main>
      <Footer config={config} footerStyle={layout.footerStyle as 'dark' | 'light'} />
    </div>
  );
}
