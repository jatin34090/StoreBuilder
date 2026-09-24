'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface BannerItem {
  id: string;
  desktopImage: string;
  mobileImage?: string | null;
  title?: string | null;
  subtitle?: string | null;
  ctaText?: string | null;
  ctaUrl?: string | null;
}

interface BannerCarouselProps {
  banners: BannerItem[];
  autoAdvanceMs?: number;
}

export function BannerCarousel({ banners, autoAdvanceMs = 4000 }: BannerCarouselProps) {
  const [current, setCurrent] = useState(0);
  const count = banners.length;

  const prev = useCallback(() => setCurrent((c) => (c - 1 + count) % count), [count]);
  const next = useCallback(() => setCurrent((c) => (c + 1) % count), [count]);

  useEffect(() => {
    if (count <= 1) return;
    const id = setInterval(next, autoAdvanceMs);
    return () => clearInterval(id);
  }, [count, next, autoAdvanceMs]);

  if (count === 0) return null;

  const banner = banners[current];

  return (
    <section className="relative overflow-hidden w-full aspect-[16/7] md:aspect-[21/7] bg-muted">
      {/* Images */}
      {banners.map((b, i) => (
        <div
          key={b.id}
          className={cn(
            'absolute inset-0 transition-opacity duration-700',
            i === current ? 'opacity-100' : 'opacity-0 pointer-events-none',
          )}
        >
          {/* Mobile image */}
          <Image
            src={b.mobileImage ?? b.desktopImage}
            alt={b.title ?? ''}
            fill
            className="object-cover md:hidden"
            priority={i === 0}
            sizes="100vw"
          />
          {/* Desktop image */}
          <Image
            src={b.desktopImage}
            alt={b.title ?? ''}
            fill
            className="object-cover hidden md:block"
            priority={i === 0}
            sizes="100vw"
          />
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/30" />
        </div>
      ))}

      {/* Content */}
      {(banner.title || banner.ctaText) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white p-6 z-10">
          {banner.title && (
            <h2 className="font-display text-2xl md:text-5xl font-normal mb-3 drop-shadow-lg">
              {banner.title}
            </h2>
          )}
          {banner.subtitle && (
            <p className="text-sm md:text-lg text-white/90 mb-6 max-w-lg drop-shadow">
              {banner.subtitle}
            </p>
          )}
          {banner.ctaText && banner.ctaUrl && (
            <Button asChild size="lg" variant="secondary" className="font-medium tracking-wide">
              <Link href={banner.ctaUrl}>{banner.ctaText}</Link>
            </Button>
          )}
        </div>
      )}

      {/* Nav arrows */}
      {count > 1 && (
        <>
          <button
            onClick={prev}
            aria-label="Previous banner"
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={next}
            aria-label="Next banner"
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* Dots */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={cn(
                  'w-2 h-2 rounded-full transition-all',
                  i === current ? 'bg-white scale-125' : 'bg-white/50',
                )}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
