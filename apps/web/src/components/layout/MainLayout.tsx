import { Header } from './Header';
import { Footer } from './Footer';
import { fetchSiteConfig, fetchLayoutConfig } from '@/lib/site-config';
import { getTenant } from '@/lib/get-tenant';

export async function MainLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getTenant();
  const [config, layout] = await Promise.all([fetchSiteConfig(tenant?.id), fetchLayoutConfig(tenant?.id)]);

  const brand = {
    brandName:        config.brandName,
    logoUrl:          config.logoUrl,
    announcementText: config.announcementText,
    announcementCode: config.announcementCode,
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header brand={brand} />
      <main className="flex-1">{children}</main>
      <Footer config={config} footerStyle={layout.footerStyle as 'dark' | 'light'} />
    </div>
  );
}
