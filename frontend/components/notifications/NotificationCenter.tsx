'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Bell,
  Check,
  CheckCheck,
  Info,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
  Inbox,
  Filter,
} from 'lucide-react';
import {
  NotificationItem,
  listNotificationsApi,
  getUnreadCountApi,
  markAsReadApi,
  markAllAsReadApi,
} from '@/lib/api/notifications';
import { useAuth } from '@/hooks/useAuth';

export const NotificationCenter: React.FC = () => {
  const { activeClient } = useAuth();
  const clientId = activeClient?.clientId;

  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const count = await getUnreadCountApi(clientId);
      setUnreadCount(count);
    } catch {
      // Non-fatal
    }
  }, [clientId]);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listNotificationsApi({
        unreadOnly,
        limit: 15,
        clientId,
      });
      setNotifications(res.data || []);
      if (res.unreadCount !== undefined) {
        setUnreadCount(res.unreadCount);
      }
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }, [clientId, unreadOnly]);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await markAsReadApi(id, clientId);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Non-fatal
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsReadApi(clientId);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch {
      // Non-fatal
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />;
      default:
        return <Info className="h-4 w-4 text-brand-500 shrink-0 mt-0.5" />;
    }
  };

  const getTargetLink = (n: NotificationItem) => {
    if (n.sourceType === 'lead' && n.sourceId) return `/client/leads`;
    if (n.sourceType === 'task') return `/client/tasks`;
    if (n.sourceType === 'conversation') return `/client/inbox`;
    if (n.sourceType === 'workflow_run') return `/client/workflows`;
    return null;
  };

  const formatRelativeTime = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        title="Notifications"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-500 hover:text-slate-800 rounded-md hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-600"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-lg bg-white shadow-xl border border-slate-200 z-50 overflow-hidden flex flex-col max-h-[480px]">
          {/* Header */}
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-slate-800">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setUnreadOnly(!unreadOnly)}
                className={`text-[11px] font-medium px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                  unreadOnly
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                <Filter className="h-3 w-3" />
                <span>{unreadOnly ? 'Unread' : 'All'}</span>
              </button>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  title="Mark all as read"
                  className="text-[11px] text-slate-500 hover:text-brand-600 font-medium flex items-center gap-1 hover:bg-slate-200/60 px-2 py-1 rounded transition-colors"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto divide-y divide-slate-100 flex-1">
            {loading && notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
                <span className="text-xs">Loading alerts...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-2">
                <Inbox className="h-8 w-8 text-slate-300 stroke-[1.5]" />
                <span className="text-xs font-medium text-slate-600">No notifications yet</span>
                <span className="text-[11px] text-slate-400">
                  Workflow alerts and task updates will appear here.
                </span>
              </div>
            ) : (
              notifications.map((n) => {
                const targetLink = getTargetLink(n);
                const isUnread = !n.readAt;

                return (
                  <div
                    key={n._id}
                    className={`p-3.5 hover:bg-slate-50/80 transition-colors flex gap-3 text-left relative ${
                      isUnread ? 'bg-blue-50/30' : ''
                    }`}
                  >
                    {/* Severity Icon */}
                    {getSeverityIcon(n.severity)}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1.5 mb-1">
                        <span className="text-xs font-semibold text-slate-800 truncate">
                          {n.title}
                        </span>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                          {formatRelativeTime(n.createdAt)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-2">
                        {n.message}
                      </p>

                      <div className="flex items-center justify-between text-[11px] pt-1">
                        {targetLink ? (
                          <Link
                            href={targetLink}
                            onClick={() => setIsOpen(false)}
                            className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700 font-medium"
                          >
                            <span>View item</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </Link>
                        ) : (
                          <span />
                        )}

                        {isUnread && (
                          <button
                            type="button"
                            onClick={(e) => handleMarkAsRead(n._id, e)}
                            className="inline-flex items-center gap-1 text-slate-400 hover:text-emerald-600 font-medium transition-colors"
                          >
                            <Check className="h-3 w-3" />
                            <span>Mark read</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Unread indicator dot */}
                    {isUnread && (
                      <span className="h-2 w-2 rounded-full bg-brand-600 shrink-0 self-center" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-slate-100 bg-slate-50/50 text-center">
            <Link
              href="/client/workflows"
              onClick={() => setIsOpen(false)}
              className="text-[11px] text-slate-500 hover:text-slate-700 font-medium"
            >
              Manage Automation Workflows
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
