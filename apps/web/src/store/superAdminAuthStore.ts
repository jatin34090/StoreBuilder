'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SuperAdminUser {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN';
}

interface SuperAdminAuthState {
  superAdminUser: SuperAdminUser | null;
  isSuperAdminAuthenticated: boolean;
  setSuperAdminAuth: (user: SuperAdminUser) => void;
  clearSuperAdminAuth: () => void;
}

export const useSuperAdminAuthStore = create<SuperAdminAuthState>()(
  persist(
    (set) => ({
      superAdminUser: null,
      isSuperAdminAuthenticated: false,
      setSuperAdminAuth: (user) => set({ superAdminUser: user, isSuperAdminAuthenticated: true }),
      clearSuperAdminAuth: () => set({ superAdminUser: null, isSuperAdminAuthenticated: false }),
    }),
    { name: 'jewellery-super-admin-auth' },
  ),
);
