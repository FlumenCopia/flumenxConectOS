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
      <div className="py-24 text-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
        <p className="text-sm">Loading your notifications...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Notifications</h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time updates regarding your tickets, tasks, and portal account
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
            <input
              id="unread-only-toggle"
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700"
            />
            <span>Unread only</span>
          </label>

          {unreadCount > 0 && (
            <button
              id="mark-all-notifications-read-btn"
              onClick={handleMarkAllRead}
              disabled={markingAll}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center space-x-1.5 transition-colors"
            >
              {markingAll ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCheck className="w-3.5 h-3.5" />
              )}
              <span>Mark all as read</span>
            </button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="p-12 rounded-2xl bg-slate-900/40 border border-slate-800 text-center">
          <Inbox className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">No notifications</h3>
          <p className="text-xs text-slate-400 mt-1">
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
                className={`p-4 rounded-2xl border transition-all flex items-start justify-between gap-4 ${
                  isRead
                    ? 'bg-slate-900/40 border-slate-800/80 text-slate-400'
                    : 'bg-slate-900/90 border-slate-700 text-slate-100 shadow-md'
                }`}
              >
                <div className="flex items-start space-x-3.5 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      n.severity === 'success'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : n.severity === 'warning'
                        ? 'bg-amber-500/10 text-amber-400'
                        : n.severity === 'critical'
                        ? 'bg-rose-500/10 text-rose-400'
                        : 'bg-indigo-500/10 text-indigo-400'
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
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-semibold text-white truncate">{n.title}</h4>
                      {!isRead && (
                        <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{n.message}</p>
                    <span className="text-[10px] text-slate-500 flex items-center space-x-1 pt-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(n.createdAt).toLocaleString()}</span>
                    </span>
                  </div>
                </div>

                {!isRead && (
                  <button
                    id={`mark-read-btn-${n._id}`}
                    onClick={() => handleMarkAsRead(n._id)}
                    className="flex-shrink-0 text-xs text-indigo-400 hover:text-indigo-300 font-medium px-2.5 py-1 rounded-lg hover:bg-slate-800 transition-colors"
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
