import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'CUSTOMER' | 'ADMIN' | 'DELIVERY_AGENT' | 'SUPER_ADMIN';

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  role: UserRole;
  /** Populated after onboarding. Absent = user has not yet created a store. */
  storeId?: string;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** True once Zustand has rehydrated from localStorage. Use this to suppress SSR/hydration flicker. */
  hydrated: boolean;
  setUser: (user: AuthUser) => void;
  clearUser: () => void;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      hydrated: false,
      setUser: (user) => set({ user, isAuthenticated: true }),
      clearUser: () => set({ user: null, isAuthenticated: false }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'jewellery-auth',
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);
