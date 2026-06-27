/** In-app notifications client (shared user notification endpoints). */
import api from './api';

type Envelope<T> = { success: boolean; data: T; message?: string };

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  data?: Record<string, unknown> | null;
  createdAt: string;
}

export interface NotificationsPage {
  items: AppNotification[];
  unreadCount: number;
  total: number;
  page: number;
  limit: number;
}

export const notificationsApi = {
  list: async (params?: { page?: number; limit?: number }): Promise<NotificationsPage> => {
    const res = await api.get<Envelope<{ notifications: AppNotification[]; unreadCount: number; pagination: { page: number; limit: number; total: number } }>>(
      '/notifications',
      { params },
    );
    const d = res.data.data;
    return {
      items: d.notifications ?? [],
      unreadCount: d.unreadCount ?? 0,
      total: d.pagination?.total ?? 0,
      page: d.pagination?.page ?? 1,
      limit: d.pagination?.limit ?? 20,
    };
  },

  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
};
