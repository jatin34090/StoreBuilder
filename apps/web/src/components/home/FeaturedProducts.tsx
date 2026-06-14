import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductCard } from '@/components/product/ProductCard';
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
    <section className="container py-14">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">Featured Jewellery</h2>
          <p className="text-muted-foreground mt-1">Our most loved pieces, handpicked for you</p>
        </div>
        <Button variant="ghost" asChild className="hidden sm:flex">
          <Link href="/products?featured=true">
            View all <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      <div className="flex justify-center mt-8 sm:hidden">
        <Button variant="outline" asChild>
          <Link href="/products?featured=true">View all featured</Link>
        </Button>
      </div>
    </section>
  );
}
