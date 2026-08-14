'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN';
  avatar?: string;
}

export interface AdminStore {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  businessName?: string | null;
  industry?: string | null;
  logoUrl?: string | null;
}

interface AdminAuthState {
  adminUser: AdminUser | null;
  adminStore: AdminStore | null;
  isAdminAuthenticated: boolean;
  setAdminAuth: (user: AdminUser) => void;
  setAdminStore: (store: AdminStore) => void;
  clearAdminAuth: () => void;
}

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set) => ({
      adminUser: null,
      adminStore: null,
      isAdminAuthenticated: false,
      setAdminAuth:  (user)  => set({ adminUser: user, isAdminAuthenticated: true }),
      setAdminStore: (store) => set({ adminStore: store }),
      clearAdminAuth: () => set({ adminUser: null, adminStore: null, isAdminAuthenticated: false }),
    }),
    { name: 'jewellery-admin-auth' },
  ),
);
