import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { fetchThemeFromServer, buildCssVarObject } from '@/lib/theme';
import { getTenant } from '@/lib/get-tenant';
import { StoreProvider } from '@/context/store-context';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
});

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant();
  const storeName = tenant?.name ?? 'YourBrand Jewellery';
  const baseUrl = process.env['NEXT_PUBLIC_WEB_URL'] ?? 'https://yourdomain.in';

  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: `${storeName} — Artificial Jewellery Online`,
      template: `%s | ${storeName}`,
    },
    description:
      'Shop beautiful artificial jewellery online. Earrings, necklaces, bangles and more at affordable prices.',
    keywords: ['artificial jewellery', 'fashion jewellery', 'imitation jewellery', 'buy online india'],
    authors: [{ name: storeName }],
    creator: storeName,
    openGraph: {
      type: 'website',
      locale: 'en_IN',
      siteName: storeName,
    },
    twitter: { card: 'summary_large_image' },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: '#4A0E8F',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [bundle, tenant] = await Promise.all([fetchThemeFromServer(), getTenant()]);
  // Apply the active color set: dark tokens when dark mode is on, light otherwise
  const activeColors = bundle.darkMode ? bundle.dark : bundle.light;
  const cssVarObj    = buildCssVarObject(activeColors);

  return (
    // Inline style on <html> beats any stylesheet — guaranteed to apply for every visitor
    <html
      lang="en"
      className={bundle.darkMode ? 'dark' : ''}
      suppressHydrationWarning
      style={cssVarObj as React.CSSProperties}
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        {tenant?.logoUrl && <link rel="icon" href={tenant.logoUrl} />}
      </head>
      <body className={`${inter.variable} ${playfair.variable} font-sans antialiased`} suppressHydrationWarning>
        <StoreProvider store={tenant}>
          <Providers>{children}</Providers>
        </StoreProvider>
      </body>
    </html>
  );
}
