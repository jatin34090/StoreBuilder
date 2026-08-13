import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_COLORS } from './theme-defaults';

const VALID_THEME_KEYS = new Set([
  'primary', 'primaryForeground', 'background', 'foreground',
  'card', 'border', 'muted', 'mutedForeground', 'accent',
  'destructive', 'radius', 'darkMode',
]);

export const DEFAULT_SITE_CONFIG: Record<string, string> = {
  brandName:         'YourBrand',
  logoUrl:           '',
  tagline:           'Curated artificial jewellery crafted for every occasion. Hypoallergenic, affordable, and beautiful.',
  announcementText:  'Free shipping on orders above ₹999',
  announcementCode:  'WELCOME10',
  footerNote:        'Made with care in India',
  heroEyebrow:       'Festive Collection · 2026',
  heroHeadline:      'Jewellery that tells your story',
  heroSubheadline:   'Handpicked artificial jewellery for every occasion. Hypoallergenic, affordable, and crafted to last.',
  heroCta1Text:      'Shop Collection',
  heroCta1Link:      '/products',
  heroCta2Text:      'View Featured',
  heroCta2Link:      '/products?featured=true',
  stats:    JSON.stringify([
    { value: '5,000+', label: 'Happy Customers' },
    { value: '500+',   label: 'Designs' },
    { value: '4.8★',   label: 'Avg. Rating' },
    { value: '₹999+',  label: 'Free Shipping' },
  ]),
  social:   JSON.stringify({ instagram: '', facebook: '', twitter: '', whatsapp: '', youtube: '' }),
  features: JSON.stringify([
    { icon: 'Shield',     title: 'Hypoallergenic',    desc: 'Nickel-free, skin-safe materials for sensitive skin' },
    { icon: 'Truck',      title: 'Free Shipping',      desc: 'Free delivery on orders above ₹999 anywhere in India' },
    { icon: 'RefreshCw',  title: '7-Day Returns',      desc: 'Easy returns within 7 days of delivery, no questions asked' },
    { icon: 'Star',       title: 'Premium Quality',    desc: 'Anti-tarnish coating ensures jewellery stays beautiful' },
    { icon: 'Headphones', title: '24/7 Support',       desc: 'Real human support via WhatsApp, email or phone' },
    { icon: 'Award',      title: 'Certified Products', desc: 'All products tested for quality and safety standards' },
  ]),
  banners: JSON.stringify([]),
};

export const DEFAULT_LAYOUT_CONFIG: Record<string, string> = {
  productColumns:  '4',
  heroStyle:       'centered',
  categoryStyle:   'portrait',
  footerStyle:     'dark',
  cardStyle:       'default',
};

const VALID_SITE_KEYS   = new Set(Object.keys(DEFAULT_SITE_CONFIG));
const VALID_LAYOUT_KEYS = new Set(Object.keys(DEFAULT_LAYOUT_CONFIG));

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private prisma: PrismaService) {}

  // ── Theme ──────────────────────────────────────────────────────────────────

  async getTheme(): Promise<Record<string, string>> {
    const rows = await this.prisma.siteSetting.findMany({
      where: { key: { startsWith: 'theme.' } },
    });
    const result: Record<string, string> = { ...DEFAULT_COLORS };
    for (const row of rows) {
      const key = row.key.replace('theme.', '');
      if (VALID_THEME_KEYS.has(key)) result[key] = row.value;
    }
    return result;
  }

  async updateTheme(colors: Record<string, string>): Promise<void> {
    const filtered = Object.fromEntries(
      Object.entries(colors).filter(([k]) => VALID_THEME_KEYS.has(k)),
    );
    this.logger.log(`Saving theme keys: ${Object.keys(filtered).join(', ')}`);
    await this.prisma.siteSetting.deleteMany({
      where: {
        key: { startsWith: 'theme.' },
        NOT: { key: { in: [...VALID_THEME_KEYS].map((k) => `theme.${k}`) } },
      },
    });
    for (const [key, value] of Object.entries(filtered)) {
      await this.prisma.siteSetting.upsert({
        where:  { key: `theme.${key}` },
        update: { value: String(value) },
        create: { key: `theme.${key}`, value: String(value) },
      });
    }
  }

  async getCustomPresets(): Promise<unknown[]> {
    const row = await this.prisma.siteSetting.findUnique({ where: { key: 'theme.custom_presets' } });
    if (!row) return [];
    try { return JSON.parse(row.value) as unknown[]; } catch { return []; }
  }

  async updateCustomPresets(presets: unknown[]): Promise<void> {
    const value = JSON.stringify(presets);
    await this.prisma.siteSetting.upsert({
      where:  { key: 'theme.custom_presets' },
      update: { value },
      create: { key: 'theme.custom_presets', value },
    });
  }

  // ── Site Config ────────────────────────────────────────────────────────────

  async getSiteConfig(): Promise<Record<string, string>> {
    const rows = await this.prisma.siteSetting.findMany({
      where: { key: { startsWith: 'site.' } },
    });
    const result: Record<string, string> = { ...DEFAULT_SITE_CONFIG };
    for (const row of rows) {
      const key = row.key.replace('site.', '');
      if (VALID_SITE_KEYS.has(key)) result[key] = row.value;
    }
    return result;
  }

  async updateSiteConfig(data: Record<string, string>): Promise<void> {
    const filtered = Object.fromEntries(
      Object.entries(data).filter(([k]) => VALID_SITE_KEYS.has(k)),
    );
    this.logger.log(`Saving site config keys: ${Object.keys(filtered).join(', ')}`);
    for (const [key, value] of Object.entries(filtered)) {
      await this.prisma.siteSetting.upsert({
        where:  { key: `site.${key}` },
        update: { value: String(value) },
        create: { key: `site.${key}`, value: String(value) },
      });
    }
  }

  // ── Layout Config ──────────────────────────────────────────────────────────

  async getLayoutConfig(): Promise<Record<string, string>> {
    const rows = await this.prisma.siteSetting.findMany({
      where: { key: { startsWith: 'layout.' } },
    });
    const result: Record<string, string> = { ...DEFAULT_LAYOUT_CONFIG };
    for (const row of rows) {
      const key = row.key.replace('layout.', '');
      if (VALID_LAYOUT_KEYS.has(key)) result[key] = row.value;
    }
    return result;
  }

  async updateLayoutConfig(data: Record<string, string>): Promise<void> {
    const filtered = Object.fromEntries(
      Object.entries(data).filter(([k]) => VALID_LAYOUT_KEYS.has(k)),
    );
    this.logger.log(`Saving layout config keys: ${Object.keys(filtered).join(', ')}`);
    for (const [key, value] of Object.entries(filtered)) {
      await this.prisma.siteSetting.upsert({
        where:  { key: `layout.${key}` },
        update: { value: String(value) },
        create: { key: `layout.${key}`, value: String(value) },
      });
    }
  }
}
