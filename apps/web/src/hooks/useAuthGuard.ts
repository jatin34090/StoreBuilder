'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

/**
 * Guards a page behind authentication.
 *
 * localStorage persist is synchronous, so by the time any useEffect runs
 * on the client Zustand has already restored state. We just need to skip
 * the very first SSR render (where window/localStorage don't exist) before
 * we check auth and potentially redirect.
 */
export function useAuthGuard(redirectPath: string) {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated) {
      router.replace(redirectPath);
    }
  }, [mounted, isAuthenticated, redirectPath, router]);

  return { isAuthenticated, hydrated: mounted };
}
