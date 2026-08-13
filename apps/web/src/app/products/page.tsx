import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { ProductsClient } from './ProductsClient';
import { ProductGridSkeleton } from '@/components/product/ProductCardSkeleton';
import { fetchLayoutConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Shop Jewellery',
  description: 'Browse our complete collection of artificial jewellery. Filter by category, price, material and more.',
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const layout = await fetchLayoutConfig();
  const columns = (layout.productColumns ?? '4') as '2' | '3' | '4';

  return (
    <MainLayout>
      <div className="container py-6">
        <Suspense fallback={<ProductGridSkeleton count={12} />}>
          <ProductsClient searchParams={{}} columns={columns} />
        </Suspense>
      </div>
    </MainLayout>
  );
}
