import { Suspense } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { HeroSection } from '@/components/home/HeroSection';
import { CategoryGrid } from '@/components/home/CategoryGrid';
import { FeaturedProducts } from '@/components/home/FeaturedProducts';
import { WhyChooseUs } from '@/components/home/WhyChooseUs';
import { ThemePreviewBridge } from '@/components/ThemePreviewBridge';
import { ProductGridSkeleton } from '@/components/product/ProductCardSkeleton';

export default function StorefrontPreviewPage() {
  return (
    <MainLayout>
      <ThemePreviewBridge />
      <HeroSection />
      <CategoryGrid />
      <Suspense fallback={<div className="container py-12"><ProductGridSkeleton count={8} /></div>}>
        <FeaturedProducts />
      </Suspense>
      <WhyChooseUs />
    </MainLayout>
  );
}
