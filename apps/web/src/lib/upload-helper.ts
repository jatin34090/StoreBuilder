import { api } from './api';

/**
 * Upload an image via the admin API and return the CDN URL.
 * @param file   The File object from an <input type="file">
 * @param folder One of 'banner', 'logo', etc. — routes to the correct endpoint
 */
export async function uploadAdminImage(
  file: File,
  folder: 'banner' | 'logo' | 'favicon',
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const endpointMap: Record<string, string> = {
    banner:  '/admin/banners/upload',
    logo:    '/admin/store/logo',
    favicon: '/admin/store/favicon',
  };

  const endpoint = endpointMap[folder] ?? '/admin/banners/upload';

  // Do NOT set Content-Type manually — axios auto-sets multipart/form-data
  // with the correct boundary when the body is FormData.
  const res = await api.post(endpoint, formData);

  // API wraps all responses in { success, data, message } via ResponseInterceptor.
  // The actual payload is at res.data.data; fall back to res.data for any non-wrapped path.
  const envelope = res.data as { data?: { imageUrl?: string; logoUrl?: string; faviconUrl?: string } } & { imageUrl?: string; logoUrl?: string; faviconUrl?: string };
  const inner = envelope.data ?? envelope;
  const url = inner.imageUrl ?? inner.logoUrl ?? inner.faviconUrl;
  if (!url) throw new Error('Upload returned no URL');
  return url;
}
