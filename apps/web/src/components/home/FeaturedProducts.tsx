import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FeaturedScroller } from './FeaturedScroller';
import { productsApi } from '@/lib/api';
import type { ProductCardProduct } from '@/components/product/ProductCard';

async function getFeaturedProducts(): Promise<ProductCardProduct[]> {
  try {
    const res = await productsApi.featured();
    return res.data.data?.products ?? [];
  } catch {
    return [];
  }
}

export async function FeaturedProducts() {
  const products = await getFeaturedProducts();

  if (products.length === 0) return null;

  return (
    <section className="py-20">
      {/* Section header */}
      <div className="container">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p
              className="text-primary font-medium mb-2"
              style={{ fontSize: '0.7rem', letterSpacing: '0.3em', textTransform: 'uppercase' }}
            >
              Handpicked
            </p>
            <h2 className="font-display font-normal text-foreground text-3xl md:text-4xl">
              Featured Jewellery
            </h2>
          </div>
          <Button
            variant="ghost"
            asChild
            className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
          >
            <Link href="/products?featured=true">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Horizontal carousel — same mechanics as Shop by Category */}
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <FeaturedScroller products={products} />
      </div>

      <div className="flex justify-center mt-8 sm:hidden container">
        <Button variant="outline" asChild>
          <Link href="/products?featured=true">View all featured</Link>
        </Button>
      </div>
    </section>
  );
}
