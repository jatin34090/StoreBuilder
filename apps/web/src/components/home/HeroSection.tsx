import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchSiteConfig, DEFAULT_SITE_CONFIG, DEFAULT_STATS } from '@/lib/site-config';

export async function HeroSection() {
  let config = DEFAULT_SITE_CONFIG;
  try {
    const fetched = await fetchSiteConfig();
    if (fetched && typeof fetched === 'object') config = fetched;
  } catch {
    // fall through to defaults
  }

  const stats = Array.isArray(config.stats) ? config.stats : DEFAULT_STATS;

  return (
    <section data-tv="background" className="relative overflow-hidden bg-background">
      <div
        data-tv="primary"
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% -10%, hsl(var(--primary) / 0.08) 0%, transparent 70%)',
        }}
      />

      <div className="container relative pt-24 md:pt-36 pb-0">
        {/* Eyebrow */}
        {config.heroEyebrow && (
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="h-px w-14 bg-primary/40" />
            <span
              className="text-xs font-medium text-primary"
              style={{ letterSpacing: '0.25em', textTransform: 'uppercase' }}
            >
              {config.heroEyebrow}
            </span>
            <div className="h-px w-14 bg-primary/40" />
          </div>
        )}

        {/* Headline */}
        <h1
          className="font-display text-center font-normal text-balance text-foreground mb-6"
          style={{ fontSize: 'clamp(2.5rem, 8vw, 5.5rem)', lineHeight: 1.05 }}
        >
          {config.heroHeadline || DEFAULT_SITE_CONFIG.heroHeadline}
        </h1>

        {/* Sub-headline */}
        {(config.heroSubheadline || DEFAULT_SITE_CONFIG.heroSubheadline) && (
          <p
            className="text-center text-muted-foreground leading-relaxed max-w-lg mx-auto mb-10"
            style={{ fontSize: '1.0625rem' }}
          >
            {config.heroSubheadline || DEFAULT_SITE_CONFIG.heroSubheadline}
          </p>
        )}

        {/* CTAs */}
        <div className="flex flex-wrap gap-3 justify-center mb-20">
          <Button size="lg" asChild className="px-8 tracking-wide">
            <Link href={config.heroCta1Link || '/products'}>
              {config.heroCta1Text || 'Shop Collection'}{' '}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild className="px-8 tracking-wide">
            <Link href={config.heroCta2Link || '/products?featured=true'}>
              {config.heroCta2Text || 'View Featured'}
            </Link>
          </Button>
        </div>

        {/* Stats strip */}
        {stats.length > 0 && (
          <div
            className="grid overflow-hidden rounded border border-border/60"
            style={{ gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, 1fr)` }}
          >
            {stats.map(({ value, label }, i) => (
              <div
                key={i}
                className={cn(
                  'bg-card text-center py-6 px-4',
                  i > 0 && 'border-l border-border/60',
                )}
              >
                <div className="font-display text-2xl md:text-3xl text-primary mb-0.5">{value}</div>
                <div
                  className="text-muted-foreground"
                  style={{ fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase' }}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
