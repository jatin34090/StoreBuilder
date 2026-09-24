import { BannerCarousel, type BannerItem } from './BannerCarousel';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';

async function fetchActiveBanners(storeId?: string): Promise<BannerItem[]> {
  try {
    const res = await fetch(`${API_URL}/banners`, {
      cache: 'no-store',
      headers: storeId ? { 'x-store-id': storeId } : {},
    });
    if (!res.ok) return [];
    const json = (await res.json()) as unknown;
    const data = Array.isArray(json) ? json : ((json as Record<string, unknown>)['data'] ?? []);
    return Array.isArray(data) ? (data as BannerItem[]) : [];
  } catch {
    return [];
  }
}

interface BannersSectionProps {
  storeId?: string;
}

export async function BannersSection({ storeId }: BannersSectionProps) {
  const banners = await fetchActiveBanners(storeId);
  if (banners.length === 0) return null;
  return <BannerCarousel banners={banners} />;
}
