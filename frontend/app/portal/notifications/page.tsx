'use client';

import React, { useEffect, useState } from 'react';
import {
  portalListNotificationsApi,
  portalMarkNotificationReadApi,
  portalMarkAllNotificationsReadApi,
  PortalNotificationItem,
} from '@/lib/api/portal';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  CheckCheck,
  Clock,
  Loader2,
  Inbox,
} from 'lucide-react';

export default function PortalNotificationsPage() {
  const [notifications, setNotifications] = useState<PortalNotificationItem[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = async () => {
    try {
      const data = await portalListNotificationsApi({ unreadOnly });
      setNotifications(data.notifications);
    } catch (err) {
      console.error('Failed to load notifications', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [unreadOnly]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await portalMarkNotificationReadApi(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await portalMarkAllNotificationsReadApi();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: new Date().toISOString() }))
      );
    } catch (err) {
      console.error('Failed to mark all read', err);
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-sage-400">
        <Loader2 className="w-8 h-8 animate-spin text-brand-800 mb-3" />
        <p className="text-xs font-semibold text-sage-600">Loading your notifications...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-sage-200/80 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-charcoal-900">Notifications</h1>
          <p className="text-xs text-sage-500 mt-1">
            Real-time updates regarding your tickets, tasks, and portal account
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center space-x-2 text-xs font-medium text-sage-700 cursor-pointer">
            <input
              id="unread-only-toggle"
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
              className="w-4 h-4 rounded text-brand-800 focus:ring-brand-800 accent-brand-800"
            />
            <span>Unread only</span>
          </label>

          {unreadCount > 0 && (
            <button
              id="mark-all-notifications-read-btn"
              onClick={handleMarkAllRead}
              disabled={markingAll}
              className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-sage-50 text-sage-700 text-xs font-semibold border border-sage-200 flex items-center space-x-1.5 transition-colors shadow-soft-xs active:scale-95"
            >
              {markingAll ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-800" />
              ) : (
                <CheckCheck className="w-3.5 h-3.5 text-brand-800" />
              )}
              <span>Mark all read</span>
            </button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white border border-sage-200/90 text-center shadow-soft-xs space-y-2">
          <Inbox className="w-12 h-12 text-sage-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-charcoal-900">No notifications</h3>
          <p className="text-xs text-sage-500">
            {unreadOnly ? 'You have read all notifications.' : 'You have no notifications at this time.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const isRead = !!n.readAt;
            return (
              <div
                key={n._id}
                id={`notification-card-${n._id}`}
                className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 ${
                  isRead
                    ? 'bg-surface/50 border-sage-200/70 text-sage-600'
                    : 'bg-white border-sage-200 text-charcoal-900 shadow-soft-xs ring-1 ring-forest-100/80'
                }`}
              >
                <div className="flex items-start space-x-3.5 min-w-0 flex-1">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
                      n.severity === 'success'
                        ? 'bg-forest-50 border-forest-200 text-forest-700'
                        : n.severity === 'warning'
                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                        : n.severity === 'critical'
                        ? 'bg-rose-50 border-rose-200 text-rose-700'
                        : 'bg-blue-50 border-blue-200 text-blue-700'
                    }`}
                  >
                    {n.severity === 'success' ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : n.severity === 'warning' ? (
                      <AlertTriangle className="w-4 h-4" />
                    ) : (
                      <Info className="w-4 h-4" />
                    )}
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-xs sm:text-sm font-bold text-charcoal-900 truncate">{n.title}</h4>
                      {!isRead && (
                        <span className="w-2 h-2 rounded-full bg-brand-700 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-sage-600 leading-relaxed">{n.message}</p>
                    <span className="text-[10px] text-sage-400 flex items-center space-x-1 pt-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(n.createdAt).toLocaleString()}</span>
                    </span>
                  </div>
                </div>

                {!isRead && (
                  <button
                    id={`mark-read-btn-${n._id}`}
                    onClick={() => handleMarkAsRead(n._id)}
                    className="self-end sm:self-center shrink-0 text-xs text-brand-800 hover:text-brand-900 font-semibold px-3 py-1 rounded-lg hover:bg-forest-50 transition-colors"
                  >
                    Mark read
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
