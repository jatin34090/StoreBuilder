import { headers } from 'next/headers';
import type { StorePublicInfo } from './tenant';

/**
 * Server-component helper — reads store context set by the middleware.
 * Returns null when running on the root domain (no store in context).
 */
export async function getTenant(): Promise<Pick<StorePublicInfo, 'id' | 'name' | 'slug' | 'plan' | 'logoUrl'> | null> {
  const h = await headers();
  const id = h.get('x-store-id');
  if (!id) return null;

  return {
    id,
    name:    h.get('x-store-name') ?? '',
    slug:    h.get('x-store-slug') ?? '',
    plan:    h.get('x-store-plan') ?? 'FREE',
    logoUrl: h.get('x-store-logo') ?? null,
  };
}
