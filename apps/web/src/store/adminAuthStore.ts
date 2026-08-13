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

interface AdminAuthState {
  adminUser: AdminUser | null;
  isAdminAuthenticated: boolean;
  setAdminAuth: (user: AdminUser) => void;
  clearAdminAuth: () => void;
}

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set) => ({
      adminUser: null,
      isAdminAuthenticated: false,
      setAdminAuth: (user) => set({ adminUser: user, isAdminAuthenticated: true }),
      clearAdminAuth: () => set({ adminUser: null, isAdminAuthenticated: false }),
    }),
    { name: 'jewellery-admin-auth' },
  ),
);
