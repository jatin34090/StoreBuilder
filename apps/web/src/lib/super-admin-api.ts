import axios from 'axios';
import { useSuperAdminAuthStore } from '@/store/superAdminAuthStore';

const superAdminApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  withCredentials: true,
});

superAdminApi.interceptors.request.use((config) => {
  // Token injected from store — safe because this runs client-side only
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('jewellery-super-admin-auth');
    if (raw) {
      try {
        const state = JSON.parse(raw) as { state?: { superAdminUser?: { token?: string } } };
        const token = state?.state?.superAdminUser?.token;
        if (token) config.headers.Authorization = `Bearer ${token}`;
      } catch { /* ignore */ }
    }
  }
  return config;
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlatformOverview {
  totalStores: number;
  activeStores: number;
  storesByPlan: Record<string, number>;
  totalRevenue: number;
  recentApiLogs: {
    storeId: string;
    path: string;
    method: string;
    statusCode: number;
    durationMs: number;
    createdAt: string;
  }[];
}

export interface StoreRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  isActive: boolean;
  customDomain?: string;
  logoUrl?: string;
  createdAt: string;
  quota?: { productCount: number; orderCount: number; storageBytes: number; apiCallsToday: number };
  _count: { users: number; products: number; orders: number };
}

export interface StoreDetail extends StoreRow {
  settings: { key: string; value: string }[];
  users: { id: string; role: string; user: { id: string; name: string; email: string; phone?: string } }[];
}

export interface StoreUsage {
  store: { id: string; name: string; slug: string; plan: string; isActive: boolean };
  quota: { productCount: number; orderCount: number; storageBytes: number; apiCallsToday: number } | null;
  limits: { maxProducts: number; maxOrders: number | null; maxStorageGB: number; maxStaff: number } | null;
  computed: { orderCountThisMonth: number; totalRevenue: number };
}

// ─── API functions ────────────────────────────────────────────────────────────

export const superAdminApiClient = {
  getOverview: () =>
    superAdminApi.get<{ data: PlatformOverview }>('/super-admin/stores/overview').then((r) => r.data?.data ?? r.data),

  listStores: (params?: { page?: number; limit?: number; search?: string; plan?: string; isActive?: boolean }) =>
    superAdminApi.get<{ stores: StoreRow[]; pagination: { page: number; limit: number; total: number } }>(
      '/super-admin/stores', { params }
    ).then((r) => r.data),

  getStore: (id: string) =>
    superAdminApi.get<{ data?: StoreDetail } & StoreDetail>(`/super-admin/stores/${id}`)
      .then((r) => (r.data as { data?: StoreDetail }).data ?? r.data as unknown as StoreDetail),

  getUsage: (id: string) =>
    superAdminApi.get<{ data?: StoreUsage } & StoreUsage>(`/super-admin/stores/${id}/usage`)
      .then((r) => (r.data as { data?: StoreUsage }).data ?? r.data as unknown as StoreUsage),

  updateStore: (id: string, data: { plan?: string; isActive?: boolean; name?: string; customDomain?: string }) =>
    superAdminApi.patch(`/super-admin/stores/${id}`, data).then((r) => r.data),

  suspend: (id: string) =>
    superAdminApi.patch(`/super-admin/stores/${id}/suspend`).then((r) => r.data),

  reinstate: (id: string) =>
    superAdminApi.patch(`/super-admin/stores/${id}/reinstate`).then((r) => r.data),
};

export { superAdminApi };
