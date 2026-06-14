import { api } from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnalyticsOverview {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  lowStockCount: number;
  revenueChange: number;
  ordersChange: number;
  customersChange: number;
}

export interface SalesTrendPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface TopProduct {
  id: string;
  name: string;
  slug: string;
  totalSold: number;
  totalRevenue: number;
  image?: string;
}

export interface OrderStatusStat {
  status: string;
  count: number;
  percentage: number;
}

export interface PaymentStat {
  method: string;
  count: number;
  total: number;
}

export interface DeliveryStat {
  status: string;
  count: number;
}

export interface CustomerGrowthPoint {
  date: string;
  newCustomers: number;
  totalCustomers: number;
}

export interface LowStockItem {
  variantId: string;
  productId: string;
  productName: string;
  sku: string;
  size?: string;
  color?: string;
  stock: number;
  image?: string;
}

export interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  basePrice: number;
  discountedPrice?: number;
  category: { id: string; name: string };
  images: Array<{ id: string; url: string; isPrimary: boolean }>;
  variants: AdminVariant[];
  isActive: boolean;
  isFeatured: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminVariant {
  id: string;
  sku: string;
  size?: string;
  color?: string;
  price: number;
  stock: number;
  isActive: boolean;
}

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parentId?: string;
  parent?: { id: string; name: string };
  isActive: boolean;
  productCount: number;
  createdAt: string;
}

export interface AdminOrder {
  id: string;
  orderNumber: string;
  user: { id: string; name: string; email: string; phone?: string };
  items: AdminOrderItem[];
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  subtotal: number;
  discount: number;
  deliveryCharge: number;
  total: number;
  address: AdminAddress;
  couponCode?: string;
  notes?: string;
  deliveryAgent?: { id: string; name: string; phone: string };
  trackingNumber?: string;
  estimatedDelivery?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrderItem {
  id: string;
  product: { id: string; name: string; image?: string };
  variant: { id: string; sku: string; size?: string; color?: string };
  quantity: number;
  price: number;
}

export interface AdminAddress {
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
}

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURNED';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';

export interface AdminUser {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  role: string;
  isBlocked: boolean;
  totalOrders: number;
  totalSpent: number;
  createdAt: string;
}

export interface InventoryItem {
  variantId: string;
  productId: string;
  productName: string;
  sku: string;
  size?: string;
  color?: string;
  stock: number;
  price: number;
  image?: string;
}

export interface AdminCoupon {
  id: string;
  code: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  minOrderValue: number;
  maxDiscount?: number;
  usageLimit?: number;
  usedCount: number;
  isActive: boolean;
  expiresAt?: string;
  createdAt: string;
}

export interface DeliveryAgent {
  id: string;
  name: string;
  phone: string;
  email?: string;
  isAvailable: boolean;
  totalDeliveries: number;
  activeDeliveries: number;
  createdAt: string;
}

export interface AdminReview {
  id: string;
  product: { id: string; name: string };
  user: { id: string; name: string };
  rating: number;
  title?: string;
  body: string;
  isVisible: boolean;
  images: string[];
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export const adminAnalyticsApi = {
  overview: () => api.get<AnalyticsOverview>('/admin/analytics/overview'),
  salesTrend: (params?: { days?: number }) =>
    api.get<SalesTrendPoint[]>('/admin/analytics/sales-trend', { params }),
  topProducts: (params?: { limit?: number }) =>
    api.get<TopProduct[]>('/admin/analytics/top-products', { params }),
  orderStatus: () => api.get<OrderStatusStat[]>('/admin/analytics/order-status'),
  payments: () => api.get<PaymentStat[]>('/admin/analytics/payments'),
  delivery: () => api.get<DeliveryStat[]>('/admin/analytics/delivery'),
  customerGrowth: (params?: { days?: number }) =>
    api.get<CustomerGrowthPoint[]>('/admin/analytics/customer-growth', { params }),
  lowStock: (params?: { threshold?: number }) =>
    api.get<LowStockItem[]>('/admin/analytics/low-stock', { params }),
};

// ─── Products ─────────────────────────────────────────────────────────────────

export const adminProductsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<AdminProduct>>('/admin/products', { params }),
  get: (id: string) => api.get<AdminProduct>(`/admin/products/${id}`),
  create: (data: unknown) => api.post<AdminProduct>('/admin/products', data),
  update: (id: string, data: unknown) => api.patch<AdminProduct>(`/admin/products/${id}`, data),
  delete: (id: string) => api.delete(`/admin/products/${id}`),
  addVariant: (id: string, data: unknown) =>
    api.post<AdminVariant>(`/admin/products/${id}/variants`, data),
  updateVariant: (productId: string, variantId: string, data: unknown) =>
    api.patch<AdminVariant>(`/admin/products/${productId}/variants/${variantId}`, data),
  deleteVariant: (productId: string, variantId: string) =>
    api.delete(`/admin/products/${productId}/variants/${variantId}`),
  uploadImage: (productId: string, formData: FormData) =>
    api.post(`/admin/products/${productId}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  deleteImage: (productId: string, imageId: string) =>
    api.delete(`/admin/products/${productId}/images/${imageId}`),
};

// ─── Categories ───────────────────────────────────────────────────────────────

export const adminCategoriesApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<AdminCategory[]>('/admin/categories', { params }),
  get: (id: string) => api.get<AdminCategory>(`/admin/categories/${id}`),
  create: (data: unknown) => api.post<AdminCategory>('/admin/categories', data),
  update: (id: string, data: unknown) =>
    api.patch<AdminCategory>(`/admin/categories/${id}`, data),
  delete: (id: string) => api.delete(`/admin/categories/${id}`),
  uploadImage: (categoryId: string, formData: FormData) =>
    api.post(`/admin/categories/${categoryId}/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// ─── Orders ───────────────────────────────────────────────────────────────────

export const adminOrdersApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<AdminOrder>>('/admin/orders', { params }),
  get: (id: string) => api.get<AdminOrder>(`/admin/orders/${id}`),
  updateStatus: (id: string, status: OrderStatus, note?: string) =>
    api.patch(`/admin/orders/${id}/status`, { status, note }),
  updateDelivery: (
    id: string,
    data: { agentId?: string; trackingNumber?: string; estimatedDelivery?: string },
  ) => api.patch(`/admin/orders/${id}/delivery`, data),
};

// ─── Users ────────────────────────────────────────────────────────────────────

export const adminUsersApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<AdminUser>>('/admin/users', { params }),
  blockToggle: (id: string, isBlocked: boolean) =>
    api.patch(`/admin/users/${id}/block`, { isBlocked }),
};

// ─── Inventory ────────────────────────────────────────────────────────────────

export const adminInventoryApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<InventoryItem>>('/admin/inventory', { params }),
  lowStock: (params?: { threshold?: number }) =>
    api.get<InventoryItem[]>('/admin/inventory/low-stock', { params }),
  update: (variantId: string, stock: number) =>
    api.patch(`/admin/inventory/${variantId}`, { stock }),
};

// ─── Coupons ─────────────────────────────────────────────────────────────────

export const adminCouponsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<AdminCoupon[]>('/admin/coupons', { params }),
  create: (data: unknown) => api.post<AdminCoupon>('/admin/coupons', data),
  update: (id: string, data: unknown) => api.patch<AdminCoupon>(`/admin/coupons/${id}`, data),
};

// ─── Notifications ────────────────────────────────────────────────────────────

export const adminNotificationsApi = {
  send: (data: { userId: string; title: string; body: string; type?: string }) =>
    api.post('/admin/notifications', data),
  broadcast: (data: { title: string; body: string; type?: string }) =>
    api.post('/admin/notifications/broadcast', data),
};

// ─── Delivery ─────────────────────────────────────────────────────────────────

export const adminDeliveryApi = {
  listAgents: (params?: Record<string, unknown>) =>
    api.get<DeliveryAgent[]>('/admin/agents', { params }),
  getAgent: (id: string) => api.get<DeliveryAgent>(`/admin/agents/${id}`),
  createAgent: (data: unknown) => api.post<DeliveryAgent>('/admin/agents', data),
  updateAgent: (id: string, data: unknown) =>
    api.patch<DeliveryAgent>(`/admin/agents/${id}`, data),
  deleteAgent: (id: string) => api.delete(`/admin/agents/${id}`),
  listDeliveries: (params?: Record<string, unknown>) =>
    api.get('/admin/deliveries', { params }),
  getDelivery: (orderId: string) => api.get(`/admin/deliveries/${orderId}`),
};

// ─── Payments ─────────────────────────────────────────────────────────────────

export const adminPaymentsApi = {
  refund: (orderId: string, data: { amount?: number; reason?: string }) =>
    api.post(`/admin/payments/${orderId}/refund`, data),
};

// ─── Reviews ─────────────────────────────────────────────────────────────────

export const adminReviewsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<AdminReview>>('/admin/reviews', { params }),
  setVisibility: (id: string, isVisible: boolean) =>
    api.patch(`/admin/reviews/${id}/visibility`, { isVisible }),
  delete: (id: string) => api.delete(`/admin/reviews/${id}`),
};

// ─── Search ───────────────────────────────────────────────────────────────────

export const adminSearchApi = {
  reindex: () => api.post('/admin/search/reindex'),
};

// ─── Unified adminApi object ──────────────────────────────────────────────────

export const adminApi = {
  analytics: adminAnalyticsApi,
  products: adminProductsApi,
  categories: adminCategoriesApi,
  orders: adminOrdersApi,
  users: adminUsersApi,
  inventory: adminInventoryApi,
  coupons: adminCouponsApi,
  notifications: adminNotificationsApi,
  delivery: adminDeliveryApi,
  payments: adminPaymentsApi,
  reviews: adminReviewsApi,
  search: adminSearchApi,
};
