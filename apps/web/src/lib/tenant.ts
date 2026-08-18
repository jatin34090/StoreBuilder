export interface StorePublicInfo {
  id: string;
  name: string;
  slug: string;
  plan: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  customDomain: string | null;
  isActive: boolean;
}

/**
 * Parses the hostname and returns { slug, isCustomDomain }.
 * Subdomain pattern: <slug>.jewellery.yourdomain.in
 * Custom domain: anything that isn't the root domain or www.
 */
export function parseHostname(hostname: string): { slug: string | null; isCustomDomain: boolean } {
  const rootDomain = process.env['NEXT_PUBLIC_ROOT_DOMAIN'] ?? '';

  // Strip port for local dev
  const host = hostname.split(':')[0];

  if (host === rootDomain || host === `www.${rootDomain}`) {
    return { slug: null, isCustomDomain: false };
  }

  if (host.endsWith(`.${rootDomain}`)) {
    const slug = host.slice(0, host.length - rootDomain.length - 1);
    return { slug, isCustomDomain: false };
  }

  // Anything else is a custom domain
  return { slug: null, isCustomDomain: true };
}

export async function fetchStoreBySlug(slug: string): Promise<StorePublicInfo | null> {
  return resolveStore({ slug });
}

export async function fetchStoreByDomain(domain: string): Promise<StorePublicInfo | null> {
  return resolveStore({ domain });
}

async function resolveStore(params: { slug?: string; domain?: string }): Promise<StorePublicInfo | null> {
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';
  const qs = params.slug ? `slug=${params.slug}` : `domain=${params.domain}`;
  try {
    const res = await fetch(`${apiUrl}/stores/public/resolve?${qs}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: StorePublicInfo };
    return json.data ?? null;
  } catch {
    return null;
  }
}
