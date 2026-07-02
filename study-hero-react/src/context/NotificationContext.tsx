import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getAuthToken } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';
import {
  deleteNotification as deleteNotificationRequest,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NotificationItem
} from '../services/notificationApi';

interface NotificationContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  refreshNotifications: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  removeNotification: (id: number) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode; authKey?: string }> = ({ children, authKey }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const refreshInFlight = useRef(false);

  const refreshNotifications = useCallback(async () => {
    const token = getAuthToken();
    if (!token || refreshInFlight.current) return;

    refreshInFlight.current = true;
    setLoading(true);
    try {
      const [items, count] = await Promise.all([
        listNotifications(20, 0, false),
        getUnreadNotificationCount()
      ]);
      setNotifications(items);
      setUnreadCount(Number(count.unreadCount || 0));
    } catch (error) {
      console.error('Notification refresh failed:', error);
    } finally {
      refreshInFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setNotifications([]);
      setUnreadCount(0);
      disconnectSocket();
      return;
    }

    const socket = connectSocket(token);
    refreshNotifications();

    if (!socket) return;

    const syncNotifications = () => {
      refreshNotifications();
    };

    const refreshDashboard = () => {
      window.dispatchEvent(new CustomEvent('studyhero:dashboard-refresh'));
    };

    socket.on('connect', syncNotifications);
    socket.on('socket:connected', syncNotifications);
    socket.on('notification:new', syncNotifications);
    socket.on('notification:read', syncNotifications);
    socket.on('notification:read_all', syncNotifications);
    socket.on('notification:deleted', syncNotifications);
    socket.on('notification:unread_count:sync', (payload: { unreadCount?: number }) => {
      if (typeof payload?.unreadCount === 'number') setUnreadCount(payload.unreadCount);
    });
    socket.on('dashboard:refresh', refreshDashboard);

    return () => {
      socket.off('connect', syncNotifications);
      socket.off('socket:connected', syncNotifications);
      socket.off('notification:new', syncNotifications);
      socket.off('notification:read', syncNotifications);
      socket.off('notification:read_all', syncNotifications);
      socket.off('notification:deleted', syncNotifications);
      socket.off('notification:unread_count:sync');
      socket.off('dashboard:refresh', refreshDashboard);
    };
  }, [authKey, refreshNotifications]);

  const markRead = useCallback(async (id: number) => {
    const result = await markNotificationRead(id);
    setUnreadCount(Number(result.unreadCount || 0));
    setNotifications((current) => current.map((item) => item.id === id ? result.notification : item));
  }, []);

  const markAllRead = useCallback(async () => {
    const result = await markAllNotificationsRead();
    setUnreadCount(Number(result.unreadCount || 0));
    setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
  }, []);

  const removeNotification = useCallback(async (id: number) => {
    const result = await deleteNotificationRequest(id);
    setUnreadCount(Number(result.unreadCount || 0));
    setNotifications((current) => current.filter((item) => item.id !== id));
  }, []);

  const value = useMemo(() => ({
    notifications,
    unreadCount,
    loading,
    refreshNotifications,
    markRead,
    markAllRead,
    removeNotification
  }), [notifications, unreadCount, loading, refreshNotifications, markRead, markAllRead, removeNotification]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};