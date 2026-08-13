import { api } from './api';

export type DeliveryStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'FAILED';

export const NEXT_STATUS: Partial<Record<DeliveryStatus, DeliveryStatus>> = {
  ASSIGNED:         'PICKED_UP',
  PICKED_UP:        'IN_TRANSIT',
  IN_TRANSIT:       'OUT_FOR_DELIVERY',
};

export const STATUS_LABEL: Record<DeliveryStatus, string> = {
  PENDING:          'Pending',
  ASSIGNED:         'Assigned',
  PICKED_UP:        'Picked Up',
  IN_TRANSIT:       'In Transit',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED:        'Delivered',
  FAILED:           'Failed',
};

export const agentApi = {
  profile:       () => api.get('/agent/profile'),
  toggleOnline:  (isOnline: boolean) => api.patch('/agent/online', { isOnline }),

  deliveries:    (params?: Record<string, unknown>) => api.get('/agent/deliveries', { params }),
  getDelivery:   (orderId: string) => api.get(`/agent/deliveries/${orderId}`),
  updateStatus:  (orderId: string, status: DeliveryStatus, failureReason?: string) =>
    api.patch(`/agent/deliveries/${orderId}/status`, { status, failureReason }),
  verifyOtp:     (orderId: string, otp: string) =>
    api.post(`/agent/deliveries/${orderId}/verify-otp`, { otp }),

  // COD remittance
  codCollect:       (orderId: string) => api.patch(`/agent/deliveries/${orderId}/cod-collect`),
  getRemittances:   () => api.get('/agent/remittances'),
  submitRemittance: (notes?: string) => api.post('/agent/remittances', { notes }),
};
