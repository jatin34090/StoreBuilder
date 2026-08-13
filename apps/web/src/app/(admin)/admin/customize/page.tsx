'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  Loader2, Save, RotateCcw, Sun, Moon, Check, Trash2, BookmarkPlus,
  X, AlertTriangle, RefreshCw, Monitor, Tablet, Smartphone, Eye,
  Megaphone, Image as ImageIcon, LayoutDashboard, Share2, Star,
  Palette, AlignLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useThemeStore, THEME_PRESETS, DEFAULT_COLORS, DEFAULT_DARK_COLORS,
  type CustomColors, type CustomPreset,
} from '@/store/themeStore';
import { adminApi } from '@/lib/admin-api';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { buildCssVarObject } from '@/lib/theme';
import type { FeatureItem, StatItem } from '@/lib/site-config';
import { DEFAULT_SITE_CONFIG, DEFAULT_LAYOUT_CONFIG } from '@/lib/site-config';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'brand' | 'announcement' | 'hero' | 'colors' | 'social' | 'features' | 'layout';

interface ColorMeta {
  key: keyof CustomColors;
  name: string;
  tagline: string;
  affects: string[];
  previewEl: 'button' | 'button-text' | 'accent-bg' | 'heading' | 'body-text' | 'page-bg' | 'card-bg' | 'pill-bg' | 'bordered' | 'error-badge';
}

// ─── Color metadata ────────────────────────────────────────────────────────────

const ALL_COLORS: ColorMeta[] = [
  { key: 'primary',           name: 'Primary Brand Color',   tagline: 'Buttons, prices, active states',             affects: ['"Add to Cart" buttons', 'Product prices', 'Active filter tab', 'Links & focus rings'], previewEl: 'button' },
  { key: 'primaryForeground', name: 'Button Text Color',      tagline: 'Text shown on top of Primary Brand Color',   affects: ['Button labels', 'Badge text'],                                                         previewEl: 'button-text' },
  { key: 'accent',            name: 'Hover Highlight',        tagline: 'Very light tint for hover effects',          affects: ['Link hover bg', 'Card hover overlay', 'Tooltip bg'],                                   previewEl: 'accent-bg' },
  { key: 'foreground',        name: 'Main Text Color',        tagline: 'Primary text across every page',             affects: ['Product names', 'Navigation links', 'All headings & body'],                            previewEl: 'heading' },
  { key: 'mutedForeground',   name: 'Secondary Text Color',   tagline: 'Softer text for descriptions and labels',    affects: ['Product descriptions', 'Helper text', 'Timestamps'],                                   previewEl: 'body-text' },
  { key: 'background',        name: 'Page Background',        tagline: 'The canvas behind everything',               affects: ['All page backgrounds', 'Hero section', 'Checkout page'],                               previewEl: 'page-bg' },
  { key: 'card',              name: 'Card Background',        tagline: 'Product cards, panels, popups',              affects: ['Product card surface', 'Modal dialogs', 'Dropdown menus'],                             previewEl: 'card-bg' },
  { key: 'muted',             name: 'Section / Input Bg',     tagline: 'Soft fill for inputs and secondary sections',affects: ['Filter pill backgrounds', 'Input fields', 'Table headers'],                            previewEl: 'pill-bg' },
  { key: 'border',            name: 'Border & Divider Color', tagline: 'Every line, outline, and edge',              affects: ['Product card borders', 'Input outlines', 'Section dividers'],                          previewEl: 'bordered' },
  { key: 'destructive',       name: 'Error / Danger Color',   tagline: 'Warnings and irreversible actions',          affects: ['Form errors', '"Out of stock" badge', 'Delete buttons'],                               previewEl: 'error-badge' },
];

const GROUPS = [
  { key: 'brand',     label: 'Brand Colors',       emoji: '🎨', hint: 'Your visual identity',    keys: ['primary','primaryForeground','accent'] as const },
  { key: 'text',      label: 'Text Colors',         emoji: '✏️', hint: 'Controls all text',        keys: ['foreground','mutedForeground'] as const },
  { key: 'layout',    label: 'Layout & Surfaces',   emoji: '🖥️', hint: 'Pages, cards, sections',   keys: ['background','card','muted'] as const },
  { key: 'component', label: 'Components & Status', emoji: '🔘', hint: 'Borders, errors, status',  keys: ['border','destructive'] as const },
];

// ─── Inline styles (immune to theme CSS vars) ─────────────────────────────────

const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, color: '#111827', background: '#fff', boxSizing: 'border-box' };
const ta:  React.CSSProperties = { ...inp, resize: 'vertical', minHeight: 72 };

// ─── Mini color preview ────────────────────────────────────────────────────────

function MiniPreview({ meta, colors }: { meta: ColorMeta; colors: CustomColors }) {
  const r = `${colors.radius}rem`;
  const p = colors.primary; const pf = colors.primaryForeground;
  const bg = colors.background; const fg = colors.foreground;
  const ca = colors.card; const mu = colors.muted;
  const mf = colors.mutedForeground; const bo = colors.border;
  const ac = colors.accent; const de = colors.destructive;
  const w = 'flex-shrink-0 w-[140px] h-[52px] rounded-lg overflow-hidden flex items-center justify-center border border-black/5 shadow-sm';
  switch (meta.previewEl) {
    case 'button':      return <div className={w} style={{ background: bg }}><div className="px-3 py-1.5 text-[11px] font-semibold tracking-wide shadow-sm" style={{ background: p, color: pf, borderRadius: r }}>Add to Cart</div></div>;
    case 'button-text': return <div className={w} style={{ background: bg }}><div className="px-3 py-1.5 text-[11px] font-semibold flex items-center gap-1" style={{ background: p, color: pf, borderRadius: r }}><span className="w-2 h-2 rounded-full bg-current opacity-70" />Text Color</div></div>;
    case 'accent-bg':   return <div className={w} style={{ background: bg }}><div className="px-3 py-1.5 rounded-md text-[11px] font-medium" style={{ background: ac, color: p, borderRadius: r }}>Hover state</div></div>;
    case 'heading':     return <div className={w} style={{ background: bg }}><div className="px-3 text-center"><div className="text-[13px] font-bold leading-tight" style={{ color: fg }}>Product Name</div><div className="text-[10px] mt-0.5" style={{ color: mf }}>Earrings Collection</div></div></div>;
    case 'body-text':   return <div className={w} style={{ background: bg }}><div className="px-3 text-center"><div className="text-[11px] leading-snug" style={{ color: mf }}>Beautiful handcrafted<br />gold-plated earrings</div></div></div>;
    case 'page-bg':     return <div className={w} style={{ background: bg, border: `1px solid ${bo}` }}><div className="text-[10px] px-2 text-center" style={{ color: mf }}>Page background</div></div>;
    case 'card-bg':     return <div className={w} style={{ background: bg }}><div className="w-24 h-9 shadow-sm flex items-center px-2.5" style={{ background: ca, border: `1px solid ${bo}`, borderRadius: r }}><div className="flex flex-col gap-0.5 flex-1"><div className="h-1.5 w-3/4 rounded-full" style={{ background: mu }} /><div className="h-1.5 w-1/2 rounded-full" style={{ background: mu }} /></div></div></div>;
    case 'pill-bg':     return <div className={w} style={{ background: bg }}><div className="flex gap-1"><div className="px-2.5 py-1 text-[10px] font-medium border" style={{ background: mu, color: mf, borderColor: bo, borderRadius: r }}>Rings</div><div className="px-2.5 py-1 text-[10px] font-medium border" style={{ background: mu, color: mf, borderColor: bo, borderRadius: r }}>Sets</div></div></div>;
    case 'bordered':    return <div className={w} style={{ background: bg }}><div className="w-24 h-7 border-2 flex items-center px-2 text-[10px]" style={{ borderColor: bo, borderRadius: r, color: mf, background: ca }}>Input field</div></div>;
    case 'error-badge': return <div className={w} style={{ background: bg }}><div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-medium" style={{ background: `${de}15`, color: de }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: de }} />Out of stock</div></div>;
    default: return null;
  }
}

// ─── Device definitions ────────────────────────────────────────────────────────

const DEVICES = [
  { id: 'mobile',  label: 'Mobile',  Icon: Smartphone, width: 390,  height: 844  },
  { id: 'tablet',  label: 'Tablet',  Icon: Tablet,     width: 768,  height: 1024 },
  { id: 'desktop', label: 'Desktop', Icon: Monitor,    width: 1440, height: 900  },
] as const;
type DeviceId = typeof DEVICES[number]['id'];

// ─── Live preview iframe ───────────────────────────────────────────────────────

function WebsitePreview({
  stagingColors, stagingDark, activeKey, previewDark, previewVersion,
}: {
  stagingColors:  CustomColors;
  stagingDark:    CustomColors;
  activeKey:      keyof CustomColors | null;
  previewDark:    boolean;
  previewVersion: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef    = useRef<HTMLIFrameElement>(null);
  const [device, setDevice] = useState<DeviceId>('mobile');
  const [panelW, setPanelW] = useState(500);
  const [ready,  setReady]  = useState(false);

  const dev    = DEVICES.find(d => d.id === device)!;
  const scale  = Math.min(1, (panelW - 2) / dev.width);
  const frameH = Math.min(600, Math.max(380, Math.round(dev.height * scale)));
  const wrapH  = Math.ceil(frameH / scale);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setPanelW(e.contentRect.width));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const h = (e: MessageEvent) => { if (e.data?.type === 'PREVIEW_READY') setReady(true); };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  }, []);

  // Push staging theme to iframe on every change
  useEffect(() => {
    const win = iframeRef.current?.contentWindow;
    if (!ready || !win) return;
    const activeColors = previewDark
      ? (stagingDark   as unknown as Record<string, string>)
      : (stagingColors as unknown as Record<string, string>);
    win.postMessage({ type: 'THEME_UPDATE', cssVars: buildCssVarObject(activeColors), dark: previewDark }, '*');
  }, [stagingColors, stagingDark, ready, previewDark]);

  useEffect(() => {
    const win = iframeRef.current?.contentWindow;
    if (!ready || !win) return;
    win.postMessage({ type: 'HIGHLIGHT_VAR', key: activeKey }, '*');
  }, [activeKey, ready]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const relay = (e: WheelEvent) => {
      e.preventDefault();
      iframeRef.current?.contentWindow?.scrollBy({ top: e.deltaY / scale, behavior: 'instant' });
    };
    el.addEventListener('wheel', relay, { passive: false });
    return () => el.removeEventListener('wheel', relay);
  }, [scale]);

  const handleDeviceChange = (id: DeviceId) => { if (id !== device) { setDevice(id); setReady(false); } };

  return (
    <div>
      <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl mb-3">
        {DEVICES.map(({ id, label, Icon, width }) => (
          <button key={id} type="button" onClick={() => handleDeviceChange(id)}
            className={cn('flex-1 flex items-center justify-center gap-1.5 py-1.5 px-1 text-[11px] font-medium rounded-lg transition-all',
              device === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600')}>
            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{label}</span>
            <span className="text-[10px] text-gray-400 hidden sm:inline">({width})</span>
          </button>
        ))}
      </div>

      <div className="rounded-xl overflow-hidden border border-gray-200 shadow-xl">
        <div className="bg-[#2c2c2c] px-3 py-2 flex items-center gap-2">
          <div className="flex gap-1.5 flex-shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
          </div>
          <div className="flex-1 bg-[#3c3c3c] rounded text-[10px] text-[#9ca3af] px-2 py-0.5 text-center truncate">
            Preview · {dev.label} · {previewDark ? 'dark' : 'light'} mode
          </div>
          {!ready && <Loader2 className="w-3 h-3 text-[#9ca3af] animate-spin flex-shrink-0" />}
        </div>

        <div ref={containerRef} className="relative overflow-hidden w-full" style={{ height: `${frameH}px` }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: `${dev.width}px`, height: `${wrapH}px`, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            <iframe
              key={`${device}-${previewVersion}`}
              ref={iframeRef}
              src="/storefront-preview"
              width={dev.width}
              height={wrapH}
              className="block border-none bg-white"
              title="Storefront Preview"
              onLoad={() => setTimeout(() => setReady(prev => prev || true), 4000)}
            />
          </div>
          {!ready && (
            <div className="absolute inset-0 bg-gray-50/90 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              <p className="text-xs text-gray-400">Loading preview…</p>
            </div>
          )}
        </div>
      </div>

      <p className="text-center text-[10px] text-gray-400 mt-1.5">
        Scroll to explore · Hover a color to see what it affects
      </p>
    </div>
  );
}

// ─── Color row ────────────────────────────────────────────────────────────────

function ColorRow({ meta, colors, defaultValue, onChange, onReset, isActive, onActivate, onDeactivate }: {
  meta: ColorMeta; colors: CustomColors; defaultValue: string;
  onChange: (v: string) => void; onReset: () => void;
  isActive: boolean; onActivate: () => void; onDeactivate: () => void;
}) {
  const value = colors[meta.key] as string;
  const [hex, setHex] = useState(value.toUpperCase());
  useEffect(() => setHex(value.toUpperCase()), [value]);
  const isDefault = value === defaultValue;

  return (
    <div
      className={cn('rounded-xl border transition-all duration-150', isActive ? 'border-primary/40 shadow-sm shadow-primary/10' : 'border-gray-100 bg-white hover:border-gray-200')}
      style={isActive ? { background: 'hsl(var(--primary) / 0.03)' } : { background: '#fff' }}
      onMouseEnter={onActivate} onMouseLeave={onDeactivate}
    >
      <div className="flex items-start gap-3 px-4 pt-4 pb-2">
        <label htmlFor={`cp-${meta.key}`}
          className="relative w-9 h-9 rounded-lg border-2 border-white shadow-md cursor-pointer flex-shrink-0 hover:scale-105 transition-transform mt-0.5 overflow-hidden"
          style={{ backgroundColor: value }}>
          <input id={`cp-${meta.key}`} type="color" value={value} onChange={e => onChange(e.target.value)} onFocus={onActivate} onBlur={onDeactivate}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
        </label>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900 leading-tight">{meta.name}</p>
            {!isDefault && <span className="inline-flex text-[9px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Modified</span>}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{meta.tagline}</p>
        </div>
        {!isDefault && (
          <button type="button" onClick={onReset} className="flex-shrink-0 text-[10px] text-gray-400 hover:text-primary flex items-center gap-1 pt-1 transition-colors">
            <RefreshCw className="w-3 h-3" />Reset
          </button>
        )}
      </div>
      <div className="px-4 pb-2">
        <div className="flex flex-wrap gap-1">
          {meta.affects.map(a => <span key={a} className="text-[10px] text-gray-500 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">✓ {a}</span>)}
        </div>
      </div>
      <div className="px-4 pb-4 flex items-center gap-3">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-2">
          <div className="w-4 h-4 rounded border border-black/10 flex-shrink-0" style={{ background: value }} />
          <input type="text" value={hex}
            onChange={e => { const v = e.target.value.toUpperCase(); setHex(v); if (/^#[0-9A-F]{6}$/.test(v)) onChange(v); }}
            onBlur={() => setHex(value.toUpperCase())} onFocus={onActivate}
            className="w-20 text-[11px] font-mono bg-transparent outline-none text-gray-700 uppercase tracking-wider" maxLength={7} />
        </div>
        <MiniPreview meta={meta} colors={colors} />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const ICON_OPTIONS = ['Shield', 'Truck', 'RefreshCw', 'Star', 'Headphones', 'Award', 'Package', 'Heart', 'Zap', 'Globe', 'Clock', 'CheckCircle'];

const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: 'brand',        label: 'Brand',        Icon: ImageIcon },
  { id: 'announcement', label: 'Announcement', Icon: Megaphone },
  { id: 'hero',         label: 'Hero Section', Icon: LayoutDashboard },
  { id: 'colors',       label: 'Colors',       Icon: Palette },
  { id: 'social',       label: 'Social',       Icon: Share2 },
  { id: 'features',     label: 'Features',     Icon: Star },
  { id: 'layout',       label: 'Layout',       Icon: AlignLeft },
];

export default function AdminCustomizePage() {
  // ── Committed theme state (what admin panel currently shows) ───────────────
  const {
    colors: committedColors, darkColors: committedDark, darkMode,
    setColor, setDarkColor, setDarkMode,
    customPresets, addCustomPreset, removeCustomPreset, setCustomPresets,
    resetColors, resetDarkColors,
  } = useThemeStore();

  // ── STAGING colors — only live in the preview iframe ──────────────────────
  // Edits here DO NOT change admin panel styles until "Save for All Visitors"
  const [stagingColors,   setStagingColors]   = useState<CustomColors>(() => ({ ...committedColors }));
  const [stagingDark,     setStagingDark]      = useState<CustomColors>(() => ({ ...committedDark }));
  const [stagingDarkMode, setStagingDarkMode]  = useState(darkMode);
  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current) {
      setStagingColors({ ...committedColors });
      setStagingDark({ ...committedDark });
      setStagingDarkMode(darkMode);
      initialized.current = true;
    }
  }, [committedColors, committedDark, darkMode]);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [activeTab,      setActiveTab]      = useState<Tab>('brand');
  const [editMode,       setEditMode]       = useState<'light' | 'dark'>('light');
  const [activeKey,      setActiveKey]      = useState<keyof CustomColors | null>(null);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [savingColors,   setSavingColors]   = useState(false);
  const [showReset,      setShowReset]      = useState(false);
  const [newThemeName,   setNewThemeName]   = useState('');
  const [showNameInput,  setShowNameInput]  = useState(false);

  // ── Settings state ─────────────────────────────────────────────────────────
  const [loaded,  setLoaded]  = useState(false);
  const [saving,  setSaving]  = useState<string | null>(null);
  const [brandName,  setBrandName]  = useState('');
  const [logoUrl,    setLogoUrl]    = useState('');
  const [tagline,    setTagline]    = useState('');
  const [footerNote, setFooterNote] = useState('');
  const [annText, setAnnText] = useState('');
  const [annCode, setAnnCode] = useState('');
  const [heroEyebrow,     setHeroEyebrow]     = useState('');
  const [heroHeadline,    setHeroHeadline]    = useState('');
  const [heroSubheadline, setHeroSubheadline] = useState('');
  const [heroCta1Text, setHeroCta1Text] = useState('');
  const [heroCta1Link, setHeroCta1Link] = useState('');
  const [heroCta2Text, setHeroCta2Text] = useState('');
  const [heroCta2Link, setHeroCta2Link] = useState('');
  const [stats,    setStats]    = useState<StatItem[]>(DEFAULT_SITE_CONFIG.stats);
  const [instagram, setInstagram] = useState('');
  const [facebook,  setFacebook]  = useState('');
  const [twitter,   setTwitter]   = useState('');
  const [whatsapp,  setWhatsapp]  = useState('');
  const [youtube,   setYoutube]   = useState('');
  const [features,       setFeatures]       = useState<FeatureItem[]>(DEFAULT_SITE_CONFIG.features);
  const [productColumns, setProductColumns] = useState('4');
  const [footerStyle,    setFooterStyle]    = useState('dark');

  // ── Load settings + presets ────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([adminApi.settings.getSiteConfig(), adminApi.settings.getLayoutConfig()])
      .then(([siteRes, layoutRes]) => {
        const s = (siteRes.data?.data ?? siteRes.data) as Record<string, string>;
        const l = (layoutRes.data?.data ?? layoutRes.data) as Record<string, string>;
        setBrandName(s['brandName'] ?? DEFAULT_SITE_CONFIG.brandName);
        setLogoUrl(s['logoUrl'] ?? '');
        setTagline(s['tagline'] ?? DEFAULT_SITE_CONFIG.tagline);
        setFooterNote(s['footerNote'] ?? DEFAULT_SITE_CONFIG.footerNote);
        setAnnText(s['announcementText'] ?? DEFAULT_SITE_CONFIG.announcementText);
        setAnnCode(s['announcementCode'] ?? DEFAULT_SITE_CONFIG.announcementCode);
        setHeroEyebrow(s['heroEyebrow'] ?? DEFAULT_SITE_CONFIG.heroEyebrow);
        setHeroHeadline(s['heroHeadline'] ?? DEFAULT_SITE_CONFIG.heroHeadline);
        setHeroSubheadline(s['heroSubheadline'] ?? DEFAULT_SITE_CONFIG.heroSubheadline);
        setHeroCta1Text(s['heroCta1Text'] ?? DEFAULT_SITE_CONFIG.heroCta1Text);
        setHeroCta1Link(s['heroCta1Link'] ?? DEFAULT_SITE_CONFIG.heroCta1Link);
        setHeroCta2Text(s['heroCta2Text'] ?? DEFAULT_SITE_CONFIG.heroCta2Text);
        setHeroCta2Link(s['heroCta2Link'] ?? DEFAULT_SITE_CONFIG.heroCta2Link);
        try { setStats(JSON.parse(s['stats'] ?? '') as StatItem[]); } catch { setStats(DEFAULT_SITE_CONFIG.stats); }
        try {
          const soc = JSON.parse(s['social'] ?? '{}') as Record<string, string>;
          setInstagram(soc['instagram'] ?? ''); setFacebook(soc['facebook'] ?? '');
          setTwitter(soc['twitter'] ?? ''); setWhatsapp(soc['whatsapp'] ?? ''); setYoutube(soc['youtube'] ?? '');
        } catch { /* use defaults */ }
        try { setFeatures(JSON.parse(s['features'] ?? '') as FeatureItem[]); } catch { setFeatures(DEFAULT_SITE_CONFIG.features); }
        setProductColumns(l['productColumns'] ?? DEFAULT_LAYOUT_CONFIG.productColumns);
        setFooterStyle(l['footerStyle'] ?? DEFAULT_LAYOUT_CONFIG.footerStyle);
      }).catch(() => toast.error('Failed to load settings'))
        .finally(() => setLoaded(true));

    api.get('/settings/theme/presets')
      .then(r => { const l = r.data?.data ?? r.data; if (Array.isArray(l)) setCustomPresets(l as CustomPreset[]); })
      .catch(() => {});
  }, [setCustomPresets]);

  // ── Content save helpers (reload preview after each save) ──────────────────
  const reloadPreview = () => setPreviewVersion(v => v + 1);

  async function saveBrand() {
    setSaving('brand');
    try { await adminApi.settings.updateSiteConfig({ brandName, logoUrl, tagline, footerNote }); toast.success('Brand saved'); reloadPreview(); }
    catch { toast.error('Failed to save brand'); } finally { setSaving(null); }
  }
  async function saveAnnouncement() {
    setSaving('ann');
    try { await adminApi.settings.updateSiteConfig({ announcementText: annText, announcementCode: annCode }); toast.success('Announcement saved'); reloadPreview(); }
    catch { toast.error('Failed to save'); } finally { setSaving(null); }
  }
  async function saveHero() {
    setSaving('hero');
    try {
      await adminApi.settings.updateSiteConfig({ heroEyebrow, heroHeadline, heroSubheadline, heroCta1Text, heroCta1Link, heroCta2Text, heroCta2Link, stats: JSON.stringify(stats) });
      toast.success('Hero saved'); reloadPreview();
    } catch { toast.error('Failed to save'); } finally { setSaving(null); }
  }
  async function saveSocial() {
    setSaving('social');
    try { await adminApi.settings.updateSiteConfig({ social: JSON.stringify({ instagram, facebook, twitter, whatsapp, youtube }) }); toast.success('Social links saved'); reloadPreview(); }
    catch { toast.error('Failed to save'); } finally { setSaving(null); }
  }
  async function saveFeatures() {
    setSaving('features');
    try { await adminApi.settings.updateSiteConfig({ features: JSON.stringify(features) }); toast.success('Features saved'); reloadPreview(); }
    catch { toast.error('Failed to save'); } finally { setSaving(null); }
  }
  async function saveLayout() {
    setSaving('layout');
    try { await adminApi.settings.updateLayoutConfig({ productColumns, footerStyle }); toast.success('Layout saved'); reloadPreview(); }
    catch { toast.error('Failed to save'); } finally { setSaving(null); }
  }

  // ── Color save — staging → DB + Zustand (updates admin panel too) ──────────
  const buildPayload = (light: CustomColors, dark: CustomColors, isDark: boolean) => ({
    ...light,
    ...Object.fromEntries(Object.entries(dark).map(([k, v]) => [`dark_${k}`, v])),
    darkMode: String(isDark),
  });

  const handleSaveColors = async () => {
    setSavingColors(true);
    try {
      await api.patch('/settings/theme', buildPayload(stagingColors, stagingDark, stagingDarkMode));
      // Commit staging → Zustand — this is what makes admin panel update too
      (Object.keys(stagingColors) as (keyof CustomColors)[]).forEach(k => setColor(k, stagingColors[k] as string));
      (Object.keys(stagingDark)   as (keyof CustomColors)[]).forEach(k => setDarkColor(k, stagingDark[k] as string));
      setDarkMode(stagingDarkMode);
      toast.success('Theme saved — now live for all visitors and the admin panel');
    } catch { toast.error('Failed to save theme'); }
    finally { setSavingColors(false); }
  };

  const handleFullReset = async () => {
    const ld = DEFAULT_COLORS as unknown as CustomColors;
    const dd = DEFAULT_DARK_COLORS as unknown as CustomColors;
    setStagingColors({ ...ld }); setStagingDark({ ...dd }); setStagingDarkMode(false);
    setShowReset(false);
    try {
      await api.patch('/settings/theme', buildPayload(ld, dd, false));
      resetColors(); resetDarkColors(); setDarkMode(false);
      toast.success('Theme reset to defaults');
    } catch { toast.success('Theme reset locally (save failed)'); }
  };

  const handleResetGroup = (keys: string[]) => {
    const defs = editMode === 'dark' ? DEFAULT_DARK_COLORS : DEFAULT_COLORS;
    if (editMode === 'dark') setStagingDark(prev => { const n = { ...prev }; keys.forEach(k => { (n as Record<string,string>)[k] = defs[k] as string; }); return n; });
    else                     setStagingColors(prev => { const n = { ...prev }; keys.forEach(k => { (n as Record<string,string>)[k] = defs[k] as string; }); return n; });
    toast.success('Group reset to defaults');
  };

  const savePresetsToDb = useCallback(async (p: CustomPreset[]) => {
    await api.patch('/settings/theme/presets', { presets: p });
  }, []);

  const handleAddPreset = async () => {
    const name = newThemeName.trim();
    if (!name) return;
    const preset = addCustomPreset(name, stagingColors);
    try { await savePresetsToDb([...customPresets, preset]); toast.success(`"${name}" saved`); }
    catch { toast.error('Failed to save preset'); }
    setNewThemeName(''); setShowNameInput(false);
  };

  const handleDeletePreset = async (id: string) => {
    removeCustomPreset(id);
    try { await savePresetsToDb(customPresets.filter(p => p.id !== id)); }
    catch { toast.error('Failed to delete preset'); }
  };

  const handleApplyPreset = (id: string, list?: CustomPreset[]) => {
    const all = [...THEME_PRESETS, ...(list ?? customPresets)];
    const p = all.find(x => x.id === id);
    if (!p) return;
    setStagingColors(prev => ({ ...prev, ...(p.colors as Partial<CustomColors>) }));
    toast.success(`${p.name} applied to preview`);
  };

  // Derived
  const editColors   = editMode === 'dark' ? stagingDark   : stagingColors;
  const editDefaults = editMode === 'dark' ? DEFAULT_DARK_COLORS : DEFAULT_COLORS;
  const onEditColor  = (key: keyof CustomColors, val: string) => {
    if (editMode === 'dark') setStagingDark(prev => ({ ...prev, [key]: val }));
    else                     setStagingColors(prev => ({ ...prev, [key]: val }));
  };
  const anyLightModified = Object.keys(DEFAULT_COLORS).some(k => stagingColors[k as keyof CustomColors] !== DEFAULT_COLORS[k]);
  const anyDarkModified  = Object.keys(DEFAULT_DARK_COLORS).some(k => stagingDark[k as keyof CustomColors] !== DEFAULT_DARK_COLORS[k]);
  const anyModified      = anyLightModified || anyDarkModified;

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!loaded) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
          <p className="text-sm text-gray-400">Loading settings…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {showReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Reset entire theme?</p>
                <p className="text-sm text-gray-500 mt-0.5">All colors will return to defaults.</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowReset(false)}>Cancel</Button>
              <Button size="sm" onClick={handleFullReset} className="bg-red-600 hover:bg-red-700 text-white">Yes, reset everything</Button>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 sm:p-6 max-w-[1600px]">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Website Customise</h1>
            <p className="text-sm text-gray-400 mt-1">
              Edit your site content and colors. Changes appear in the preview instantly.
              {activeTab === 'colors' && <> Click <strong className="text-gray-600">Save for All Visitors</strong> to go live.</>}
            </p>
          </div>
          {activeTab === 'colors' && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {anyModified && (
                <Button variant="outline" size="sm" onClick={() => setShowReset(true)} className="h-9 text-xs gap-1.5 text-gray-500">
                  <RotateCcw className="w-3.5 h-3.5" />Reset All
                </Button>
              )}
              <Button size="sm" onClick={handleSaveColors} disabled={savingColors} className="h-9 gap-1.5 text-xs">
                {savingColors ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save for All Visitors
              </Button>
            </div>
          )}
        </div>

        {/* ── Two-column layout ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-[480px_1fr] gap-6 items-start">

          {/* ── LEFT: Tab nav + active section ──────────────────────────── */}
          <div className="space-y-4 min-w-0">

            {/* Tab pills */}
            <div className="flex flex-wrap gap-1.5">
              {TABS.map(({ id, label, Icon }) => (
                <button key={id} type="button" onClick={() => setActiveTab(id)}
                  className={cn('flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all',
                    activeTab === id ? 'bg-gray-900 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300 hover:text-gray-700')}>
                  <Icon className="w-3.5 h-3.5" />{label}
                </button>
              ))}
            </div>

            {/* ── BRAND ─────────────────────────────────────────────────── */}
            {activeTab === 'brand' && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <div><p className="text-base font-bold text-gray-900">Brand Identity</p><p className="text-xs text-gray-400 mt-0.5">Shown in the header, footer, and browser tab</p></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-semibold text-gray-700 mb-1.5">Brand Name</label><input value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="YourBrand" style={inp} /></div>
                  <div><label className="block text-xs font-semibold text-gray-700 mb-1.5">Logo URL</label><input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://…" style={inp} /><p className="text-[11px] text-gray-400 mt-1">Leave blank to use brand initial</p></div>
                </div>
                <div><label className="block text-xs font-semibold text-gray-700 mb-1.5">Tagline</label><textarea value={tagline} onChange={e => setTagline(e.target.value)} style={ta} /></div>
                <div><label className="block text-xs font-semibold text-gray-700 mb-1.5">Footer Note</label><input value={footerNote} onChange={e => setFooterNote(e.target.value)} placeholder="Made with care in India" style={inp} /></div>
                <div className="pt-3 border-t border-gray-100">
                  <button onClick={saveBrand} disabled={saving === 'brand'} className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: 'hsl(var(--primary))' }}>
                    {saving === 'brand' ? 'Saving…' : 'Save & Update Preview'}
                  </button>
                </div>
              </div>
            )}

            {/* ── ANNOUNCEMENT ──────────────────────────────────────────── */}
            {activeTab === 'announcement' && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <div><p className="text-base font-bold text-gray-900">Announcement Bar</p><p className="text-xs text-gray-400 mt-0.5">Shown at the very top of every page</p></div>
                <div><label className="block text-xs font-semibold text-gray-700 mb-1.5">Announcement Text</label><input value={annText} onChange={e => setAnnText(e.target.value)} placeholder="Free shipping on orders above ₹999" style={inp} /></div>
                <div><label className="block text-xs font-semibold text-gray-700 mb-1.5">Promo Code</label><input value={annCode} onChange={e => setAnnCode(e.target.value)} placeholder="WELCOME10" style={inp} /><p className="text-[11px] text-gray-400 mt-1">Leave blank to hide the promo code</p></div>
                <div className="pt-3 border-t border-gray-100">
                  <button onClick={saveAnnouncement} disabled={saving === 'ann'} className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: 'hsl(var(--primary))' }}>
                    {saving === 'ann' ? 'Saving…' : 'Save & Update Preview'}
                  </button>
                </div>
              </div>
            )}

            {/* ── HERO ──────────────────────────────────────────────────── */}
            {activeTab === 'hero' && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <div><p className="text-base font-bold text-gray-900">Homepage Hero</p><p className="text-xs text-gray-400 mt-0.5">Main banner shown at the top of the homepage</p></div>
                <div><label className="block text-xs font-semibold text-gray-700 mb-1.5">Eyebrow Text</label><input value={heroEyebrow} onChange={e => setHeroEyebrow(e.target.value)} placeholder="Festive Collection · 2026" style={inp} /></div>
                <div><label className="block text-xs font-semibold text-gray-700 mb-1.5">Headline</label><textarea value={heroHeadline} onChange={e => setHeroHeadline(e.target.value)} style={ta} /></div>
                <div><label className="block text-xs font-semibold text-gray-700 mb-1.5">Sub-headline</label><textarea value={heroSubheadline} onChange={e => setHeroSubheadline(e.target.value)} style={ta} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-semibold text-gray-700 mb-1.5">Primary CTA Text</label><input value={heroCta1Text} onChange={e => setHeroCta1Text(e.target.value)} style={inp} /></div>
                  <div><label className="block text-xs font-semibold text-gray-700 mb-1.5">Primary CTA Link</label><input value={heroCta1Link} onChange={e => setHeroCta1Link(e.target.value)} style={inp} /></div>
                  <div><label className="block text-xs font-semibold text-gray-700 mb-1.5">Secondary CTA Text</label><input value={heroCta2Text} onChange={e => setHeroCta2Text(e.target.value)} style={inp} /></div>
                  <div><label className="block text-xs font-semibold text-gray-700 mb-1.5">Secondary CTA Link</label><input value={heroCta2Link} onChange={e => setHeroCta2Link(e.target.value)} style={inp} /></div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">Stats Strip</label>
                  <div className="grid grid-cols-2 gap-2">
                    {stats.map((s, i) => (
                      <div key={i} className="flex gap-2 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                        <div className="flex-1"><div className="text-[10px] text-gray-400 mb-1">Value</div><input value={s.value} onChange={e => setStats(stats.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} style={{ ...inp, padding: '5px 8px', fontSize: 13 }} /></div>
                        <div className="flex-1"><div className="text-[10px] text-gray-400 mb-1">Label</div><input value={s.label} onChange={e => setStats(stats.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} style={{ ...inp, padding: '5px 8px', fontSize: 13 }} /></div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="pt-3 border-t border-gray-100">
                  <button onClick={saveHero} disabled={saving === 'hero'} className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: 'hsl(var(--primary))' }}>
                    {saving === 'hero' ? 'Saving…' : 'Save & Update Preview'}
                  </button>
                </div>
              </div>
            )}

            {/* ── COLORS ────────────────────────────────────────────────── */}
            {activeTab === 'colors' && (
              <div className="space-y-5">
                <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-xl p-3.5">
                  <Eye className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    Color changes update the <strong>preview instantly</strong> — they only go live when you click <strong>Save for All Visitors</strong>. Before saving, your admin panel keeps showing the last saved colors.
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Default Theme for New Visitors</p>
                      <p className="text-xs text-gray-400 mt-0.5">Each visitor can toggle their own preference — this sets the default</p>
                    </div>
                    <button type="button" onClick={() => setStagingDarkMode(m => !m)}
                      className={cn('relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none', stagingDarkMode ? 'bg-primary' : 'bg-gray-200')}
                      role="switch" aria-checked={stagingDarkMode}>
                      <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200', stagingDarkMode ? 'translate-x-6' : 'translate-x-1')} />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                    {stagingDarkMode ? <Moon className="w-4 h-4 text-primary" /> : <Sun className="w-4 h-4 text-amber-500" />}
                    <span className="text-sm font-medium text-gray-700">
                      {stagingDarkMode ? 'Dark mode — visitors start in dark mode' : 'Light mode — visitors start in light mode'}
                    </span>
                  </div>

                  <div className="mt-5 pt-5 border-t border-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <div><p className="text-sm font-semibold text-gray-900">Corner Roundness</p><p className="text-xs text-gray-400 mt-0.5">Controls buttons, cards, and inputs</p></div>
                      <span className="text-xs font-mono text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md">{stagingColors.radius}rem</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {(['0','0.25','0.5','0.75','1','1.5'] as const).map(v => (
                        <button key={v} type="button" onClick={() => setStagingColors(c => ({ ...c, radius: v }))} title={`${v}rem`}
                          className={cn('flex-1 h-9 border-2 flex items-center justify-center text-[10px] font-medium transition-all',
                            stagingColors.radius === v ? 'border-primary bg-primary text-primary-foreground' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300')}
                          style={{ borderRadius: `${v}rem` }}>
                          {v === '0' ? '■' : v === '1.5' ? '●' : '▢'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex border-b border-gray-100">
                    {(['light','dark'] as const).map(mode => (
                      <button key={mode} type="button" onClick={() => setEditMode(mode)}
                        className={cn('flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all',
                          editMode === mode
                            ? mode === 'light' ? 'text-amber-600 bg-amber-50 border-b-2 border-amber-400' : 'text-indigo-600 bg-indigo-50 border-b-2 border-indigo-400'
                            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50')}>
                        {mode === 'light' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        {mode === 'light' ? 'Light Mode Colors' : 'Dark Mode Colors'}
                        {(mode === 'light' ? anyLightModified : anyDarkModified) && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                      </button>
                    ))}
                  </div>
                  <div className="px-4 py-3 flex items-center gap-2">
                    <Eye className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <p className="text-[11px] text-gray-400">
                      {editMode === 'dark' ? 'Editing dark mode colors — preview switches to dark automatically' : 'Editing light mode colors — preview shows light mode'}
                    </p>
                  </div>
                </div>

                {GROUPS.map(group => {
                  const groupMeta     = ALL_COLORS.filter(c => (group.keys as readonly string[]).includes(c.key));
                  const groupModified = groupMeta.some(m => (editColors[m.key] as string) !== editDefaults[m.key]);
                  return (
                    <div key={group.key} className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-white">
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg">{group.emoji}</span>
                          <div><p className="text-sm font-bold text-gray-900">{group.label}</p><p className="text-[11px] text-gray-400">{group.hint}</p></div>
                        </div>
                        {groupModified && (
                          <button type="button" onClick={() => handleResetGroup([...group.keys])} className="text-xs text-gray-400 hover:text-primary flex items-center gap-1 transition-colors">
                            <RefreshCw className="w-3 h-3" />Reset group
                          </button>
                        )}
                      </div>
                      <div className="p-3 space-y-2">
                        {groupMeta.map(meta => (
                          <ColorRow key={`${editMode}-${meta.key}`} meta={meta} colors={editColors}
                            defaultValue={editDefaults[meta.key] as string}
                            onChange={v => onEditColor(meta.key, v)}
                            onReset={() => onEditColor(meta.key, editDefaults[meta.key] as string)}
                            isActive={activeKey === meta.key}
                            onActivate={() => setActiveKey(meta.key)}
                            onDeactivate={() => setActiveKey(prev => prev === meta.key ? null : prev)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── SOCIAL ────────────────────────────────────────────────── */}
            {activeTab === 'social' && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <div><p className="text-base font-bold text-gray-900">Social Media</p><p className="text-xs text-gray-400 mt-0.5">Shown in the footer. Leave blank to hide a platform.</p></div>
                {[
                  { label: 'Instagram', value: instagram, set: setInstagram, ph: '@yourbrand or https://instagram.com/yourbrand' },
                  { label: 'Facebook',  value: facebook,  set: setFacebook,  ph: 'https://facebook.com/yourbrand' },
                  { label: 'Twitter / X', value: twitter, set: setTwitter,   ph: 'https://twitter.com/yourbrand' },
                  { label: 'WhatsApp',  value: whatsapp,  set: setWhatsapp,  ph: '+91 98765 43210' },
                  { label: 'YouTube',   value: youtube,   set: setYoutube,   ph: 'https://youtube.com/@yourbrand' },
                ].map(({ label: lbl, value, set, ph }) => (
                  <div key={lbl}><label className="block text-xs font-semibold text-gray-700 mb-1.5">{lbl}</label><input value={value} onChange={e => set(e.target.value)} placeholder={ph} style={inp} /></div>
                ))}
                <div className="pt-3 border-t border-gray-100">
                  <button onClick={saveSocial} disabled={saving === 'social'} className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: 'hsl(var(--primary))' }}>
                    {saving === 'social' ? 'Saving…' : 'Save & Update Preview'}
                  </button>
                </div>
              </div>
            )}

            {/* ── FEATURES ──────────────────────────────────────────────── */}
            {activeTab === 'features' && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <div><p className="text-base font-bold text-gray-900">'Why Choose Us' Features</p><p className="text-xs text-gray-400 mt-0.5">Trust-signal cards shown on the homepage</p></div>
                {features.map((f, i) => (
                  <div key={i} className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                    <div className="text-xs font-semibold text-gray-400 mb-3">Feature {i + 1}</div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div><label className="block text-xs font-semibold text-gray-700 mb-1.5">Icon</label>
                        <select value={f.icon} onChange={e => setFeatures(features.map((x, j) => j === i ? { ...x, icon: e.target.value } : x))} style={{ ...inp, padding: '6px 10px', fontSize: 13 }}>
                          {ICON_OPTIONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                        </select>
                      </div>
                      <div><label className="block text-xs font-semibold text-gray-700 mb-1.5">Title</label><input value={f.title} onChange={e => setFeatures(features.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} style={{ ...inp, fontSize: 13 }} /></div>
                    </div>
                    <div><label className="block text-xs font-semibold text-gray-700 mb-1.5">Description</label><textarea value={f.desc} onChange={e => setFeatures(features.map((x, j) => j === i ? { ...x, desc: e.target.value } : x))} style={{ ...ta, minHeight: 56, fontSize: 13 }} /></div>
                  </div>
                ))}
                <div className="pt-3 border-t border-gray-100">
                  <button onClick={saveFeatures} disabled={saving === 'features'} className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: 'hsl(var(--primary))' }}>
                    {saving === 'features' ? 'Saving…' : 'Save & Update Preview'}
                  </button>
                </div>
              </div>
            )}

            {/* ── LAYOUT ────────────────────────────────────────────────── */}
            {activeTab === 'layout' && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <div><p className="text-base font-bold text-gray-900">Layout & Display</p><p className="text-xs text-gray-400 mt-0.5">Control how products and sections are arranged</p></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-semibold text-gray-700 mb-1.5">Product Grid Columns</label>
                    <select value={productColumns} onChange={e => setProductColumns(e.target.value)} style={inp}>
                      <option value="2">2 Columns</option>
                      <option value="3">3 Columns</option>
                      <option value="4">4 Columns (recommended)</option>
                    </select>
                  </div>
                  <div><label className="block text-xs font-semibold text-gray-700 mb-1.5">Footer Style</label>
                    <select value={footerStyle} onChange={e => setFooterStyle(e.target.value)} style={inp}>
                      <option value="dark">Dark (charcoal background)</option>
                      <option value="light">Light (white background)</option>
                    </select>
                  </div>
                </div>
                <div className="pt-3 border-t border-gray-100">
                  <button onClick={saveLayout} disabled={saving === 'layout'} className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: 'hsl(var(--primary))' }}>
                    {saving === 'layout' ? 'Saving…' : 'Save & Update Preview'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: Live preview + presets ───────────────────────────── */}
          <div className="xl:sticky xl:top-[4.5rem] min-w-0 overflow-hidden xl:max-h-[calc(100vh-4.5rem)] xl:overflow-y-auto xl:pb-4 space-y-3">

            {/* Quick Presets — ALWAYS at top so they're visible without scrolling */}
            {activeTab === 'colors' && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Quick Presets</p>
                  {showNameInput ? (
                    <div className="flex items-center gap-1.5">
                      <input type="text" placeholder="Theme name…" value={newThemeName} onChange={e => setNewThemeName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddPreset(); if (e.key === 'Escape') setShowNameInput(false); }}
                        autoFocus className="text-xs px-2 py-1 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-primary/30 w-28"
                        style={{ background: '#fff', color: '#374151' }} maxLength={30} />
                      <Button type="button" size="sm" onClick={handleAddPreset} disabled={!newThemeName.trim()} className="h-6 px-2 text-[10px]">Save</Button>
                      <button type="button" onClick={() => { setShowNameInput(false); setNewThemeName(''); }} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setShowNameInput(true)}
                      className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-primary transition-colors">
                      <BookmarkPlus className="w-3 h-3" />Save current
                    </button>
                  )}
                </div>

                {/* Built-in presets — horizontal scrollable row of swatches */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                  {THEME_PRESETS.map(preset => {
                    const swatch = preset.colors.primary ?? DEFAULT_COLORS.primary;
                    const active = stagingColors.primary === swatch;
                    return (
                      <button key={preset.id} type="button" onClick={() => handleApplyPreset(preset.id)} title={preset.name}
                        className={cn('flex-shrink-0 flex flex-col items-center gap-1 p-1.5 rounded-xl border-2 transition-all', active ? 'border-primary bg-primary/5' : 'border-transparent hover:border-gray-200')}>
                        <div className="w-8 h-8 rounded-full border border-black/10 shadow-sm relative" style={{ background: swatch }}>
                          {active && <div className="absolute inset-0 flex items-center justify-center"><Check className="w-4 h-4 text-white drop-shadow" /></div>}
                        </div>
                        <span className="text-[9px] font-medium text-gray-500 leading-none w-10 text-center truncate">{preset.name}</span>
                      </button>
                    );
                  })}

                  {/* Custom presets inline */}
                  {customPresets.map(preset => {
                    const swatch = preset.colors.primary ?? DEFAULT_COLORS.primary;
                    const active = stagingColors.primary === swatch;
                    return (
                      <div key={preset.id} className="relative group flex-shrink-0">
                        <button type="button" onClick={() => handleApplyPreset(preset.id, customPresets)} title={preset.name}
                          className={cn('flex flex-col items-center gap-1 p-1.5 rounded-xl border-2 transition-all', active ? 'border-primary bg-primary/5' : 'border-transparent hover:border-gray-200')}>
                          <div className="w-8 h-8 rounded-full border border-black/10 shadow-sm relative" style={{ background: swatch }}>
                            {active && <div className="absolute inset-0 flex items-center justify-center"><Check className="w-4 h-4 text-white drop-shadow" /></div>}
                          </div>
                          <span className="text-[9px] font-medium text-gray-500 leading-none w-10 text-center truncate">{preset.name}</span>
                        </button>
                        <button type="button" onClick={() => handleDeletePreset(preset.id)}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full hidden group-hover:flex items-center justify-center shadow-sm">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Live preview label */}
            <div>
              <p className="text-sm font-bold text-gray-900">Live Preview</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {activeKey
                  ? <>🟡 Highlighted: <span className="font-medium text-gray-600">{ALL_COLORS.find(c => c.key === activeKey)?.name}</span></>
                  : activeTab === 'colors' ? 'Hover a color setting to see what it affects' : 'Content changes reload the preview after saving'}
              </p>
            </div>

            <WebsitePreview
              stagingColors={stagingColors}
              stagingDark={stagingDark}
              activeKey={activeKey}
              previewDark={editMode === 'dark' && activeTab === 'colors'}
              previewVersion={previewVersion}
            />

          </div>
        </div>
      </div>
    </>
  );
}
