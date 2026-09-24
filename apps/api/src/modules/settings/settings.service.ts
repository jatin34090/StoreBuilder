import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_COLORS } from './theme-defaults';

const VALID_THEME_KEYS = new Set([
  'primary', 'primaryForeground', 'background', 'foreground',
  'card', 'border', 'muted', 'mutedForeground', 'accent',
  'destructive', 'radius', 'darkMode',
  // Dark mode variants
  'dark_primary', 'dark_primaryForeground', 'dark_background', 'dark_foreground',
  'dark_card', 'dark_border', 'dark_muted', 'dark_mutedForeground', 'dark_accent',
  'dark_destructive',
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

// ── Shipping Defaults ──────────────────────────────────────────────────────────
export interface ShippingConfig {
  enabled:        boolean;
  flatRate:        number; // rupees
  freeThreshold:  number; // rupees; 0 = never free
}

const DEFAULT_SHIPPING: ShippingConfig = {
  enabled:       true,
  flatRate:       49,
  freeThreshold: 999,
};

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private prisma: PrismaService) {}

  // ── Theme ──────────────────────────────────────────────────────────────────

  async getTheme(storeId: string): Promise<Record<string, string>> {
    if (!storeId) return { ...DEFAULT_COLORS };
    const rows = await this.prisma.storeSetting.findMany({
      where: { storeId, key: { startsWith: 'theme.' } },
    });
    const result: Record<string, string> = { ...DEFAULT_COLORS };
    for (const row of rows) {
      const key = row.key.replace('theme.', '');
      if (VALID_THEME_KEYS.has(key)) result[key] = row.value;
    }
    return result;
  }

  async updateTheme(storeId: string, colors: Record<string, string>): Promise<void> {
    if (!storeId) return;
    const filtered = Object.fromEntries(
      Object.entries(colors).filter(([k]) => VALID_THEME_KEYS.has(k)),
    );
    this.logger.log(`Saving theme keys for store ${storeId}: ${Object.keys(filtered).join(', ')}`);
    await this.prisma.storeSetting.deleteMany({
      where: {
        storeId,
        key: { startsWith: 'theme.' },
        NOT: { key: { in: [...VALID_THEME_KEYS].map((k) => `theme.${k}`) } },
      },
    });
    for (const [key, value] of Object.entries(filtered)) {
      await this.prisma.storeSetting.upsert({
        where:  { storeId_key: { storeId, key: `theme.${key}` } },
        update: { value: String(value) },
        create: { storeId, key: `theme.${key}`, value: String(value) },
      });
    }
  }

  async getCustomPresets(storeId: string): Promise<unknown[]> {
    if (!storeId) return [];
    const row = await this.prisma.storeSetting.findUnique({
      where: { storeId_key: { storeId, key: 'theme.custom_presets' } },
    });
    if (!row) return [];
    try { return JSON.parse(row.value) as unknown[]; } catch { return []; }
  }

  async updateCustomPresets(storeId: string, presets: unknown[]): Promise<void> {
    if (!storeId) return;
    const value = JSON.stringify(presets);
    await this.prisma.storeSetting.upsert({
      where:  { storeId_key: { storeId, key: 'theme.custom_presets' } },
      update: { value },
      create: { storeId, key: 'theme.custom_presets', value },
    });
  }

  // ── Site Config ────────────────────────────────────────────────────────────

  async getSiteConfig(storeId: string): Promise<Record<string, string>> {
    if (!storeId) return { ...DEFAULT_SITE_CONFIG };
    const rows = await this.prisma.storeSetting.findMany({
      where: { storeId, key: { startsWith: 'site.' } },
    });
    const result: Record<string, string> = { ...DEFAULT_SITE_CONFIG };
    for (const row of rows) {
      const key = row.key.replace('site.', '');
      if (VALID_SITE_KEYS.has(key)) result[key] = row.value;
    }
    return result;
  }

  async updateSiteConfig(storeId: string, data: Record<string, string>): Promise<void> {
    if (!storeId) return;
    const filtered = Object.fromEntries(
      Object.entries(data).filter(([k]) => VALID_SITE_KEYS.has(k)),
    );
    this.logger.log(`Saving site config keys for store ${storeId}: ${Object.keys(filtered).join(', ')}`);
    for (const [key, value] of Object.entries(filtered)) {
      await this.prisma.storeSetting.upsert({
        where:  { storeId_key: { storeId, key: `site.${key}` } },
        update: { value: String(value) },
        create: { storeId, key: `site.${key}`, value: String(value) },
      });
    }
  }

  // ── Layout Config ──────────────────────────────────────────────────────────

  async getLayoutConfig(storeId: string): Promise<Record<string, string>> {
    if (!storeId) return { ...DEFAULT_LAYOUT_CONFIG };
    const rows = await this.prisma.storeSetting.findMany({
      where: { storeId, key: { startsWith: 'layout.' } },
    });
    const result: Record<string, string> = { ...DEFAULT_LAYOUT_CONFIG };
    for (const row of rows) {
      const key = row.key.replace('layout.', '');
      if (VALID_LAYOUT_KEYS.has(key)) result[key] = row.value;
    }
    return result;
  }

  async updateLayoutConfig(storeId: string, data: Record<string, string>): Promise<void> {
    if (!storeId) return;
    const filtered = Object.fromEntries(
      Object.entries(data).filter(([k]) => VALID_LAYOUT_KEYS.has(k)),
    );
    this.logger.log(`Saving layout config keys for store ${storeId}: ${Object.keys(filtered).join(', ')}`);
    for (const [key, value] of Object.entries(filtered)) {
      await this.prisma.storeSetting.upsert({
        where:  { storeId_key: { storeId, key: `layout.${key}` } },
        update: { value: String(value) },
        create: { storeId, key: `layout.${key}`, value: String(value) },
      });
    }
  }

  // ── Shipping Config ────────────────────────────────────────────────────────

  async getShippingConfig(storeId: string): Promise<ShippingConfig> {
    if (!storeId) return { ...DEFAULT_SHIPPING };
    const rows = await this.prisma.storeSetting.findMany({
      where: { storeId, key: { startsWith: 'shipping.' } },
    });
    const map: Record<string, string> = {};
    for (const row of rows) map[row.key.replace('shipping.', '')] = row.value;

    return {
      enabled:       (map['enabled']       ?? 'true') === 'true',
      flatRate:       parseFloat(map['flatRate']       ?? String(DEFAULT_SHIPPING.flatRate)),
      freeThreshold: parseFloat(map['freeThreshold']  ?? String(DEFAULT_SHIPPING.freeThreshold)),
    };
  }

  async updateShippingConfig(storeId: string, config: Partial<ShippingConfig>): Promise<ShippingConfig> {
    if (!storeId) throw new Error('storeId required');
    const updates: Record<string, string> = {};
    if (config.enabled       !== undefined) updates['enabled']       = String(config.enabled);
    if (config.flatRate       !== undefined) updates['flatRate']       = String(Number(config.flatRate));
    if (config.freeThreshold !== undefined) updates['freeThreshold'] = String(Number(config.freeThreshold));

    for (const [key, value] of Object.entries(updates)) {
      await this.prisma.storeSetting.upsert({
        where:  { storeId_key: { storeId, key: `shipping.${key}` } },
        update: { value },
        create: { storeId, key: `shipping.${key}`, value },
      });
    }
    return this.getShippingConfig(storeId);
  }
}
