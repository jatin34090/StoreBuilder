import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-purple-800 to-brand-700 text-white">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-gold-500/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-purple-500/5 blur-3xl" />
      </div>

      <div className="relative container py-20 md:py-32 flex flex-col items-center text-center gap-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-1.5 text-sm backdrop-blur-sm">
          <Sparkles className="h-3.5 w-3.5 text-gold-400" />
          <span>New Collection — Festive 2026</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-balance max-w-3xl leading-tight font-display">
          Jewellery that tells{' '}
          <span className="text-gold-400">your story</span>
        </h1>

        <p className="text-lg md:text-xl text-white/80 max-w-xl text-balance">
          Handpicked artificial jewellery for every occasion. Hypoallergenic, affordable, and crafted to last.
        </p>

        <div className="flex flex-wrap gap-3 justify-center">
          <Button size="xl" variant="gold" asChild>
            <Link href="/products">
              Shop Now <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
          <Button size="xl" variant="outline" className="border-white/30 text-white hover:bg-white/10 hover:text-white bg-transparent" asChild>
            <Link href="/products?featured=true">View Featured</Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-8 justify-center mt-4 pt-8 border-t border-white/10 w-full">
          {[
            { value: '5,000+', label: 'Happy Customers' },
            { value: '500+',   label: 'Designs' },
            { value: '4.8★',   label: 'Avg. Rating' },
            { value: '₹999+',  label: 'Free Shipping' },
          ].map(({ value, label }) => (
            <div key={label} className="text-center">
              <div className="text-2xl font-bold text-gold-400">{value}</div>
              <div className="text-sm text-white/70">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
