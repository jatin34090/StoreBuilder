// Theme registry — defines all available storefront themes.
// Each theme has a slug, display name, and capability flags.
// To add a new theme: add an entry here and implement its renderer in the web app.

export interface ThemeDefinition {
  id:          string;   // stable slug (never change once published)
  name:        string;   // display name shown in dashboard
  description: string;
  previewUrl:  string | null;  // screenshot URL (Cloudinary)
  status:      'active' | 'beta' | 'deprecated';
  features:    string[]; // e.g. ['hero', 'banners', 'categories', 'featured_products']
}

export const THEME_REGISTRY: ThemeDefinition[] = [
  {
    id:          'jewellery-classic',
    name:        'Jewellery Classic',
    description: 'A clean, elegant theme optimised for jewellery and lifestyle brands. Hero section, banner carousel, category grid, featured products.',
    previewUrl:  null,
    status:      'active',
    features:    ['hero', 'banners', 'categories', 'featured_products', 'why_choose_us'],
  },
];

export function getThemeById(id: string): ThemeDefinition | undefined {
  return THEME_REGISTRY.find((t) => t.id === id);
}

export const DEFAULT_THEME_ID = 'jewellery-classic';
