import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { parseHostname } from './lib/tenant';

const SKIP_PREFIXES = ['/_next/', '/api/', '/favicon.ico', '/manifest.json', '/icons/'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip static assets and internal Next.js routes
  if (SKIP_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const hostname = req.headers.get('host') ?? '';
  const host = hostname.split(':')[0];

  // localhost and 127.0.0.1 are always treated as the platform root for path routing purposes.
  // parseHostname would classify them as custom domains (they're neither the root domain
  // nor a subdomain of it), which would block path-based /store/:slug routing in dev.
  const isLocalhost = host === 'localhost' || host === '127.0.0.1';
  const { slug: hostnameSlug, isCustomDomain: _isCustomDomain } = parseHostname(hostname);
  const isCustomDomain = isLocalhost ? false : _isCustomDomain;

  // Path-based dev store routing: /store/:slug → inject store context
  // This lets developers access storefront without subdomains on localhost.
  const pathSlugMatch = !hostnameSlug && !isCustomDomain && pathname.match(/^\/store\/([a-z0-9-]+)(\/.*)?$/);
  const slug = hostnameSlug ?? (pathSlugMatch ? pathSlugMatch[1] : null);

  if (!slug && !isCustomDomain) {
    // Root domain / localhost — platform routes (landing, pricing, login, register, onboarding, admin, super-admin)
    return NextResponse.next();
  }

  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';
  const qs = slug ? `slug=${slug}` : `domain=${encodeURIComponent(hostname.split(':')[0])}`;

  let store: { id: string; name: string; slug: string; plan: string; logoUrl: string | null; isActive: boolean } | null = null;

  try {
    const res = await fetch(`${apiUrl}/stores/public/resolve?${qs}`, {
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const json = await res.json() as { data?: typeof store };
      store = json.data ?? null;
    }
  } catch {
    // Network error — let request through, server components will handle gracefully
  }

  if (!store) {
    // Store not found — serve platform 404
    return NextResponse.next();
  }

  // Check if the store is suspended (hard block) or just in SETUP (allow preview for owner)
  if (!store.isActive) {
    // Allow owner preview: if the request carries the admin access_token cookie,
    // let them through with a preview header so the storefront can show a "Preview" banner.
    const hasAdminCookie = !!req.cookies.get('access_token');
    if (!hasAdminCookie) {
      return new NextResponse(
        JSON.stringify({ statusCode: 503, message: 'This store is not yet published' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      );
    }
    // Owner preview — fall through with x-store-preview header set
  }

  // Propagate store context to server components via headers
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-store-id',   store.id);
  requestHeaders.set('x-store-slug', store.slug);
  requestHeaders.set('x-store-name', store.name);
  requestHeaders.set('x-store-plan', store.plan);
  if (!store.isActive) requestHeaders.set('x-store-preview', '1');
  if (store.logoUrl) requestHeaders.set('x-store-logo', store.logoUrl);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // Set a client-readable cookie so the axios interceptor can pick up the storeId
  response.cookies.set('store-id', store.id, {
    path: '/',
    sameSite: 'lax',
    httpOnly: false, // must be readable by JS for axios interceptor
    secure: process.env.NODE_ENV === 'production',
    maxAge: 3600,
  });

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
