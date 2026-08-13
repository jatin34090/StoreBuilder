'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { useThemeStore } from '@/store/themeStore';
import { buildCssVarObject } from '@/lib/theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { colors, darkColors, darkMode } = useThemeStore();
  const { setTheme }                     = useTheme();
  const isFirstRender                    = useRef(true);

  useEffect(() => {
    // Skip on first mount — the server already injected the correct inline styles
    // on <html>. Applying Zustand (localStorage) colors here would override the
    // server theme with the visitor's local defaults, causing a flash.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Apply whichever color set is active
    const activeColors = darkMode
      ? (darkColors as unknown as Record<string, string>)
      : (colors    as unknown as Record<string, string>);

    const vars = buildCssVarObject(activeColors);
    const root = document.documentElement;
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    root.classList.toggle('dark', darkMode);
    setTheme(darkMode ? 'dark' : 'light');
  }, [colors, darkColors, darkMode, setTheme]);

  return <>{children}</>;
}
