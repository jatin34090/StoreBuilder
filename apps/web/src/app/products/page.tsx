import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { ProductsClient } from './ProductsClient';
import { ProductGridSkeleton } from '@/components/product/ProductCardSkeleton';

export const metadata: Metadata = {
  title: 'Shop Jewellery',
  description: 'Browse our complete collection of artificial jewellery. Filter by category, price, material and more.',
};

export default function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <MainLayout>
      <div className="container py-6">
        <Suspense fallback={<ProductGridSkeleton count={12} />}>
          <ProductsClient searchParams={{}} />
        </Suspense>
      </div>
    </MainLayout>
  );
}
