import { apiRequest } from './api';

export interface NotificationItem {
  id: number;
  organizationId?: number | null;
  recipientId: number;
  actorId?: number | null;
  courseId?: number | null;
  type: string;
  title: string;
  message: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  referenceType?: string | null;
  referenceId?: number | null;
  metadata?: Record<string, unknown> | null;
  readAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export const listNotifications = (limit = 20, offset = 0, unreadOnly = false) =>
  apiRequest<NotificationItem[]>(`/api/notifications?limit=${limit}&offset=${offset}&unreadOnly=${unreadOnly}`);

export const getUnreadNotificationCount = () =>
  apiRequest<{ unreadCount: number }>('/api/notifications/unread-count');

export const markNotificationRead = (id: number) =>
  apiRequest<{ notification: NotificationItem; unreadCount: number }>(`/api/notifications/${id}/read`, { method: 'PATCH' });

export const markAllNotificationsRead = () =>
  apiRequest<{ unreadCount: number }>('/api/notifications/read-all', { method: 'PATCH' });

export const deleteNotification = (id: number) =>
  apiRequest<{ message: string; unreadCount: number }>(`/api/notifications/${id}`, { method: 'DELETE' });