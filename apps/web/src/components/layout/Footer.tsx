import Link from 'next/link';
import { Instagram, Facebook, Twitter, Youtube, MessageCircle } from 'lucide-react';
import type { SiteConfig } from '@/lib/site-config';
import { DEFAULT_SITE_CONFIG } from '@/lib/site-config';

interface FooterProps {
  config?: SiteConfig;
  footerStyle?: 'dark' | 'light';
}

export function Footer({ config = DEFAULT_SITE_CONFIG, footerStyle = 'dark' }: FooterProps) {
  const { brandName, tagline, footerNote, social } = config;
  const isDark = footerStyle === 'dark';

  // Explicit colours — all children inherit from these, no hardcoded CSS-var overrides inside
  const bg        = isDark ? 'hsl(var(--foreground))'      : 'hsl(var(--card))';
  const textColor = isDark ? 'hsl(var(--background))'      : 'hsl(var(--foreground))';
  const divider   = isDark ? 'rgba(255,255,255,0.08)'      : 'rgba(0,0,0,0.08)';

  const socialLinks = [
    { key: 'instagram', Icon: Instagram,     label: 'Instagram', href: social.instagram && `https://instagram.com/${social.instagram.replace('@', '').replace('https://instagram.com/', '')}` },
    { key: 'facebook',  Icon: Facebook,      label: 'Facebook',  href: social.facebook },
    { key: 'twitter',   Icon: Twitter,       label: 'Twitter',   href: social.twitter },
    { key: 'youtube',   Icon: Youtube,       label: 'YouTube',   href: social.youtube },
    { key: 'whatsapp',  Icon: MessageCircle, label: 'WhatsApp',  href: social.whatsapp && `https://wa.me/${social.whatsapp.replace(/\D/g, '')}` },
  ].filter((s) => s.href && s.href.length > 0);

  return (
    <footer style={{ backgroundColor: bg, color: textColor }}>
      <div className="h-px" style={{ backgroundColor: 'hsl(var(--primary) / 0.4)' }} />

      <div className="container py-16 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10">

        {/* Brand */}
        <div className="md:col-span-1">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0"
              style={{ borderColor: 'hsl(var(--primary) / 0.6)' }}>
              <span className="font-display font-normal"
                style={{ color: 'hsl(var(--primary))', fontSize: '1rem', lineHeight: 1 }}>
                {brandName.charAt(0)}
              </span>
            </div>
            {/* inherit textColor set on <footer> */}
            <span className="font-display font-normal" style={{ fontSize: '1.0625rem' }}>
              {brandName}
            </span>
          </div>
          <p className="text-sm leading-relaxed mb-5" style={{ opacity: 0.5 }}>{tagline}</p>
          {socialLinks.length > 0 && (
            <div className="flex gap-4">
              {socialLinks.map(({ key, Icon, label, href }) => (
                <a key={key} href={href!} target="_blank" rel="noopener noreferrer" aria-label={label}
                  className="transition-colors duration-200 hover:text-primary" style={{ opacity: 0.45 }}>
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Shop */}
        <div>
          <FooterHeading>Shop</FooterHeading>
          <FooterLinks links={[
            ['Rings',        '/products?category=rings'],
            ['Necklaces',    '/products?category=necklaces-pendants'],
            ['Earrings',     '/products?category=earrings'],
            ['Bangles',      '/products?category=bangles-bracelets'],
            ['New Arrivals', '/products?sort=newest'],
            ['Sale',         '/products?sort=discount'],
          ]} />
        </div>

        {/* Account */}
        <div>
          <FooterHeading>My Account</FooterHeading>
          <FooterLinks links={[
            ['My Orders', '/account/orders'],
            ['Wishlist',  '/wishlist'],
            ['Profile',   '/account/profile'],
            ['Addresses', '/account/addresses'],
          ]} />
        </div>

        {/* Help */}
        <div>
          <FooterHeading>Help</FooterHeading>
          <FooterLinks links={[
            ['Contact Us',        '/contact'],
            ['Returns & Refunds', '/returns'],
            ['Shipping Policy',   '/shipping'],
            ['Privacy Policy',    '/privacy'],
            ['Terms of Service',  '/terms'],
          ]} />
        </div>
      </div>

      <div className="border-t" style={{ borderColor: divider }}>
        <div className="container py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs" style={{ opacity: 0.35, letterSpacing: '0.02em' }}>
            © {new Date().getFullYear()} {brandName} Jewellery. All rights reserved.
          </p>
          {footerNote && (
            <p className="text-xs" style={{ opacity: 0.35 }}>{footerNote}</p>
          )}
        </div>
      </div>
    </footer>
  );
}

function FooterHeading({ children }: { children: React.ReactNode }) {
  return (
    // No text-* class — inherits color from <footer> style
    <h4 className="font-display font-normal mb-4" style={{ fontSize: '0.9375rem', letterSpacing: '0.02em' }}>
      {children}
    </h4>
  );
}

function FooterLinks({ links }: { links: [string, string][] }) {
  return (
    <ul className="space-y-2.5">
      {links.map(([label, href]) => (
        <li key={href}>
          {/* inherit color, just dim with opacity and brighten on hover */}
          <Link href={href}
            className="text-sm transition-colors duration-200 hover:text-primary"
            style={{ opacity: 0.45 }}>
            {label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
