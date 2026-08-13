import { Suspense } from 'react';
import type { Metadata } from 'next';
import { MainLayout } from '@/components/layout/MainLayout';
import { HeroSection } from '@/components/home/HeroSection';
import { CategoryGrid } from '@/components/home/CategoryGrid';
import { FeaturedProducts } from '@/components/home/FeaturedProducts';
import { WhyChooseUs } from '@/components/home/WhyChooseUs';
import { ProductGridSkeleton } from '@/components/product/ProductCardSkeleton';
import { fetchSiteConfig } from '@/lib/site-config';

export async function generateMetadata(): Promise<Metadata> {
  const config = await fetchSiteConfig();
  return {
    title: `${config.brandName} Jewellery — Artificial Jewellery Online`,
    description: config.tagline,
  };
}

export default function HomePage() {
  return (
    <MainLayout>
      <HeroSection />
      <CategoryGrid />
      <Suspense fallback={<div className="container py-12"><ProductGridSkeleton count={8} /></div>}>
        <FeaturedProducts />
      </Suspense>
      <WhyChooseUs />
    </MainLayout>
  );
}
