'use client';

import Link from 'next/link';
import { useRef, useEffect, useCallback, useState } from 'react';

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  image?: string | null;
  _count?: { products: number };
}

const PALETTES = [
  { bg: '#F7EFE3', symbol: '◇', color: '#C4A876' },
  { bg: '#EFF3F6', symbol: '◯', color: '#7A9AB4' },
  { bg: '#F4F1EA', symbol: '✦', color: '#B0995A' },
  { bg: '#F0EEF6', symbol: '◎', color: '#8A76B0' },
  { bg: '#F6F0EE', symbol: '⬡', color: '#B47A7A' },
  { bg: '#EEF6F0', symbol: '△', color: '#6A9A7A' },
  { bg: '#F6F4EE', symbol: '✧', color: '#A89A5A' },
  { bg: '#EEF2F6', symbol: '◈', color: '#7A8AB4' },
];

// Timing constants
const GAP           = 16;   // px gap between cards
const TRANS_MS      = 600;  // smooth CSS transition duration
const AUTO_MS       = 1000; // advance one card every 1 s
const RESUME_DELAY  = 2000; // resume auto-scroll N ms after last interaction

// Responsive card width via CSS — JS reads the actual rendered width via ref
// min(280px, 44vw)  →  ~165 px on 375 px phone  |  280 px on ≥ 637 px desktop
const CARD_WIDTH_CSS = 'min(280px, 44vw)';

function CategoryCard({
  cat,
  paletteIdx,
}: {
  cat: CategoryNode;
  paletteIdx: number;
}) {
  const p = PALETTES[paletteIdx % PALETTES.length]!;
  const hasImage = !!cat.image;

  return (
    <Link href={`/products?category=${cat.slug}`} className="group block h-full">
      <div
        className="relative overflow-hidden rounded aspect-[3/4] flex flex-col transition-all duration-500 group-hover:shadow-xl"
        style={
          hasImage
            ? {
                backgroundImage: `url(${cat.image})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : { backgroundColor: p.bg }
        }
      >
        {/* Palette-only: decorative symbol */}
        {!hasImage && (
          <>
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
              aria-hidden
            >
              <span
                className="font-display transition-all duration-500 group-hover:scale-110"
                style={{ fontSize: '8rem', color: p.color, opacity: 0.15, lineHeight: 1 }}
              >
                {p.symbol}
              </span>
            </div>
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{ background: `linear-gradient(to top, ${p.color}22 0%, transparent 60%)` }}
            />
          </>
        )}

        {/* Image-only: overlays */}
        {hasImage && (
          <>
            {/* Subtle dark veil — lightens on hover to give a "reveal" feel */}
            <div
              className="absolute inset-0 transition-opacity duration-500"
              style={{ background: 'rgba(0,0,0,0.25)' }}
            />
            {/* Bottom gradient so text always readable */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.2) 45%, transparent 100%)',
              }}
            />
            {/* Hover shimmer — brightens the top half */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{ background: 'rgba(255,255,255,0.07)' }}
            />
          </>
        )}

        {/* Text block — palette: centered; image: pinned to bottom */}
        <div
          className={`relative text-center px-4 z-10 ${
            hasImage ? 'mt-auto pb-6' : 'm-auto'
          }`}
        >
          <h3
            className="font-display font-normal mb-1"
            style={{
              fontSize: '1.0625rem',
              color: hasImage ? '#fff' : 'hsl(var(--foreground))',
            }}
          >
            {cat.name}
          </h3>
          {(cat._count?.products ?? 0) > 0 && (
            <p
              className="text-xs mb-3"
              style={{ color: hasImage ? 'rgba(255,255,255,0.72)' : 'hsl(var(--muted-foreground))' }}
            >
              {cat._count!.products} items
            </p>
          )}
          <span
            className="text-xs font-medium"
            style={{
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: hasImage ? 'rgba(255,255,255,0.9)' : p.color,
              opacity: hasImage ? 1 : 0.8,
            }}
          >
            Explore →
          </span>
        </div>
      </div>
    </Link>
  );
}

export function CategoryScroller({ categories }: { categories: CategoryNode[] }) {
  const n = categories.length;

  // ─── State ───────────────────────────────────────────────────────────────
  // Fade-in once positioned to avoid SSR-flash at translateX(0)
  const [ready, setReady] = useState(false);

  // ─── Refs (no re-render) ─────────────────────────────────────────────────
  const trackRef     = useRef<HTMLDivElement>(null);
  const probeRef     = useRef<HTMLDivElement>(null); // first card — measure its width
  const stepRef      = useRef(212);                   // card width + GAP (updated after mount)
  const offsetRef    = useRef(0);
  const isAnim       = useRef(false);
  const isPaused     = useRef(false);
  const isDragging   = useRef(false);
  const dragStart    = useRef({ x: 0, offset: 0 });
  const resumeTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Helpers ─────────────────────────────────────────────────────────────
  /**
   * Apply a translateX to the track.
   * `animated = true`  → smooth CSS transition
   * `animated = false` → instant (no transition)
   */
  const applyTransform = useCallback((offset: number, animated: boolean) => {
    const track = trackRef.current;
    if (!track) return;
    offsetRef.current = offset;
    track.style.transition = animated
      ? `transform ${TRANS_MS}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`
      : 'none';
    track.style.transform = `translateX(${-offset}px)`;
  }, []);

  /**
   * Keep offset inside copy B — the "real" window: [n·step, 2n·step).
   * Adjusting by ±n·step never changes what the user sees because copy A,
   * B, and C are identical — the swap is visually seamless.
   */
  const normalizeOffset = useCallback(
    (offset: number): number => {
      const range = n * stepRef.current;
      let o = offset;
      // Loop until inside [range, 2·range)
      while (o >= 2 * range) o -= range;
      while (o <     range)  o += range;
      return o;
    },
    [n],
  );

  /**
   * Measure the rendered card width (px) and recompute step.
   * Called on mount and on every window resize.
   */
  const measureStep = useCallback(() => {
    const card = probeRef.current;
    if (!card) return;
    const w = card.getBoundingClientRect().width;
    if (w <= 0) return;
    const newStep = w + GAP;
    const prevStep = stepRef.current;
    if (Math.abs(newStep - prevStep) < 1) return; // no meaningful change

    // Rescale current offset proportionally so the visual position is preserved
    const scaled =
      offsetRef.current > 0
        ? Math.round((offsetRef.current / prevStep) * newStep)
        : n * newStep;
    stepRef.current = newStep;
    applyTransform(normalizeOffset(scaled), false);
  }, [n, normalizeOffset, applyTransform]);

  // ─── Initialise on mount ─────────────────────────────────────────────────
  useEffect(() => {
    // First measure, then set initial position (start of copy B), then reveal
    const card = probeRef.current;
    if (card) {
      const w = card.getBoundingClientRect().width;
      if (w > 0) stepRef.current = w + GAP;
    }
    applyTransform(n * stepRef.current, false);
    setReady(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Resize ──────────────────────────────────────────────────────────────
  useEffect(() => {
    window.addEventListener('resize', measureStep, { passive: true });
    return () => window.removeEventListener('resize', measureStep);
  }, [measureStep]);

  // ─── Auto-scroll: advance one card every AUTO_MS ─────────────────────────
  useEffect(() => {
    if (n <= 1) return;
    const timer = setInterval(() => {
      if (isPaused.current || isDragging.current || isAnim.current) return;
      const step = stepRef.current;
      // Always land on the next card boundary strictly ahead of the current
      // position. If the user left the carousel at a partial scroll (e.g. half
      // a card), this first completes that partial card, then on the next tick
      // it advances a full card — exactly the "remaining half first" behaviour.
      const nextBoundary = (Math.floor(offsetRef.current / step) + 1) * step;
      isAnim.current = true;
      // Do NOT normalize here — let the transition run forward into copy C.
      // onTransitionEnd silently snaps it back to the same visual position in
      // copy B, giving a seamless wheel-like loop with no backward jump.
      applyTransform(nextBoundary, true);
    }, AUTO_MS);
    return () => clearInterval(timer);
  }, [n, applyTransform]);

  // ─── Transition-end: normalize offset ────────────────────────────────────
  const onTransitionEnd = useCallback(() => {
    isAnim.current = false;
    const norm = normalizeOffset(offsetRef.current);
    if (norm !== offsetRef.current) {
      applyTransform(norm, false); // instant silent jump to equivalent position
    }
  }, [normalizeOffset, applyTransform]);

  // ─── Pause / resume ──────────────────────────────────────────────────────
  const pauseAuto = useCallback(() => {
    isPaused.current = true;
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  }, []);

  const scheduleResume = useCallback((delay = RESUME_DELAY) => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => { isPaused.current = false; }, delay);
  }, []);

  // ─── Pointer drag ────────────────────────────────────────────────────────
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      pauseAuto();
      isDragging.current = true;
      isAnim.current = false;
      dragStart.current = { x: e.clientX, offset: offsetRef.current };
      applyTransform(offsetRef.current, false); // cancel in-progress animation
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [pauseAuto, applyTransform],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return;
      const delta = dragStart.current.x - e.clientX;
      applyTransform(dragStart.current.offset + delta, false);
    },
    [applyTransform],
  );

  const onPointerUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    // Snap to the nearest card boundary, then normalize into copy B
    const step = stepRef.current;
    const snapped = Math.round(offsetRef.current / step) * step;
    isAnim.current = true;
    applyTransform(snapped, true); // onTransitionEnd normalizes after
    scheduleResume();
  }, [normalizeOffset, applyTransform, scheduleResume]);

  // ─── Horizontal wheel ────────────────────────────────────────────────────
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      // Ignore predominantly-vertical wheel events so page scroll still works
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) * 1.5) return;
      e.preventDefault();
      pauseAuto();
      // Snap to the nearest card boundary in the scroll direction so wheel
      // scroll also moves one card at a time, not raw pixels.
      const step = stepRef.current;
      const direction = e.deltaX >= 0 ? 1 : -1;
      const nearest = Math.round(offsetRef.current / step) * step;
      const next = nearest + direction * step; // onTransitionEnd normalizes after
      if (!isAnim.current) {
        isAnim.current = true;
        applyTransform(next, true);
      }
      scheduleResume();
    },
    [pauseAuto, applyTransform, scheduleResume],
  );

  // ─── Edge case: 0 or 1 category ─────────────────────────────────────────
  if (n === 0) return null;
  if (n === 1) {
    return (
      <div style={{ maxWidth: CARD_WIDTH_CSS, margin: '0 auto' }}>
        <CategoryCard cat={categories[0]!} paletteIdx={0} />
      </div>
    );
  }

  // ─── Triple-buffer: [copy A][copy B (viewport)][copy C]  ─────────────────
  // The user always sees copy B. Copies A & C are the seamless wrap-around
  // buffer. The total track length is 3·n cards; copy B occupies indices n…2n-1.
  const tripled = [...categories, ...categories, ...categories];

  return (
    <div
      className="overflow-hidden cursor-grab active:cursor-grabbing select-none"
      style={{ touchAction: 'pan-y' }} // allow vertical page scroll on touch
      onMouseEnter={pauseAuto}
      onMouseLeave={() => scheduleResume(500)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      <div
        ref={trackRef}
        className="flex"
        style={{
          gap: `${GAP}px`,
          willChange: 'transform',
          // Hide until JS positions the track so there's no SSR flash
          opacity: ready ? 1 : 0,
          transition: ready ? 'opacity 200ms ease' : 'none',
        }}
        onTransitionEnd={onTransitionEnd}
      >
        {tripled.map((cat, i) => {
          const realIdx = i % n; // consistent palette across all copies
          return (
            <div
              key={`${cat.id}-${i}`}
              ref={i === 0 ? probeRef : undefined}
              className="flex-shrink-0"
              style={{ width: CARD_WIDTH_CSS }}
            >
              <CategoryCard cat={cat} paletteIdx={realIdx} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
