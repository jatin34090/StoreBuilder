/**
 * Delivery domain types for the agent app. These mirror the API response
 * shapes returned by the /agent/* endpoints (see apps/api delivery module).
 */

export type DeliveryStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'FAILED';

export type DeliveryType = 'SELF' | 'THIRD_PARTY';

export interface DeliveryAddress {
  name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state?: string;
  pincode: string;
}

export interface DeliveryOrderItem {
  name: string;
  sku?: string;
  quantity: number;
  price?: number | string;
  image?: string | null;
}

export interface DeliveryOrder {
  id: string;
  orderNumber: string;
  status: string;
  total: number | string;
  subtotal?: number | string;
  address: DeliveryAddress;
  items: DeliveryOrderItem[];
  payment?: { method?: string; status?: string } | null;
  notes?: string | null;
}

export interface AgentDelivery {
  id: string;
  orderId: string;
  type: DeliveryType;
  status: DeliveryStatus;
  otpVerified: boolean;
  estimatedAt?: string | null;
  deliveredAt?: string | null;
  failureReason?: string | null;
  order: DeliveryOrder;
}

export interface AgentProfile {
  id: string;
  vehicleType?: string | null;
  zones?: string[];
  isOnline: boolean;
  currentLat?: number | null;
  currentLng?: number | null;
  rating?: number;
  user: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    avatar?: string | null;
  };
  _count?: { deliveries?: number };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Agent-side delivery state machine (mirrors AGENT_TRANSITIONS in the API).
 * DELIVERED is reached only via OTP verification, never a direct transition.
 */
export const AGENT_TRANSITIONS: Partial<Record<DeliveryStatus, DeliveryStatus[]>> = {
  ASSIGNED: ['PICKED_UP'],
  PICKED_UP: ['IN_TRANSIT'],
  IN_TRANSIT: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['FAILED'],
};

/** The next forward status an agent can advance to (excludes FAILED). */
export function nextStatus(status: DeliveryStatus): DeliveryStatus | null {
  const forward: Partial<Record<DeliveryStatus, DeliveryStatus>> = {
    ASSIGNED: 'PICKED_UP',
    PICKED_UP: 'IN_TRANSIT',
    IN_TRANSIT: 'OUT_FOR_DELIVERY',
  };
  return forward[status] ?? null;
}

/** Whether an OTP must be collected to complete this delivery. */
export function needsOtp(status: DeliveryStatus): boolean {
  return status === 'OUT_FOR_DELIVERY';
}

/** Statuses that count as "active" (in-progress) for tracking. */
export const ACTIVE_STATUSES: DeliveryStatus[] = ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'];
