'use client';

import { useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useAdminAuthStore } from '@/store/adminAuthStore';

/**
 * Session validator — runs once on app mount.
 *
 * Strategy:
 *   - If Zustand shows isAuthenticated=true after localStorage rehydration,
 *     call GET /users/me to confirm the server session is still valid.
 *   - On 200: refresh the stored user object (picks up storeId, role changes, etc.)
 *   - On 401/403: clear stale localStorage auth state → UI becomes guest
 *   - On network error (no response): keep stale state — don't log out a valid
 *     user just because the network hiccupped
 *   - If isAuthenticated=false after hydration: skip the call entirely (guest visit)
 *
 * Renders nothing. Place once inside Providers so it runs on every page.
 */
export function AuthBootstrap() {
  const { isAuthenticated, hydrated, setUser, clearUser } = useAuthStore();
  const { clearAdminAuth } = useAdminAuthStore();
  const validated = useRef(false);

  useEffect(() => {
    // Wait for Zustand rehydration to complete before checking state
    if (!hydrated) return;
    // Only validate if Zustand says we're authenticated (avoid pointless calls for guests)
    if (!isAuthenticated) return;
    // Only run once per page load
    if (validated.current) return;
    validated.current = true;

    api
      .get('/users/me')
      .then((res) => {
        const u = res.data?.data ?? res.data;
        if (u?.id) {
          // Refresh with authoritative server data (storeId, role may have changed)
          setUser({
            id:      u.id,
            name:    u.name,
            email:   u.email  ?? undefined,
            phone:   u.phone  ?? undefined,
            avatar:  u.avatar ?? undefined,
            role:    u.role,
            storeId: u.storeId ?? undefined,
          });
        }
      })
      .catch((err: { response?: { status?: number } }) => {
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          // Confirmed invalid session — clear both UI auth caches
          clearUser();
          clearAdminAuth();
        }
        // No response (network error, timeout, server down) → keep stale state
      });
  }, [hydrated, isAuthenticated, setUser, clearUser, clearAdminAuth]);

  return null;
}
