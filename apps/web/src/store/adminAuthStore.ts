'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../lib/api';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN';
  avatar?: string;
}

interface AdminAuthState {
  adminUser: AdminUser | null;
  adminToken: string | null;
  isAdminAuthenticated: boolean;
  setAdminAuth: (user: AdminUser, token: string) => void;
  clearAdminAuth: () => void;
}

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set) => ({
      adminUser: null,
      adminToken: null,
      isAdminAuthenticated: false,

      setAdminAuth: (user, token) => {
        // Inject token into axios headers globally
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        set({ adminUser: user, adminToken: token, isAdminAuthenticated: true });
      },

      clearAdminAuth: () => {
        // Remove token from axios headers
        delete api.defaults.headers.common['Authorization'];
        set({ adminUser: null, adminToken: null, isAdminAuthenticated: false });
      },
    }),
    {
      name: 'jewellery-admin-auth',
      onRehydrateStorage: () => (state) => {
        // Re-inject token on page reload
        if (state?.adminToken) {
          api.defaults.headers.common['Authorization'] = `Bearer ${state.adminToken}`;
        }
      },
    },
  ),
);
