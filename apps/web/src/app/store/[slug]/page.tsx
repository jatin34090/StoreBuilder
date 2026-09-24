import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { MainLayout } from '@/components/layout/MainLayout';
import { HeroSection } from '@/components/home/HeroSection';
import { CategoryGrid } from '@/components/home/CategoryGrid';
import { FeaturedProducts } from '@/components/home/FeaturedProducts';
import { WhyChooseUs } from '@/components/home/WhyChooseUs';
import { BannersSection } from '@/components/home/BannersSection';
import { ProductGridSkeleton } from '@/components/product/ProductCardSkeleton';
import { fetchSiteConfig } from '@/lib/site-config';

// Dev storefront route: /store/:slug
// In production, stores are served from their subdomain or custom domain.
// Middleware injects x-store-id for both path-based and subdomain-based routing.

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';

interface SectionRow {
  type: string;
  enabled: boolean;
  sortOrder: number;
}

const DEFAULT_SECTIONS: SectionRow[] = [
  { type: 'HERO',              enabled: true, sortOrder: 0 },
  { type: 'BANNERS',           enabled: true, sortOrder: 1 },
  { type: 'CATEGORIES',        enabled: true, sortOrder: 2 },
  { type: 'FEATURED_PRODUCTS', enabled: true, sortOrder: 3 },
  { type: 'WHY_CHOOSE_US',    enabled: true, sortOrder: 4 },
];

async function fetchSections(storeId?: string): Promise<SectionRow[]> {
  try {
    const res = await fetch(`${API_URL}/storefront/homepage`, {
      cache: 'no-store',
      headers: storeId ? { 'x-store-id': storeId } : {},
    });
    if (!res.ok) return DEFAULT_SECTIONS;
    const json = (await res.json()) as unknown;
    const data = Array.isArray(json) ? json : ((json as Record<string, unknown>)['data'] ?? DEFAULT_SECTIONS);
    return Array.isArray(data) ? (data as SectionRow[]) : DEFAULT_SECTIONS;
  } catch {
    return DEFAULT_SECTIONS;
  }
}

async function resolveStore(slug: string) {
  try {
    const res = await fetch(`${API_URL}/stores/public/resolve?slug=${slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { id: string; name: string; slug: string; isActive: boolean } };
    return json.data ?? null;
  } catch {
    return null;
  }
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const headersList = await headers();
  const storeId = headersList.get('x-store-id') ?? undefined;
  const config = await fetchSiteConfig(storeId);
  return {
    title: config.brandName,
    description: config.tagline,
  };
}

export default async function StoreStorefrontPage({ params }: Props) {
  const { slug } = await params;

  // Middleware injects x-store-id for /store/:slug via path-based routing.
  // If x-store-id is not present, resolve the store manually.
  const headersList = await headers();
  let storeId = headersList.get('x-store-id') ?? undefined;

  if (!storeId) {
    const store = await resolveStore(slug);
    if (!store || !store.isActive) notFound();
    storeId = store.id;
  }

  const sections = await fetchSections(storeId);
  const enabled = sections.filter((s) => s.enabled).sort((a, b) => a.sortOrder - b.sortOrder);

  const SECTION_MAP: Record<string, React.ReactNode> = {
    HERO:              <HeroSection />,
    BANNERS:           <BannersSection storeId={storeId} />,
    CATEGORIES:        <CategoryGrid />,
    FEATURED_PRODUCTS: (
      <Suspense fallback={<div className="container py-12"><ProductGridSkeleton count={8} /></div>}>
        <FeaturedProducts />
      </Suspense>
    ),
    WHY_CHOOSE_US: <WhyChooseUs />,
  };

  return (
    <MainLayout>
      {enabled.map((section) => (
        <div key={section.type}>
          {SECTION_MAP[section.type] ?? null}
        </div>
      ))}
    </MainLayout>
  );
}
