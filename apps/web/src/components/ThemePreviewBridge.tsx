'use client';

import { useEffect } from 'react';

const HIGHLIGHT_RULES: Record<string, string> = {
  primary:           '[data-tv~="primary"]',
  primaryForeground: '[data-tv~="primary-foreground"]',
  background:        '[data-tv~="background"]',
  foreground:        '[data-tv~="foreground"]',
  card:              '[data-tv~="card"]',
  border:            '[data-tv~="border"]',
  muted:             '[data-tv~="muted"]',
  mutedForeground:   '[data-tv~="muted-foreground"]',
  accent:            '[data-tv~="accent"]',
  destructive:       '[data-tv~="destructive"]',
};

const SCROLLBAR_HIDE_CSS = `
  html { scrollbar-width: none; -ms-overflow-style: none; overflow-y: scroll; }
  html::-webkit-scrollbar { display: none; width: 0; height: 0; }
  body { overflow-x: hidden; }
`;

export function ThemePreviewBridge() {
  useEffect(() => {
    // Hide scrollbars — the parent page relays wheel events via postMessage
    const sbEl = document.createElement('style');
    sbEl.id = '__tpb-sb';
    sbEl.textContent = SCROLLBAR_HIDE_CSS;
    document.head.appendChild(sbEl);

    // Highlight overlay
    const hlEl = document.createElement('style');
    hlEl.id = '__tpb-hl';
    document.head.appendChild(hlEl);

    const applyHighlight = (key: string | null) => {
      if (!key || !HIGHLIGHT_RULES[key]) {
        hlEl.textContent = '';
        return;
      }
      hlEl.textContent = `
        ${HIGHLIGHT_RULES[key]} {
          outline: 2.5px solid #fbbf24 !important;
          outline-offset: 2px !important;
          position: relative;
          z-index: 1;
        }
      `;
    };

    const onMessage = (e: MessageEvent) => {
      if (!e.data?.type) return;

      if (e.data.type === 'THEME_UPDATE') {
        const vars = e.data.cssVars as Record<string, string>;
        const dark = Boolean(e.data.dark);
        const root = document.documentElement;
        root.classList.toggle('dark', dark);
        Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
      }

      if (e.data.type === 'HIGHLIGHT_VAR') {
        applyHighlight((e.data.key as string | null) ?? null);
      }
    };

    window.addEventListener('message', onMessage);
    try { window.parent?.postMessage({ type: 'PREVIEW_READY' }, '*'); } catch { /* cross-origin */ }

    return () => {
      window.removeEventListener('message', onMessage);
      sbEl.remove();
      hlEl.remove();
    };
  }, []);

  return null;
}
