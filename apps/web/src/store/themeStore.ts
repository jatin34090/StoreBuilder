'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_COLORS, DEFAULT_DARK_COLORS } from '@/lib/theme';

export { DEFAULT_COLORS, DEFAULT_DARK_COLORS } from '@/lib/theme';

export interface CustomColors {
  primary: string;
  primaryForeground: string;
  background: string;
  foreground: string;
  card: string;
  border: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  destructive: string;
  radius: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  colors: Partial<CustomColors>;
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'royal-purple',  name: 'Royal Purple',   colors: { primary: '#6B21A8', accent: '#f0e7ff', primaryForeground: '#fafafa' } },
  { id: 'rose-gold',     name: 'Rose Gold',       colors: { primary: '#BE2D4A', accent: '#fff0f3', primaryForeground: '#fafafa' } },
  { id: 'sapphire',      name: 'Sapphire Blue',   colors: { primary: '#1D4ED8', accent: '#eff6ff', primaryForeground: '#fafafa' } },
  { id: 'emerald',       name: 'Emerald Green',   colors: { primary: '#047857', accent: '#ecfdf5', primaryForeground: '#fafafa' } },
  { id: 'ruby',          name: 'Ruby Red',        colors: { primary: '#B91C1C', accent: '#fff5f5', primaryForeground: '#fafafa' } },
  { id: 'midnight-gold', name: 'Midnight Gold',   colors: { primary: '#B45309', accent: '#fffbeb', primaryForeground: '#fafafa' } },
  { id: 'gold',          name: 'Gold',            colors: { primary: '#C49A00', accent: '#fffde7', primaryForeground: '#1a1a00' } },
  { id: 'silver',        name: 'Silver',          colors: { primary: '#6B7280', accent: '#f3f4f6', primaryForeground: '#fafafa' } },
  { id: 'pink',          name: 'Pink',            colors: { primary: '#DB2777', accent: '#fdf2f8', primaryForeground: '#fafafa' } },
];

export interface CustomPreset extends ThemePreset {
  isCustom: true;
}

interface ThemeState {
  colors:       CustomColors;
  darkColors:   CustomColors;
  darkMode:     boolean;
  customPresets: CustomPreset[];
  setColor:        (key: keyof CustomColors, value: string) => void;
  setDarkColor:    (key: keyof CustomColors, value: string) => void;
  applyPreset:     (presetId: string, customPresets?: CustomPreset[]) => void;
  setDarkMode:     (dark: boolean) => void;
  resetColors:     () => void;
  resetDarkColors: () => void;
  addCustomPreset:    (name: string, colors: CustomColors) => CustomPreset;
  removeCustomPreset: (id: string) => void;
  setCustomPresets:   (presets: CustomPreset[]) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      colors:       { ...DEFAULT_COLORS      } as unknown as CustomColors,
      darkColors:   { ...DEFAULT_DARK_COLORS } as unknown as CustomColors,
      darkMode:     false,
      customPresets: [],

      setColor:     (key, value) => set((s) => ({ colors:     { ...s.colors,     [key]: value } })),
      setDarkColor: (key, value) => set((s) => ({ darkColors: { ...s.darkColors, [key]: value } })),

      applyPreset: (presetId, customPresets) => {
        const allPresets = [...THEME_PRESETS, ...(customPresets ?? get().customPresets)];
        const preset = allPresets.find((p) => p.id === presetId);
        if (!preset) return;
        set((s) => ({ colors: { ...s.colors, ...preset.colors } }));
      },

      setDarkMode: (dark) => set({ darkMode: dark }),

      resetColors:     () => set({ colors:     { ...DEFAULT_COLORS      } as unknown as CustomColors }),
      resetDarkColors: () => set({ darkColors: { ...DEFAULT_DARK_COLORS } as unknown as CustomColors }),

      addCustomPreset: (name, colors) => {
        const preset: CustomPreset = { id: `custom-${Date.now()}`, name, colors, isCustom: true };
        set((s) => ({ customPresets: [...s.customPresets, preset] }));
        return preset;
      },
      removeCustomPreset: (id) =>
        set((s) => ({ customPresets: s.customPresets.filter((p) => p.id !== id) })),
      setCustomPresets: (presets) => set({ customPresets: presets }),
    }),
    { name: 'jewellery-theme' },
  ),
);
