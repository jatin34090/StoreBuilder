'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

/**
 * Waits for Zustand's persist middleware to finish reading from localStorage
 * before checking auth state. Without this, the redirect fires during the
 * initial render when isAuthenticated is still the default (false), even if
 * the user just logged in.
 */
export function useAuthGuard(redirectPath: string) {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [hydrated, setHydrated] = useState(
    () => useAuthStore.persist.hasHydrated(),
  );

  useEffect(() => {
    if (hydrated) return;
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    // Re-check in case hydration finished between render and this effect
    if (useAuthStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, [hydrated]);

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.replace(redirectPath);
    }
  }, [hydrated, isAuthenticated, redirectPath, router]);

  return { isAuthenticated, hydrated };
}
