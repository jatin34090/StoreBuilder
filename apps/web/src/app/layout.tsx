import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env['NEXT_PUBLIC_WEB_URL'] ?? 'https://yourdomain.in'),
  title: {
    default: 'YourBrand Jewellery — Artificial Jewellery Online',
    template: '%s | YourBrand Jewellery',
  },
  description:
    'Shop beautiful artificial jewellery online. Earrings, necklaces, bangles and more at affordable prices.',
  keywords: ['artificial jewellery', 'fashion jewellery', 'imitation jewellery', 'buy online india'],
  authors: [{ name: 'YourBrand' }],
  creator: 'YourBrand',
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    siteName: 'YourBrand Jewellery',
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#4A0E8F',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={`${inter.variable} ${playfair.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
