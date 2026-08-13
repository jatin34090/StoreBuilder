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
  const { slug, isCustomDomain } = parseHostname(hostname);

  if (!slug && !isCustomDomain) {
    // Root domain — platform routes, no store context
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
      store = await res.json();
    }
  } catch {
    // Network error — let request through, server components will handle gracefully
  }

  if (!store) {
    // Store not found — serve platform 404
    return NextResponse.next();
  }

  if (!store.isActive) {
    return new NextResponse(
      JSON.stringify({ statusCode: 503, message: 'This store is currently suspended' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Propagate store context to server components via headers
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-store-id',   store.id);
  requestHeaders.set('x-store-slug', store.slug);
  requestHeaders.set('x-store-name', store.name);
  requestHeaders.set('x-store-plan', store.plan);
  if (store.logoUrl) requestHeaders.set('x-store-logo', store.logoUrl);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // Set a client-readable cookie so the axios interceptor can pick up the storeId
  response.cookies.set('store-id', store.id, {
    path: '/',
    sameSite: 'lax',
    httpOnly: false, // must be readable by JS
    maxAge: 60,
  });

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
