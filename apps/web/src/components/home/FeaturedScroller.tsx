'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { ProductCard } from '@/components/product/ProductCard';
import type { ProductCardProduct } from '@/components/product/ProductCard';

// ─── Timing / sizing (mirrors CategoryScroller) ───────────────────────────────
const GAP          = 16;   // px
const TRANS_MS     = 900;  // CSS transition duration
const AUTO_MS      = 2500; // advance one card every 2.5 s
const RESUME_DELAY = 2000; // resume after interaction

// Responsive card width — shows ~2 on mobile, ~3 on tablet, ~4 on desktop
const CARD_WIDTH_CSS = 'min(260px, 44vw)';

export function FeaturedScroller({ products }: { products: ProductCardProduct[] }) {
  const n = products.length;

  const [ready, setReady] = useState(false);

  const trackRef    = useRef<HTMLDivElement>(null);
  const probeRef    = useRef<HTMLDivElement>(null);
  const stepRef     = useRef(276);
  const offsetRef   = useRef(0);
  const isAnim      = useRef(false);
  const isPaused    = useRef(false);
  const isDragging  = useRef(false);
  const dragStart   = useRef({ x: 0, offset: 0 });
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Core helpers ─────────────────────────────────────────────────────────
  const applyTransform = useCallback((offset: number, animated: boolean) => {
    const track = trackRef.current;
    if (!track) return;
    offsetRef.current = offset;
    track.style.transition = animated
      ? `transform ${TRANS_MS}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`
      : 'none';
    track.style.transform = `translateX(${-offset}px)`;
  }, []);

  const normalizeOffset = useCallback((offset: number): number => {
    const range = n * stepRef.current;
    let o = offset;
    while (o >= 2 * range) o -= range;
    while (o <     range)  o += range;
    return o;
  }, [n]);

  const measureStep = useCallback(() => {
    const card = probeRef.current;
    if (!card) return;
    const w = card.getBoundingClientRect().width;
    if (w <= 0) return;
    const newStep = w + GAP;
    const prev = stepRef.current;
    if (Math.abs(newStep - prev) < 1) return;
    const scaled = offsetRef.current > 0
      ? Math.round((offsetRef.current / prev) * newStep)
      : n * newStep;
    stepRef.current = newStep;
    applyTransform(normalizeOffset(scaled), false);
  }, [n, normalizeOffset, applyTransform]);

  // ─── Mount ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const card = probeRef.current;
    if (card) {
      const w = card.getBoundingClientRect().width;
      if (w > 0) stepRef.current = w + GAP;
    }
    applyTransform(n * stepRef.current, false);
    setReady(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.addEventListener('resize', measureStep, { passive: true });
    return () => window.removeEventListener('resize', measureStep);
  }, [measureStep]);

  // ─── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (n <= 1) return;
    const timer = setInterval(() => {
      if (isPaused.current || isDragging.current || isAnim.current) return;
      const step = stepRef.current;
      // Next card boundary strictly ahead — handles partial positions first
      const nextBoundary = (Math.floor(offsetRef.current / step) + 1) * step;
      isAnim.current = true;
      applyTransform(nextBoundary, true);
    }, AUTO_MS);
    return () => clearInterval(timer);
  }, [n, applyTransform]);

  // ─── Transition end: silent normalize ─────────────────────────────────────
  const onTransitionEnd = useCallback(() => {
    isAnim.current = false;
    const norm = normalizeOffset(offsetRef.current);
    if (norm !== offsetRef.current) applyTransform(norm, false);
  }, [normalizeOffset, applyTransform]);

  // ─── Pause / resume ───────────────────────────────────────────────────────
  const pauseAuto = useCallback(() => {
    isPaused.current = true;
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  }, []);

  const scheduleResume = useCallback((delay = RESUME_DELAY) => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => { isPaused.current = false; }, delay);
  }, []);

  // ─── Pointer drag ─────────────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    pauseAuto();
    isDragging.current = true;
    isAnim.current = false;
    dragStart.current = { x: e.clientX, offset: offsetRef.current };
    applyTransform(offsetRef.current, false);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [pauseAuto, applyTransform]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    applyTransform(dragStart.current.offset + (dragStart.current.x - e.clientX), false);
  }, [applyTransform]);

  const onPointerUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const step = stepRef.current;
    const snapped = Math.round(offsetRef.current / step) * step;
    isAnim.current = true;
    applyTransform(snapped, true);
    scheduleResume();
  }, [applyTransform, scheduleResume]);

  // ─── Horizontal wheel ─────────────────────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX) * 1.5) return;
    e.preventDefault();
    pauseAuto();
    const step = stepRef.current;
    const direction = e.deltaX >= 0 ? 1 : -1;
    const nearest = Math.round(offsetRef.current / step) * step;
    const next = nearest + direction * step;
    if (!isAnim.current) {
      isAnim.current = true;
      applyTransform(next, true);
    }
    scheduleResume();
  }, [pauseAuto, applyTransform, scheduleResume]);

  if (n === 0) return null;
  if (n === 1) {
    return (
      <div style={{ maxWidth: CARD_WIDTH_CSS, margin: '0 auto' }}>
        <ProductCard product={products[0]!} />
      </div>
    );
  }

  // Triple-buffer for seamless infinite loop
  const tripled = [...products, ...products, ...products];

  return (
    <div
      className="overflow-hidden cursor-grab active:cursor-grabbing select-none"
      style={{ touchAction: 'pan-y' }}
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
          opacity: ready ? 1 : 0,
          transition: ready ? 'opacity 200ms ease' : 'none',
        }}
        onTransitionEnd={onTransitionEnd}
      >
        {tripled.map((product, i) => (
          <div
            key={`${product.id}-${i}`}
            ref={i === 0 ? probeRef : undefined}
            className="flex-shrink-0"
            style={{ width: CARD_WIDTH_CSS }}
          >
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </div>
  );
}
