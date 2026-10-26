import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { ProductDetailClient, type ProductDetail } from './ProductDetailClient';
import { getTenant } from '@/lib/get-tenant';

interface Props {
  params: Promise<{ slug: string }>;
}

// Server-side lookup: the request must carry x-store-id, otherwise the API
// resolves the default store and the product is not found.
async function fetchProduct(slug: string): Promise<ProductDetail | null> {
  const apiUrl = process.env['API_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';
  const tenant = await getTenant();
  const res = await fetch(`${apiUrl}/products/${slug}`, {
    headers: tenant ? { 'x-store-id': tenant.id } : {},
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { data?: ProductDetail };
  return json.data ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { slug } = await params;
    const p = await fetchProduct(slug);
    if (!p) return { title: 'Product Not Found' };
    return {
      title: p.metaTitle ?? p.name,
      description: p.metaDesc ?? p.description?.slice(0, 160),
      openGraph: {
        title: p.name,
        description: p.description?.slice(0, 160),
        images: p.images?.[0]?.url ? [{ url: p.images[0].url }] : [],
      },
    };
  } catch {
    return { title: 'Product Not Found' };
  }
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  const product = await fetchProduct(slug);
  if (!product) return notFound();
  return (
    <MainLayout>
      <ProductDetailClient product={product} />
    </MainLayout>
  );
}
