// Pure utility — no 'use client'. Safe to import from server components.

export interface SocialLinks {
  instagram: string;
  facebook:  string;
  twitter:   string;
  whatsapp:  string;
  youtube:   string;
}

export interface StatItem   { value: string; label: string; }
export interface FeatureItem { icon: string; title: string; desc: string; }
export interface Banner {
  id: string; imageUrl: string; title: string; subtitle: string;
  ctaText: string; ctaLink: string; isActive: boolean;
}

export interface SiteConfig {
  brandName:        string;
  logoUrl:          string;
  tagline:          string;
  announcementText: string;
  announcementCode: string;
  footerNote:       string;
  heroEyebrow:      string;
  heroHeadline:     string;
  heroSubheadline:  string;
  heroCta1Text:     string;
  heroCta1Link:     string;
  heroCta2Text:     string;
  heroCta2Link:     string;
  social:           SocialLinks;
  stats:            StatItem[];
  features:         FeatureItem[];
  banners:          Banner[];
}

export interface LayoutConfig {
  productColumns: string;  // "2" | "3" | "4"
  heroStyle:      string;  // "centered"
  categoryStyle:  string;  // "portrait" | "landscape"
  footerStyle:    string;  // "dark" | "light"
  cardStyle:      string;  // "default"
}

export const DEFAULT_SOCIAL: SocialLinks = {
  instagram: '', facebook: '', twitter: '', whatsapp: '', youtube: '',
};

export const DEFAULT_STATS: StatItem[] = [
  { value: '5,000+', label: 'Happy Customers' },
  { value: '500+',   label: 'Designs' },
  { value: '4.8★',   label: 'Avg. Rating' },
  { value: '₹999+',  label: 'Free Shipping' },
];

export const DEFAULT_FEATURES: FeatureItem[] = [
  { icon: 'Shield',     title: 'Hypoallergenic',    desc: 'Nickel-free, skin-safe materials for sensitive skin' },
  { icon: 'Truck',      title: 'Free Shipping',      desc: 'Free delivery on orders above ₹999 anywhere in India' },
  { icon: 'RefreshCw',  title: '7-Day Returns',      desc: 'Easy returns within 7 days of delivery, no questions asked' },
  { icon: 'Star',       title: 'Premium Quality',    desc: 'Anti-tarnish coating ensures jewellery stays beautiful' },
  { icon: 'Headphones', title: '24/7 Support',       desc: 'Real human support via WhatsApp, email or phone' },
  { icon: 'Award',      title: 'Certified Products', desc: 'All products tested for quality and safety standards' },
];

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  brandName:        'YourBrand',
  logoUrl:          '',
  tagline:          'Curated artificial jewellery crafted for every occasion. Hypoallergenic, affordable, and beautiful.',
  announcementText: 'Free shipping on orders above ₹999',
  announcementCode: 'WELCOME10',
  footerNote:       'Made with care in India',
  heroEyebrow:      'Festive Collection · 2026',
  heroHeadline:     'Jewellery that tells your story',
  heroSubheadline:  'Handpicked artificial jewellery for every occasion. Hypoallergenic, affordable, and crafted to last.',
  heroCta1Text:     'Shop Collection',
  heroCta1Link:     '/products',
  heroCta2Text:     'View Featured',
  heroCta2Link:     '/products?featured=true',
  social:           DEFAULT_SOCIAL,
  stats:            DEFAULT_STATS,
  features:         DEFAULT_FEATURES,
  banners:          [],
};

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  productColumns: '4',
  heroStyle:      'centered',
  categoryStyle:  'portrait',
  footerStyle:    'dark',
  cardStyle:      'default',
};

function safeJsonParse<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function rawToSiteConfig(raw: Record<string, string>): SiteConfig {
  return {
    brandName:        raw['brandName']        ?? DEFAULT_SITE_CONFIG.brandName,
    logoUrl:          raw['logoUrl']          ?? '',
    tagline:          raw['tagline']          ?? DEFAULT_SITE_CONFIG.tagline,
    announcementText: raw['announcementText'] ?? DEFAULT_SITE_CONFIG.announcementText,
    announcementCode: raw['announcementCode'] ?? DEFAULT_SITE_CONFIG.announcementCode,
    footerNote:       raw['footerNote']       ?? DEFAULT_SITE_CONFIG.footerNote,
    heroEyebrow:      raw['heroEyebrow']      ?? DEFAULT_SITE_CONFIG.heroEyebrow,
    heroHeadline:     raw['heroHeadline']     ?? DEFAULT_SITE_CONFIG.heroHeadline,
    heroSubheadline:  raw['heroSubheadline']  ?? DEFAULT_SITE_CONFIG.heroSubheadline,
    heroCta1Text:     raw['heroCta1Text']     ?? DEFAULT_SITE_CONFIG.heroCta1Text,
    heroCta1Link:     raw['heroCta1Link']     ?? DEFAULT_SITE_CONFIG.heroCta1Link,
    heroCta2Text:     raw['heroCta2Text']     ?? DEFAULT_SITE_CONFIG.heroCta2Text,
    heroCta2Link:     raw['heroCta2Link']     ?? DEFAULT_SITE_CONFIG.heroCta2Link,
    social:    safeJsonParse<SocialLinks>(raw['social']   ?? '{}', DEFAULT_SOCIAL),
    stats:     safeJsonParse<StatItem[]>(raw['stats']     ?? '[]', DEFAULT_STATS),
    features:  safeJsonParse<FeatureItem[]>(raw['features'] ?? '[]', DEFAULT_FEATURES),
    banners:   safeJsonParse<Banner[]>(raw['banners']     ?? '[]', []),
  };
}

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';

export async function fetchSiteConfig(): Promise<SiteConfig> {
  try {
    const res = await fetch(`${API_URL}/settings/site`, {
      next: { revalidate: 60 },   // cache for 60 s — changes rarely
    });
    if (!res.ok) return DEFAULT_SITE_CONFIG;
    const json = (await res.json()) as Record<string, unknown>;
    const raw  = (json['data'] ?? json) as Record<string, string>;
    return rawToSiteConfig(raw);
  } catch {
    return DEFAULT_SITE_CONFIG;
  }
}

export async function fetchLayoutConfig(): Promise<LayoutConfig> {
  try {
    const res = await fetch(`${API_URL}/settings/layout`, {
      cache: 'no-store',
    });
    if (!res.ok) return DEFAULT_LAYOUT_CONFIG;
    const json = (await res.json()) as Record<string, unknown>;
    const raw  = (json['data'] ?? json) as Record<string, string>;
    return {
      productColumns: raw['productColumns'] ?? DEFAULT_LAYOUT_CONFIG.productColumns,
      heroStyle:      raw['heroStyle']      ?? DEFAULT_LAYOUT_CONFIG.heroStyle,
      categoryStyle:  raw['categoryStyle']  ?? DEFAULT_LAYOUT_CONFIG.categoryStyle,
      footerStyle:    raw['footerStyle']    ?? DEFAULT_LAYOUT_CONFIG.footerStyle,
      cardStyle:      raw['cardStyle']      ?? DEFAULT_LAYOUT_CONFIG.cardStyle,
    };
  } catch {
    return DEFAULT_LAYOUT_CONFIG;
  }
}
