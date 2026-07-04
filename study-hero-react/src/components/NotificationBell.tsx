import React, { useEffect, useRef, useState } from 'react';
import { useNotifications } from '../context/NotificationContext';

const priorityClasses: Record<string, string> = {
  LOW: 'text-gray-500',
  NORMAL: 'text-primary',
  HIGH: 'text-warning',
  CRITICAL: 'text-red-600'
};

const NotificationBell: React.FC = () => {
  const { notifications, unreadCount, loading, markRead, markAllRead, removeNotification } = useNotifications();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative h-10 w-10 rounded-full border border-white/30 flex items-center justify-center hover:border-accent hover:text-accent transition-colors"
        aria-label="Notifications"
        title="Notifications"
      >
        <i className="ri-notification-3-line text-xl"></i>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 rounded-full bg-accent text-primary text-xs font-bold flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed top-0 right-0 h-screen w-96 max-w-[100vw] bg-white text-gray-800 shadow-2xl border-l border-gray-100 z-[80] overflow-hidden" role="dialog" aria-label="Notification center">
          <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between bg-primary text-white">
            <h3 className="font-semibold">Notification Center</h3>
            <button
              type="button"
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="text-xs text-white hover:text-accent disabled:text-white/50"
            >
              Mark all read
            </button>
          </div>

          <div className="h-[calc(100vh-4rem)] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">
                <i className="ri-notification-off-line text-3xl text-gray-300 block mb-2"></i>
                No notifications yet
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`px-4 py-3 border-b border-gray-100 last:border-b-0 ${notification.readAt ? 'bg-white' : 'bg-primary/5'}`}
                >
                  <div className="flex items-start gap-3">
                    <i className={`ri-information-line mt-0.5 ${priorityClasses[notification.priority] || priorityClasses.NORMAL}`}></i>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{notification.title}</p>
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">{notification.message}</p>
                      <p className="text-[11px] text-gray-400 mt-2">
                        {new Date(notification.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      {!notification.readAt && (
                        <button
                          type="button"
                          onClick={() => markRead(notification.id)}
                          className="text-gray-400 hover:text-primary"
                          aria-label="Mark read"
                          title="Mark read"
                        >
                          <i className="ri-check-line"></i>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeNotification(notification.id)}
                        className="text-gray-400 hover:text-red-500"
                        aria-label="Delete notification"
                        title="Delete notification"
                      >
                        <i className="ri-close-line"></i>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;