'use client';

import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';

/**
 * Where should an authenticated user's "Dashboard" link go?
 *
 * Role mapping (authoritative — mirrors server-side role assignment):
 *   ADMIN + storeId    → /admin          (store owner/admin, onboarding complete)
 *   ADMIN + no storeId → /onboarding     (registered but hasn't created a store yet)
 *   SUPER_ADMIN        → /super-admin
 *   DELIVERY_AGENT     → /agent
 *   CUSTOMER           → /               (storefront shopper; no dashboard to show)
 */
function dashboardHref(role: string | undefined, storeId: string | undefined): string {
  if (role === 'SUPER_ADMIN')    return '/super-admin';
  if (role === 'DELIVERY_AGENT') return '/agent';
  if (role === 'ADMIN') return storeId ? '/admin' : '/onboarding';
  return '/';
}

function ctaLabel(role: string | undefined, storeId: string | undefined): string {
  if (role === 'SUPER_ADMIN')    return 'Dashboard';
  if (role === 'DELIVERY_AGENT') return 'My Deliveries';
  if (role === 'ADMIN') return storeId ? 'Dashboard' : 'Complete Setup';
  return 'Dashboard';
}

/**
 * Auth-aware right side of the landing navbar.
 *
 * Rendering states:
 *   Hydrating:               skeleton (no flash of wrong state)
 *   Guest:                   Sign in  +  Start Free Trial
 *   ADMIN (no store):        Name  +  Complete Setup → /onboarding
 *   ADMIN (with store):      Name  +  Dashboard → /admin
 *   SUPER_ADMIN:             Name  +  Dashboard → /super-admin
 *   DELIVERY_AGENT:          Name  +  My Deliveries → /agent
 *   CUSTOMER (shopper):      Name  +  Dashboard → / (treated as guest for CTA)
 */
export function LandingNavAuth() {
  const { user, isAuthenticated, hydrated } = useAuthStore();

  // Show a neutral skeleton while Zustand rehydrates from localStorage.
  // This prevents the brief "guest → authenticated" flash after JS loads,
  // and also covers the window while AuthBootstrap validates the session.
  if (!hydrated) {
    return (
      <>
        <span className="hidden h-4 w-12 animate-pulse rounded bg-muted md:block" aria-hidden />
        <span className="h-8 w-28 animate-pulse rounded-md bg-muted" aria-hidden />
      </>
    );
  }

  if (isAuthenticated && user) {
    const href  = dashboardHref(user.role, user.storeId);
    const label = ctaLabel(user.role, user.storeId);
    return (
      <>
        <Link
          href={href}
          className="hidden text-sm font-medium text-muted-foreground hover:text-foreground md:block transition-colors"
        >
          {user.name.split(' ')[0]}
        </Link>
        <Button asChild size="sm" className="bg-violet-600 hover:bg-violet-700 text-white">
          <Link href={href}>{label}</Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <Link
        href="/admin/login"
        className="hidden text-sm font-medium text-muted-foreground hover:text-foreground md:block transition-colors"
      >
        Sign in
      </Link>
      <Button asChild size="sm" className="bg-violet-600 hover:bg-violet-700 text-white">
        <Link href="/register">Start Free Trial</Link>
      </Button>
    </>
  );
}
