import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { ProductDetailClient } from './ProductDetailClient';
import { productsApi } from '@/lib/api';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { slug } = await params;
    const res = await productsApi.bySlug(slug);
    const p = res.data.data;
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
  try {
    const { slug } = await params;
    const res = await productsApi.bySlug(slug);
    const product = res.data.data;
    if (!product) return notFound();
    return (
      <MainLayout>
        <ProductDetailClient product={product} />
      </MainLayout>
    );
  } catch {
    return notFound();
  }
}
