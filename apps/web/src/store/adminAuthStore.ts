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

export type StoreRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'STAFF';

export type Permission =
  | 'products.read'    | 'products.create'    | 'products.update'    | 'products.delete'
  | 'categories.read'  | 'categories.create'  | 'categories.update'  | 'categories.delete'
  | 'inventory.read'   | 'inventory.update'
  | 'orders.read'      | 'orders.update'      | 'orders.cancel'
  | 'customers.read'   | 'customers.update'
  | 'coupons.read'     | 'coupons.create'     | 'coupons.update'     | 'coupons.delete'
  | 'reviews.read'     | 'reviews.update'     | 'reviews.delete'
  | 'theme.read'       | 'theme.update'
  | 'website.read'     | 'website.update'
  | 'analytics.read'
  | 'payments.read'    | 'payments.update'
  | 'shipping.read'    | 'shipping.update'
  | 'staff.read'       | 'staff.invite'       | 'staff.update'       | 'staff.remove'
  | 'store.read'       | 'store.update'       | 'store.launch'
  | 'subscription.read'| 'subscription.update';

interface AdminAuthState {
  adminUser: AdminUser | null;
  adminStore: AdminStore | null;
  adminRole: StoreRole | null;
  adminPermissions: Permission[];
  isAdminAuthenticated: boolean;
  setAdminAuth:        (user: AdminUser) => void;
  setAdminStore:       (store: AdminStore) => void;
  setAdminRoleData:    (role: StoreRole, permissions: Permission[]) => void;
  clearAdminAuth:      () => void;
  hasPermission:       (permission: Permission) => boolean;
}

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set, get) => ({
      adminUser:        null,
      adminStore:       null,
      adminRole:        null,
      adminPermissions: [],
      isAdminAuthenticated: false,

      setAdminAuth:     (user)  => set({ adminUser: user, isAdminAuthenticated: true }),
      setAdminStore:    (store) => set({ adminStore: store }),
      setAdminRoleData: (role, permissions) => set({ adminRole: role, adminPermissions: permissions }),

      clearAdminAuth: () => set({
        adminUser: null, adminStore: null, isAdminAuthenticated: false,
        adminRole: null, adminPermissions: [],
      }),

      hasPermission: (permission) => get().adminPermissions.includes(permission),
    }),
    { name: 'jewellery-admin-auth' },
  ),
);
