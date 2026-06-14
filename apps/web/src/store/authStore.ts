import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'CUSTOMER' | 'ADMIN' | 'DELIVERY_AGENT';

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  role: UserRole;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  setUser: (user: AuthUser) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: true }),
      clearUser: () => set({ user: null, isAuthenticated: false }),
    }),
    { name: 'jewellery-auth' },
  ),
);
