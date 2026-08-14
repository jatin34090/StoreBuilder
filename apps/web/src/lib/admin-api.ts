import { api } from './api';
import type { AxiosResponse } from 'axios';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnalyticsOverview {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  activeProducts: number;
  avgOrderValue: number;
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
  productId?: string;
  productName?: string;
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
  description?: string;
  basePrice: number | string;
  discountPct?: number;
  discountedPrice?: number | string;
  category: { id: string; name: string; slug?: string };
  images: Array<{ id: string; url: string; isPrimary: boolean }>;
  variants: AdminVariant[];
  isActive: boolean;
  isFeatured: boolean;
  tags: string[];
  _count?: { variants?: number; reviews?: number };
  createdAt: string;
  updatedAt?: string;
}

export interface AdminVariant {
  id: string;
  sku: string;
  size?: string;
  color?: string;
  price: number | string;
  stock: number;
  weight?: number;
  isActive?: boolean;
}

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
  parentId?: string | null;
  parent?: { id: string; name: string } | null;
  isActive: boolean;
  sortOrder?: number;
  _count?: { products?: number; children?: number };
  createdAt?: string;
}

export interface AdminOrder {
  id: string;
  orderNumber: string;
  user: { id?: string; name: string; email?: string | null; phone?: string | null };
  items: AdminOrderItem[];
  status: OrderStatus;
  subtotal: number | string;
  discountAmount?: number | string;
  shippingCharge?: number | string;
  total: number | string;
  address: AdminAddress;
  coupon?: { code: string } | null;
  notes?: string | null;
  payment?: { status: PaymentStatus; method?: string; amount?: number | string; razorpayPaymentId?: string | null } | null;
  delivery?: {
    id?: string;
    status?: string;
    type?: string;
    provider?: string | null;
    agent?: { id: string; user?: { name: string; phone?: string } } | null;
    awbCode?: string | null;
    trackingUrl?: string | null;
    estimatedAt?: string | null;
    deliveredAt?: string | null;
  } | null;
  createdAt: string;
  updatedAt?: string;
}

export interface AdminOrderItem {
  id: string;
  name: string;
  sku?: string;
  image?: string | null;
  variantId?: string;
  quantity: number;
  price: number | string;
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
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURN_REQUESTED'
  | 'RETURNED'
  | 'REFUNDED';

export type PaymentStatus =
  | 'PENDING'
  | 'PAID'
  | 'SUCCESS'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export interface AdminUser {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  avatar?: string | null;
  role: string;
  isVerified?: boolean;
  isBlocked: boolean;
  _count?: { orders?: number };
  createdAt: string;
  updatedAt?: string;
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

export interface InventoryVariant {
  id: string;
  sku: string;
  size?: string | null;
  color?: string | null;
  price: number | string;
  stock: number;
  weight?: number | null;
  isLowStock?: boolean;
  isOutOfStock?: boolean;
  product: {
    id: string;
    name: string;
    slug: string;
    category?: { id: string; name: string } | null;
    images?: Array<{ url: string }>;
  };
}

export interface AdminCoupon {
  id: string;
  code: string;
  type: string; // 'PERCENT' | 'PERCENTAGE' | 'FIXED' (API enum)
  value: number | string;
  minOrderAmount: number | string;
  maxDiscount?: number | string | null;
  usageLimit?: number | null;
  usedCount: number;
  isActive: boolean;
  expiresAt?: string | null;
  createdAt?: string;
}

export interface DeliveryAgent {
  id: string;
  vehicleType?: string;
  zones?: string[];
  isOnline: boolean;
  currentLat?: number | null;
  currentLng?: number | null;
  rating?: number;
  user: { id: string; name: string; email?: string | null; phone?: string | null; avatar?: string | null; isBlocked?: boolean };
  _count?: { deliveries?: number };
  createdAt?: string;
}

export interface AdminReview {
  id: string;
  product?: { id?: string; name?: string };
  user?: { id?: string; name?: string; phone?: string };
  rating: number;
  title?: string;
  body?: string;
  isVisible: boolean;
  images?: string[];
  createdAt?: string;
}

export interface AdminDelivery {
  id: string;
  orderId: string;
  type: string;
  status: string;
  provider?: string | null;
  awbCode?: string | null;
  trackingUrl?: string | null;
  estimatedAt?: string | null;
  deliveredAt?: string | null;
  failureReason?: string | null;
  otpVerified?: boolean;
  agent?: { id: string; user?: { name: string; phone?: string } } | null;
  order?: {
    orderNumber: string;
    total: number | string;
    user?: { name: string; phone?: string };
    address?: { city?: string; pincode?: string };
  };
}

export interface ListResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// ─── Envelope helpers ───────────────────────────────────────────────────────
// The API wraps every response as { success, data, message }. These helpers
// unwrap that envelope and normalise list payloads into a single shape.

type Envelope<T> = { success: boolean; data: T; message?: string };

function unwrap<T>(p: Promise<AxiosResponse<Envelope<T>>>): Promise<T> {
  return p.then((r) => r.data.data);
}

function unwrapList<T>(
  p: Promise<AxiosResponse<Envelope<unknown>>>,
  key: string,
): Promise<ListResult<T>> {
  return p.then((r) => {
    const payload = r.data?.data as unknown;
    if (Array.isArray(payload)) {
      return { items: payload as T[], total: payload.length, page: 1, limit: payload.length };
    }
    const obj = (payload ?? {}) as Record<string, unknown>;
    const items = (obj[key] as T[]) ?? [];
    const pag = (obj['pagination'] as { page?: number; limit?: number; total?: number } | undefined) ?? {};
    return {
      items,
      total: pag.total ?? items.length,
      page: pag.page ?? 1,
      limit: pag.limit ?? items.length,
    };
  });
}

// ─── Analytics ────────────────────────────────────────────────────────────────

interface RawOverview {
  revenue: { total: number; growth: number };
  orders: { total: number; growth: number };
  customers: { new: number; growth: number };
  products: { active: number };
  avgOrderValue: number;
}

interface RawLowStockItem {
  id: string;
  sku: string;
  stock: number;
  size?: string | null;
  color?: string | null;
  product: { id: string; name: string; slug: string; category?: { name: string } };
}

export const adminAnalyticsApi = {
  overview: (): Promise<AnalyticsOverview> =>
    unwrap<RawOverview>(api.get('/admin/analytics/overview')).then((d) => ({
      totalRevenue: d.revenue?.total ?? 0,
      revenueChange: d.revenue?.growth ?? 0,
      totalOrders: d.orders?.total ?? 0,
      ordersChange: d.orders?.growth ?? 0,
      totalCustomers: d.customers?.new ?? 0,
      customersChange: d.customers?.growth ?? 0,
      activeProducts: d.products?.active ?? 0,
      avgOrderValue: d.avgOrderValue ?? 0,
    })),
  salesTrend: (params?: { from?: string; to?: string; granularity?: string }): Promise<SalesTrendPoint[]> =>
    unwrap<{ data: Array<{ bucket: string; revenue: number; orders: number }> }>(
      api.get('/admin/analytics/sales-trend', { params }),
    ).then((d) =>
      (d.data ?? []).map((p) => ({ date: p.bucket, revenue: p.revenue, orders: p.orders })),
    ),
  topProducts: (params?: { limit?: number }): Promise<TopProduct[]> =>
    unwrap<{ products: Array<{ productId: string; name: string; slug: string; imageUrl?: string | null; totalSold: number; totalRevenue: number }> }>(
      api.get('/admin/analytics/top-products', { params }),
    ).then((d) =>
      (d.products ?? []).map((p) => ({
        id: p.productId,
        name: p.name,
        slug: p.slug,
        image: p.imageUrl ?? undefined,
        totalSold: p.totalSold,
        totalRevenue: p.totalRevenue,
      })),
    ),
  orderStatus: (): Promise<OrderStatusStat[]> =>
    unwrap<{ distribution: OrderStatusStat[] }>(api.get('/admin/analytics/order-status')).then(
      (d) => d.distribution ?? [],
    ),
  payments: () => unwrap<unknown>(api.get('/admin/analytics/payments')),
  delivery: () => unwrap<unknown>(api.get('/admin/analytics/delivery')),
  customerGrowth: (params?: { days?: number }) =>
    unwrap<unknown>(api.get('/admin/analytics/customer-growth', { params })),
  lowStock: (params?: { threshold?: number }): Promise<LowStockItem[]> =>
    unwrap<{ lowStock?: { items: RawLowStockItem[] }; outOfStock?: { items: RawLowStockItem[] } }>(
      api.get('/admin/analytics/low-stock', { params }),
    ).then((d) => {
      const map = (it: RawLowStockItem): LowStockItem => ({
        variantId: it.id,
        productId: it.product?.id,
        productName: it.product?.name,
        sku: it.sku,
        size: it.size ?? undefined,
        color: it.color ?? undefined,
        stock: it.stock,
      });
      return [...(d.outOfStock?.items ?? []), ...(d.lowStock?.items ?? [])].map(map);
    }),
};

// ─── Products ─────────────────────────────────────────────────────────────────

export const adminProductsApi = {
  list: (params?: Record<string, unknown>): Promise<ListResult<AdminProduct>> =>
    unwrapList<AdminProduct>(api.get('/admin/products', { params }), 'products'),
  get: (id: string): Promise<AdminProduct> => unwrap<AdminProduct>(api.get(`/admin/products/${id}`)),
  create: (data: unknown): Promise<AdminProduct> => unwrap<AdminProduct>(api.post('/admin/products', data)),
  update: (id: string, data: unknown): Promise<AdminProduct> =>
    unwrap<AdminProduct>(api.patch(`/admin/products/${id}`, data)),
  delete: (id: string) => api.delete(`/admin/products/${id}`),
  addVariant: (id: string, data: unknown) =>
    unwrap<AdminVariant>(api.post(`/admin/products/${id}/variants`, data)),
  updateVariant: (productId: string, variantId: string, data: unknown) =>
    unwrap<AdminVariant>(api.patch(`/admin/products/${productId}/variants/${variantId}`, data)),
  deleteVariant: (productId: string, variantId: string) =>
    api.delete(`/admin/products/${productId}/variants/${variantId}`),
  uploadImage: (productId: string, formData: FormData, variantId?: string) =>
    api.post(
      `/admin/products/${productId}/images${variantId ? `?variantId=${variantId}` : ''}`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    ),
  deleteImage: (productId: string, imageId: string) =>
    api.delete(`/admin/products/${productId}/images/${imageId}`),
  reorderImages: (productId: string, imageIds: string[]) =>
    api.patch(`/admin/products/${productId}/images/reorder`, { imageIds }),
  assignImageVariant: (productId: string, imageId: string, variantId: string | null) =>
    api.patch(`/admin/products/${productId}/images/${imageId}/variant`, { variantId }),
};

// ─── Categories ───────────────────────────────────────────────────────────────

export const adminCategoriesApi = {
  list: (params?: Record<string, unknown>): Promise<ListResult<AdminCategory>> =>
    unwrapList<AdminCategory>(api.get('/admin/categories', { params }), 'categories'),
  create: (data: unknown): Promise<AdminCategory> => unwrap<AdminCategory>(api.post('/admin/categories', data)),
  update: (id: string, data: unknown): Promise<AdminCategory> =>
    unwrap<AdminCategory>(api.patch(`/admin/categories/${id}`, data)),
  delete: (id: string) => api.delete(`/admin/categories/${id}`),
  uploadImage: (categoryId: string, formData: FormData) =>
    api.post(`/admin/categories/${categoryId}/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// ─── Orders ───────────────────────────────────────────────────────────────────

export const adminOrdersApi = {
  list: (params?: Record<string, unknown>): Promise<ListResult<AdminOrder>> =>
    unwrapList<AdminOrder>(api.get('/admin/orders', { params }), 'orders'),
  get: (id: string): Promise<AdminOrder> => unwrap<AdminOrder>(api.get(`/admin/orders/${id}`)),
  updateStatus: (id: string, status: OrderStatus, notes?: string) =>
    api.patch(`/admin/orders/${id}/status`, { status, notes }),
  updateDelivery: (
    id: string,
    data: { agentId?: string; awbCode?: string; trackingUrl?: string; estimatedDelivery?: string },
  ) => api.patch(`/admin/orders/${id}/delivery`, data),
  shipViaShiprocket: (orderId: string) =>
    unwrap<{ awbCode: string; courierName: string; trackingUrl: string; shiprocketOrderId: number; shipmentId: number }>(
      api.post(`/admin/orders/${orderId}/ship`),
    ),
};

// ─── Users ────────────────────────────────────────────────────────────────────

export const adminUsersApi = {
  list: (params?: Record<string, unknown>): Promise<ListResult<AdminUser>> =>
    unwrapList<AdminUser>(api.get('/admin/users', { params }), 'users'),
  blockToggle: (id: string, isBlocked: boolean) =>
    api.patch(`/admin/users/${id}/block`, { isBlocked }),
};

// ─── Inventory ────────────────────────────────────────────────────────────────

export const adminInventoryApi = {
  list: (params?: Record<string, unknown>): Promise<ListResult<InventoryVariant>> =>
    unwrapList<InventoryVariant>(api.get('/admin/inventory', { params }), 'variants'),
  lowStock: (params?: { threshold?: number }): Promise<ListResult<InventoryVariant>> =>
    unwrapList<InventoryVariant>(api.get('/admin/inventory/low-stock', { params }), 'variants'),
  // The API adjusts stock by a signed delta (with a reason + note), not an
  // absolute value, so the caller passes the new and current stock here.
  update: (variantId: string, newStock: number, currentStock: number) =>
    api.patch(`/admin/inventory/${variantId}`, {
      delta: newStock - currentStock,
      reason: 'MANUAL',
      note: 'Admin manual stock adjustment',
    }),
};

// ─── Coupons ─────────────────────────────────────────────────────────────────

export const adminCouponsApi = {
  list: (params?: Record<string, unknown>): Promise<ListResult<AdminCoupon>> =>
    unwrapList<AdminCoupon>(api.get('/admin/coupons', { params }), 'coupons'),
  create: (data: unknown): Promise<AdminCoupon> => unwrap<AdminCoupon>(api.post('/admin/coupons', data)),
  update: (id: string, data: unknown): Promise<AdminCoupon> =>
    unwrap<AdminCoupon>(api.patch(`/admin/coupons/${id}`, data)),
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
  listAgents: (params?: Record<string, unknown>): Promise<ListResult<DeliveryAgent>> =>
    unwrapList<DeliveryAgent>(api.get('/admin/agents', { params }), 'agents'),
  getAgent: (id: string): Promise<DeliveryAgent> => unwrap<DeliveryAgent>(api.get(`/admin/agents/${id}`)),
  createAgent: (data: unknown): Promise<DeliveryAgent> => unwrap<DeliveryAgent>(api.post('/admin/agents', data)),
  updateAgent: (id: string, data: unknown): Promise<DeliveryAgent> =>
    unwrap<DeliveryAgent>(api.patch(`/admin/agents/${id}`, data)),
  deleteAgent: (id: string) => api.delete(`/admin/agents/${id}`),
  listDeliveries: (params?: Record<string, unknown>): Promise<ListResult<AdminDelivery>> =>
    unwrapList<AdminDelivery>(api.get('/admin/deliveries', { params }), 'deliveries'),
  getDelivery: (orderId: string): Promise<AdminDelivery> =>
    unwrap<AdminDelivery>(api.get(`/admin/deliveries/${orderId}`)),
};

// ─── Payments ─────────────────────────────────────────────────────────────────

export const adminPaymentsApi = {
  refund: (orderId: string, data: { amount?: number; reason?: string }) =>
    api.post(`/admin/payments/${orderId}/refund`, data),
};

// ─── Reviews ─────────────────────────────────────────────────────────────────

export const adminReviewsApi = {
  list: (params?: Record<string, unknown>): Promise<ListResult<AdminReview>> =>
    unwrapList<AdminReview>(api.get('/admin/reviews', { params }), 'reviews'),
  setVisibility: (id: string, isVisible: boolean) =>
    api.patch(`/admin/reviews/${id}/visibility`, { isVisible }),
  delete: (id: string) => api.delete(`/admin/reviews/${id}`),
};

// ─── Search ───────────────────────────────────────────────────────────────────

export const adminSearchApi = {
  reindex: () => api.post('/admin/search/reindex'),
};

// ─── Store (own store management) ─────────────────────────────────────────────

export interface StoreDetail {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  businessName?: string | null;
  industry?: string | null;
  description?: string | null;
  contactEmail?: string | null;
  phone?: string | null;
  address?: string | null;
  country?: string;
  currency?: string;
  timezone?: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  customDomain?: string | null;
  isActive: boolean;
  _count?: { products?: number; orders?: number };
  quota?: { productCount: number; orderCount: number; storageBytes: string };
}

export interface OnboardingProgress {
  steps: Array<{ key: string; label: string; done: boolean }>;
  percent: number;
}

export interface StaffMember {
  id: string;
  userId: string;
  storeId: string;
  role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'STAFF';
  status: 'PENDING' | 'ACTIVE' | 'INACTIVE';
  invitationEmail?: string | null;
  invitedAt?: string | null;
  joinedAt?: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    avatar?: string | null;
    role: string;
  };
}

export interface AdminMeResponse {
  user: { id: string; name: string; email?: string | null; avatar?: string | null; role: string };
  store: StoreDetail;
  role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'STAFF';
  permissions: string[];
  membership: { role: string; status: string; joinedAt?: string | null; createdAt: string } | null;
}

export const adminStoreApi = {
  get: (): Promise<StoreDetail> =>
    unwrap<StoreDetail>(api.get('/admin/store')),
  me: (): Promise<AdminMeResponse> =>
    unwrap<AdminMeResponse>(api.get('/admin/store/me')),
  update: (data: Partial<StoreDetail>): Promise<StoreDetail> =>
    unwrap<StoreDetail>(api.patch('/admin/store', data)),
  launch: (): Promise<{ success: boolean; message: string; slug: string }> =>
    unwrap(api.patch('/admin/store/launch')),
  usage: () =>
    unwrap<unknown>(api.get('/admin/store/usage')),
  onboardingProgress: (): Promise<OnboardingProgress> =>
    unwrap<OnboardingProgress>(api.get('/onboarding/progress')),

  // Staff management
  listStaff: (): Promise<StaffMember[]> =>
    unwrap<StaffMember[]>(api.get('/admin/store/staff')),
  inviteStaff: (data: { email: string; role: 'ADMIN' | 'MANAGER' | 'STAFF'; name?: string }) =>
    unwrap<{ invitationToken?: string; email: string; role: string; message: string }>(
      api.post('/admin/store/staff/invite', data),
    ),
  updateStaffRole: (userId: string, role: 'ADMIN' | 'MANAGER' | 'STAFF') =>
    unwrap(api.patch(`/admin/store/staff/${userId}/role`, { role })),
  removeStaff: (userId: string) =>
    unwrap(api.delete(`/admin/store/staff/${userId}`)),
  resendInvite: (userId: string) =>
    unwrap(api.post(`/admin/store/staff/${userId}/resend-invite`)),
  getAuditLog: () =>
    unwrap<unknown[]>(api.get('/admin/store/audit-log')),
};

// ─── Billing types + API ─────────────────────────────────────────────────────

export interface PlanOption {
  plan:         string;
  name:         string;
  description:  string | null;
  priceMonthly: number; // paise
  priceYearly:  number;
  currency:     string;
  trialDays:    number;
  features:     string[];
  limits: {
    maxProducts:    number;
    maxStaff:       number;
    maxStorageGB:   number;
    maxOrders:      number | null;
    maxApiPerDay:   number;
    maxApiPerMonth: number;
  };
}

export interface BillingStatus {
  plan:         string;
  subscription: {
    id:                 string;
    status:             string;
    billingCycle:       string;
    currentPeriodStart: string | null;
    currentPeriodEnd:   string | null;
    trialStart:         string | null;
    trialEnd:           string | null;
    cancelAtPeriodEnd:  boolean;
    cancelledAt:        string | null;
  } | null;
  usage: {
    products:    { used: number; max: number };
    staff:       { used: number; max: number };
    storageGB:   { used: number; maxGB: number };
    ordersMonth: { used: number; max: number | null };
    apiToday:    { used: number; max: number };
  } | null;
  limits: Record<string, number | null> | null;
  plans:  PlanOption[];
}

export interface BillingInvoice {
  id:                 string;
  invoiceNumber:      string;
  plan:               string;
  amount:             number; // paise
  tax:                number;
  currency:           string;
  status:             string;
  billingPeriodStart: string | null;
  billingPeriodEnd:   string | null;
  issuedAt:           string;
  paidAt:             string | null;
}

export const adminBillingApi = {
  listPlans:    (): Promise<PlanOption[]> =>
    unwrap<PlanOption[]>(api.get('/billing/plans')),
  getStatus:    (): Promise<BillingStatus> =>
    unwrap<BillingStatus>(api.get('/admin/billing/status')),
  getInvoices:  (): Promise<BillingInvoice[]> =>
    unwrap<BillingInvoice[]>(api.get('/admin/billing/invoices')),
  subscribe:    (plan: string) =>
    unwrap<{ subscriptionId: string; shortUrl: string; razorpayKeyId: string; plan: string }>(
      api.post('/admin/billing/subscribe', { plan }),
    ),
  cancel:       () => unwrap(api.delete('/admin/billing/cancel')),
  reactivate:   () => unwrap(api.post('/admin/billing/reactivate')),
};

// ─── Unified adminApi object ──────────────────────────────────────────────────

const adminRemittancesApi = {
  list: (status?: string) => api.get('/admin/remittances', { params: status ? { status } : undefined }),
  confirm: (id: string) => api.patch(`/admin/remittances/${id}/receive`),
};

const adminSettingsApi = {
  getTheme:            ()                            => api.get('/settings/theme'),
  updateTheme:         (data: Record<string, string>) => api.patch('/settings/theme', data),
  getThemePresets:     ()                            => api.get('/settings/theme/presets'),
  updateThemePresets:  (presets: unknown[])           => api.patch('/settings/theme/presets', { presets }),
  getSiteConfig:       ()                            => api.get('/settings/site'),
  updateSiteConfig:    (data: Record<string, string>) => api.patch('/settings/site', data),
  getLayoutConfig:     ()                            => api.get('/settings/layout'),
  updateLayoutConfig:  (data: Record<string, string>) => api.patch('/settings/layout', data),
};

export const adminApi = {
  analytics:     adminAnalyticsApi,
  products:      adminProductsApi,
  categories:    adminCategoriesApi,
  orders:        adminOrdersApi,
  users:         adminUsersApi,
  inventory:     adminInventoryApi,
  coupons:       adminCouponsApi,
  notifications: adminNotificationsApi,
  delivery:      adminDeliveryApi,
  payments:      adminPaymentsApi,
  reviews:       adminReviewsApi,
  search:        adminSearchApi,
  remittances:   adminRemittancesApi,
  settings:      adminSettingsApi,
  store:         adminStoreApi,
  billing:       adminBillingApi,
};
