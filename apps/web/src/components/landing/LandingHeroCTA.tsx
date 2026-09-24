'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';

function primaryHref(role: string | undefined, storeId: string | undefined): string {
  if (role === 'SUPER_ADMIN')    return '/super-admin';
  if (role === 'DELIVERY_AGENT') return '/agent';
  if (role === 'ADMIN') return storeId ? '/admin' : '/onboarding';
  return '/register';
}

function primaryLabel(role: string | undefined, storeId: string | undefined, isAuthenticated: boolean): string {
  if (!isAuthenticated) return 'Start Free Trial';
  if (role === 'SUPER_ADMIN' || (role === 'ADMIN' && storeId)) return 'Go to Dashboard';
  if (role === 'ADMIN' && !storeId) return 'Complete Setup';
  if (role === 'DELIVERY_AGENT') return 'My Deliveries';
  return 'Start Free Trial';
}

/**
 * Auth-aware hero CTA button.
 *
 * Guest:                   Start Free Trial → /register
 * ADMIN (no store yet):    Complete Setup → /onboarding
 * ADMIN (with store):      Go to Dashboard → /admin
 * SUPER_ADMIN:             Go to Dashboard → /super-admin
 * DELIVERY_AGENT:          My Deliveries → /agent
 * CUSTOMER (shopper):      Start Free Trial → /register (they don't have stores)
 */
export function LandingHeroCTA() {
  const { user, isAuthenticated, hydrated } = useAuthStore();

  // While hydrating: render the guest version (stable, no flash)
  const href  = hydrated ? primaryHref(user?.role, user?.storeId) : '/register';
  const label = hydrated ? primaryLabel(user?.role, user?.storeId, isAuthenticated) : 'Start Free Trial';
  const showSignIn = hydrated && !isAuthenticated;

  return (
    <>
      <div className="flex flex-wrap justify-center gap-4">
        <Button asChild size="lg" className="gap-2 bg-violet-600 hover:bg-violet-700 text-white px-8">
          <Link href={href}>
            {label} <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="px-8">
          <a href="#pricing">View Pricing</a>
        </Button>
      </div>

      {showSignIn && (
        <p className="mt-5 text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/auth/login" className="font-medium text-violet-600 hover:underline dark:text-violet-400">
            Sign in
          </Link>
        </p>
      )}
    </>
  );
}
