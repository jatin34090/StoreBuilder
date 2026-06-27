/**
 * Typed client for the delivery-agent API (/agent/* endpoints).
 * Every response is unwrapped from the API's { success, data } envelope.
 */
import api from './api';
import type {
  AgentDelivery,
  AgentProfile,
  DeliveryStatus,
  Paginated,
} from '../types/delivery';

type Envelope<T> = { success: boolean; data: T; message?: string };

async function unwrap<T>(p: Promise<{ data: Envelope<T> }>): Promise<T> {
  const res = await p;
  return res.data.data;
}

export const agentApi = {
  // ─── Profile ───────────────────────────────────────────────────────────────
  getProfile: () => unwrap<AgentProfile>(api.get('/agent/profile')),

  updateProfile: (data: { vehicleType?: string; zones?: string[] }) =>
    unwrap<AgentProfile>(api.patch('/agent/profile', data)),

  setOnline: (isOnline: boolean) =>
    unwrap<{ isOnline: boolean; message: string }>(api.patch('/agent/online', { isOnline })),

  updateLocation: (lat: number, lng: number) =>
    unwrap<{ lat: number; lng: number; updatedAt: string }>(
      api.patch('/agent/location', { lat, lng }),
    ),

  // ─── Deliveries ──────────────────────────────────────────────────────────────
  listDeliveries: async (params?: {
    status?: DeliveryStatus;
    page?: number;
    limit?: number;
  }): Promise<Paginated<AgentDelivery>> => {
    const res = await api.get<Envelope<{ deliveries: AgentDelivery[]; pagination: { page: number; limit: number; total: number } }>>(
      '/agent/deliveries',
      { params },
    );
    const payload = res.data.data;
    return {
      items: payload.deliveries ?? [],
      total: payload.pagination?.total ?? 0,
      page: payload.pagination?.page ?? 1,
      limit: payload.pagination?.limit ?? 20,
    };
  },

  getDelivery: (orderId: string) =>
    unwrap<AgentDelivery>(api.get(`/agent/deliveries/${orderId}`)),

  updateStatus: (orderId: string, status: DeliveryStatus, failureReason?: string) =>
    unwrap<{ status?: DeliveryStatus; message?: string }>(
      api.patch(`/agent/deliveries/${orderId}/status`, { status, ...(failureReason ? { failureReason } : {}) }),
    ),

  verifyOtp: (orderId: string, otp: string) =>
    unwrap<{ message?: string }>(api.post(`/agent/deliveries/${orderId}/verify-otp`, { otp })),
};
