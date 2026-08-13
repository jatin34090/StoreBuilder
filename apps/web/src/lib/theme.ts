// Pure utility — no 'use client'. Safe to import from server components.

export const DEFAULT_COLORS: Record<string, string> = {
  primary:           '#B8965A',   // Champagne gold
  primaryForeground: '#ffffff',
  background:        '#FAFAF8',   // Warm ivory
  foreground:        '#1C1917',   // Warm near-black
  card:              '#FFFFFF',
  border:            '#E5D9C9',   // Warm beige
  muted:             '#F5EFE6',   // Warm cream
  mutedForeground:   '#8C7B6B',   // Warm taupe
  accent:            '#FDF8F0',   // Very light warm cream
  destructive:       '#DC2626',
  radius:            '0.25',
  darkMode:          'false',
};

// Default dark-mode token set — mirrors the .dark CSS block in globals.css
// expressed as hex so the same buildCssVarObject pipeline can process them.
export const DEFAULT_DARK_COLORS: Record<string, string> = {
  primary:           '#C49A5A',   // Lighter champagne gold (readable on dark bg)
  primaryForeground: '#1C1917',   // Dark text on primary
  background:        '#1C1917',   // Warm near-black
  foreground:        '#F5F0E8',   // Warm near-white
  card:              '#242120',   // Elevated dark surface
  border:            '#3A3330',   // Subtle warm border
  muted:             '#2C2928',   // Dark muted surface
  mutedForeground:   '#8A7A70',   // Warm grey for secondary text
  accent:            '#2C2928',   // Dark accent (same as muted)
  destructive:       '#EF4444',   // Red — stays vivid on dark
  radius:            '0.25',
};

export function hexToHsl(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function buildCssVarObject(colors: Record<string, string>): Record<string, string> {
  const c   = { ...DEFAULT_COLORS, ...colors };
  const hsl = (k: string) => hexToHsl(c[k] ?? DEFAULT_COLORS[k] ?? '#000000');

  return {
    '--primary':            hsl('primary'),
    '--primary-foreground': hsl('primaryForeground'),
    '--background':         hsl('background'),
    '--foreground':         hsl('foreground'),
    '--card':               hsl('card'),
    '--card-foreground':    hsl('foreground'),
    '--popover':            hsl('card'),
    '--popover-foreground': hsl('foreground'),
    '--border':             hsl('border'),
    '--input':              hsl('border'),
    '--ring':               hsl('primary'),
    '--muted':              hsl('muted'),
    '--muted-foreground':   hsl('mutedForeground'),
    '--accent':             hsl('accent'),
    '--accent-foreground':  hsl('primary'),
    '--destructive':        hsl('destructive'),
    '--destructive-foreground': hsl('primaryForeground'),
    '--secondary':          hsl('muted'),
    '--secondary-foreground': hsl('foreground'),
    '--radius':             `${c['radius'] ?? '0.5'}rem`,
  };
}

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';

export interface ThemeBundle {
  light:    Record<string, string>;
  dark:     Record<string, string>;
  darkMode: boolean;
}

export async function fetchThemeFromServer(): Promise<ThemeBundle> {
  try {
    const res = await fetch(`${API_URL}/settings/theme`, { cache: 'no-store' });
    if (!res.ok) return { light: DEFAULT_COLORS, dark: DEFAULT_DARK_COLORS, darkMode: false };

    const json = (await res.json()) as Record<string, unknown>;
    const raw  = (json['data'] ?? json) as Record<string, string>;

    const light: Record<string, string> = {};
    const dark:  Record<string, string> = {};

    for (const [k, v] of Object.entries(raw)) {
      if (k === 'darkMode') continue;
      if (k.startsWith('dark_')) dark[k.slice(5)] = v;
      else                       light[k]          = v;
    }

    return {
      light:    { ...DEFAULT_COLORS,      ...light },
      dark:     { ...DEFAULT_DARK_COLORS, ...dark  },
      darkMode: raw['darkMode'] === 'true',
    };
  } catch {
    return { light: DEFAULT_COLORS, dark: DEFAULT_DARK_COLORS, darkMode: false };
  }
}
