import axios from 'axios';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Tokens are now httpOnly cookies — the browser sends them automatically.
// withCredentials: true (set on the axios instance) is all that's needed.

// ─── Store tenant headers ─────────────────────────────────────────────────────
// For storefront pages: middleware sets a 'store-id' cookie (from subdomain resolution).
// For admin pages: we set the store slug via setAdminStoreSlug() after login.

function getStoreIdCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(/(?:^|;\s*)store-id=([^;]+)/);
  return match?.[1];
}

// Slug of the currently-authenticated admin's store. Set by admin layout after
// loading /admin/store. All /admin/* requests forward this as x-store-slug so
// the API TenantMiddleware scopes them to the right tenant.
let _adminStoreSlug: string | undefined;
export function setAdminStoreSlug(slug: string | undefined) { _adminStoreSlug = slug; }
export function getAdminStoreSlug(): string | undefined { return _adminStoreSlug; }

api.interceptors.request.use((config) => {
  const url = config.url ?? '';
  const isAdminRoute = url.startsWith('/admin/') || url.startsWith('admin/');

  if (isAdminRoute && _adminStoreSlug) {
    config.headers['x-store-slug'] = _adminStoreSlug;
  } else if (!isAdminRoute) {
    const storeId = getStoreIdCookie();
    if (storeId) config.headers['X-Store-Id'] = storeId;
  }
  return config;
});

// ─── Silent token refresh on 401 ─────────────────────────────────────────────

let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown) {
  failedQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(null)));
  failedQueue = [];
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const isAuthEndpoint = original?.url?.includes('/auth/');
    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => api(original))
          .catch((e) => Promise.reject(e));
      }
      original._retry = true;
      isRefreshing = true;
      try {
        await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true });
        processQueue(null);
        return api(original);
      } catch (refreshError) {
        processQueue(refreshError);
        // Clear persisted auth state — protected pages will redirect via useAuthGuard.
        // Hard window.location redirect removed: it interrupts in-progress navigations
        // and fires even when the original 401 was transient (e.g. during login flow).
        try {
          const { useAuthStore } = await import('../store/authStore');
          useAuthStore.getState().clearUser();
        } catch { /* ignore — store may not be mounted */ }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  sendOtp: (phone: string) => api.post('/auth/send-otp', { phone }),
  verifyOtp: (phone: string, otp: string) => api.post('/auth/verify-otp', { phone, otp }),
  login: (identifier: string, password: string) => api.post('/auth/login', { identifier, password }),
  logout: () => api.post('/auth/logout'),
  refresh: () => api.post('/auth/refresh'),
};

// ─── Products ─────────────────────────────────────────────────────────────────

export const productsApi = {
  list: (params?: Record<string, unknown>) => api.get('/products', { params }),
  bySlug: (slug: string) => api.get(`/products/${slug}`),
  featured: () => api.get('/products', { params: { featured: true, limit: 8 } }),
};

// ─── Search ───────────────────────────────────────────────────────────────────

export const searchApi = {
  search: (params: Record<string, unknown>) => api.get('/search', { params }),
};

// ─── Categories ───────────────────────────────────────────────────────────────

export const categoriesApi = {
  list: () => api.get('/categories'),
};

// ─── Cart ─────────────────────────────────────────────────────────────────────

export const cartApi = {
  get: () => api.get('/cart'),
  upsertItem: (variantId: string, quantity: number) => api.post('/cart/items', { variantId, quantity }),
  removeItem: (variantId: string) => api.delete(`/cart/items/${variantId}`),
  clear: () => api.delete('/cart'),
  merge: (items: Array<{ variantId: string; quantity: number }>) => api.post('/cart/merge', { items }),
};

// ─── Wishlist ─────────────────────────────────────────────────────────────────

export const wishlistApi = {
  get: () => api.get('/wishlist'),
  getIds: () => api.get('/wishlist/ids'),
  toggle: (productId: string) => api.post('/wishlist/toggle', { productId }),
  remove: (productId: string) => api.delete(`/wishlist/${productId}`),
};

// ─── Orders ───────────────────────────────────────────────────────────────────

export const ordersApi = {
  list: (params?: Record<string, unknown>) => api.get('/orders', { params }),
  get: (id: string) => api.get(`/orders/${id}`),
  place: (data: unknown) => api.post('/orders', data),
  cancel: (id: string, reason: string) => api.patch(`/orders/${id}/cancel`, { reason }),
  return: (id: string, reason: string) => api.patch(`/orders/${id}/return`, { reason }),
  verifyPayment: (orderId: string, data: Record<string, unknown>) =>
    api.post('/payments/verify', { orderId, ...data }),
};

// ─── Users ────────────────────────────────────────────────────────────────────

export const usersApi = {
  profile: () => api.get('/users/me'),
  updateProfile: (data: unknown) => api.patch('/users/me', data),
  addresses: () => api.get('/users/me/addresses'),
  addAddress: (data: unknown) => api.post('/users/me/addresses', data),
  updateAddress: (id: string, data: unknown) => api.patch(`/users/me/addresses/${id}`, data),
  deleteAddress: (id: string) => api.delete(`/users/me/addresses/${id}`),
};

// ─── Reviews ─────────────────────────────────────────────────────────────────

export const reviewsApi = {
  list: (productId: string, params?: Record<string, unknown>) =>
    api.get('/reviews', { params: { productId, ...params } }),
  create: (data: unknown) => api.post('/reviews', data),
};

// ─── Coupons ─────────────────────────────────────────────────────────────────

export const couponsApi = {
  validate: (code: string, orderSubtotal: number) =>
    api.post('/coupons/validate', { code, orderSubtotal }),
};

// ─── Notifications ────────────────────────────────────────────────────────────

export const notificationsApi = {
  list: (params?: Record<string, unknown>) => api.get('/notifications', { params }),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
};
