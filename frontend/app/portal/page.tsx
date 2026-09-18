'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePortalAuth } from '@/context/PortalAuthContext';
import {
  portalListRequestsApi,
  portalListTasksApi,
  portalListConversationsApi,
  portalGetUnreadCountApi,
  CustomerRequestItem,
  PortalTaskItem,
  PortalConversationItem,
} from '@/lib/api/portal';
import {
  FileText,
  CheckSquare,
  MessageSquare,
  Bell,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  PlusCircle,
  Loader2,
} from 'lucide-react';

export default function PortalOverviewPage() {
  const { user } = usePortalAuth();
  const [requests, setRequests] = useState<CustomerRequestItem[]>([]);
  const [tasks, setTasks] = useState<PortalTaskItem[]>([]);
  const [conversations, setConversations] = useState<PortalConversationItem[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadOverviewData = async () => {
      try {
        const [reqs, tsks, convs, notifCount] = await Promise.all([
          portalListRequestsApi({ limit: 5 }),
          portalListTasksApi(),
          portalListConversationsApi(),
          portalGetUnreadCountApi(),
        ]);

        if (isMounted) {
          setRequests(reqs.requests);
          setTasks(tsks);
          setConversations(convs);
          setUnreadNotifications(notifCount);
        }
      } catch (err) {
        console.error('Failed to load overview data', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadOverviewData();
    return () => {
      isMounted = false;
    };
  }, []);

  const pendingTasks = tasks.filter((t) => t.customerActionRequired && !t.customerCompletedAt);
  const openRequests = requests.filter((r) => r.status !== 'completed' && r.status !== 'closed');

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-sage-400">
        <Loader2 className="w-8 h-8 animate-spin text-brand-800 mb-3" />
        <p className="text-xs font-semibold text-sage-600">Loading your portal dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-900 via-forest-900 to-brand-950 border border-forest-800/40 p-6 sm:p-8 shadow-soft-lg text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(34,197,94,0.15),transparent_60%)] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center space-x-2 text-forest-200 text-xs font-bold uppercase tracking-wider mb-2">
              <ShieldCheck className="w-4 h-4 text-forest-300" />
              <span>Verified Customer Session • {user?.clientName || 'Workspace'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Welcome back, {user?.name || 'Customer'}
            </h1>
            <p className="text-forest-100/90 text-xs sm:text-sm mt-1.5 max-w-xl leading-relaxed">
              Track your service requests, complete action items, reply to messages, and manage communication preferences securely.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              id="overview-new-request-btn"
              href="/portal/requests?new=true"
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-white text-brand-900 hover:bg-forest-50 text-xs font-bold transition-all shadow-soft-sm"
            >
              <PlusCircle className="w-4 h-4 text-brand-800" />
              <span>Submit Request</span>
            </Link>
            <Link
              id="overview-profile-btn"
              href="/portal/profile"
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/15 transition-all backdrop-blur-xs"
            >
              <span>Preferences</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          id="overview-metric-requests"
          href="/portal/requests"
          className="group p-5 rounded-2xl bg-white border border-sage-200/90 hover:border-brand-800/40 transition-all shadow-soft-xs hover:shadow-soft-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-sage-500">Open Requests</span>
            <div className="w-9 h-9 rounded-xl bg-forest-50 border border-forest-100 text-brand-800 flex items-center justify-center group-hover:scale-105 transition-transform">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-charcoal-900 tracking-tight">{openRequests.length}</div>
          <div className="mt-2 text-xs text-sage-500 flex items-center space-x-1 font-medium">
            <span>{requests.length} total submitted</span>
            <ArrowRight className="w-3.5 h-3.5 text-sage-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        <Link
          id="overview-metric-tasks"
          href="/portal/tasks"
          className="group p-5 rounded-2xl bg-white border border-sage-200/90 hover:border-amber-500/40 transition-all shadow-soft-xs hover:shadow-soft-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-sage-500">Action Required</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-105 transition-transform">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-charcoal-900 tracking-tight">{pendingTasks.length}</div>
          <div className="mt-2 text-xs text-amber-700/90 flex items-center space-x-1 font-semibold">
            <span>{pendingTasks.length > 0 ? 'Action required by you' : 'All items completed'}</span>
            <ArrowRight className="w-3.5 h-3.5 text-amber-600 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        <Link
          id="overview-metric-conversations"
          href="/portal/conversations"
          className="group p-5 rounded-2xl bg-white border border-sage-200/90 hover:border-brand-800/40 transition-all shadow-soft-xs hover:shadow-soft-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-sage-500">Conversations</span>
            <div className="w-9 h-9 rounded-xl bg-forest-50 border border-forest-100 text-brand-800 flex items-center justify-center group-hover:scale-105 transition-transform">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-charcoal-900 tracking-tight">{conversations.length}</div>
          <div className="mt-2 text-xs text-sage-500 flex items-center space-x-1 font-medium">
            <span>Customer support channels</span>
            <ArrowRight className="w-3.5 h-3.5 text-sage-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        <Link
          id="overview-metric-notifications"
          href="/portal/notifications"
          className="group p-5 rounded-2xl bg-white border border-sage-200/90 hover:border-brand-800/40 transition-all shadow-soft-xs hover:shadow-soft-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-sage-500">Notifications</span>
            <div className="w-9 h-9 rounded-xl bg-forest-50 border border-forest-100 text-brand-800 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Bell className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-charcoal-900 tracking-tight">{unreadNotifications}</div>
          <div className="mt-2 text-xs text-sage-500 flex items-center space-x-1 font-medium">
            <span>{unreadNotifications > 0 ? 'Unread alerts pending' : 'All caught up'}</span>
            <ArrowRight className="w-3.5 h-3.5 text-sage-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>
      </div>

      {/* Split section: Action Items & Recent Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Requests */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-charcoal-900 tracking-tight">Recent Service Requests</h2>
            <Link
              id="overview-view-all-requests"
              href="/portal/requests"
              className="text-xs font-semibold text-brand-800 hover:text-brand-900 flex items-center space-x-1"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {requests.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white border border-sage-200/90 text-center shadow-soft-xs space-y-2">
              <FileText className="w-10 h-10 text-sage-300 mx-auto mb-2" />
              <p className="text-sm text-charcoal-900 font-bold">No requests submitted yet</p>
              <p className="text-xs text-sage-500">Have questions or need assistance? Open a customer support request.</p>
              <Link
                href="/portal/requests?new=true"
                className="mt-3 inline-flex items-center space-x-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-brand-800 hover:bg-brand-900 text-white transition-colors shadow-forest-sm"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Open First Request</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.slice(0, 4).map((req) => (
                <Link
                  key={req._id}
                  href={`/portal/requests/${req._id}`}
                  className="block p-4 rounded-2xl bg-white hover:bg-forest-50/40 border border-sage-200/90 hover:border-brand-800/30 transition-all shadow-soft-xs group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1.5">
                        <span className="text-xs font-mono font-bold text-brand-800 bg-forest-50 px-2 py-0.5 rounded-full border border-forest-100">
                          {req.requestNumber}
                        </span>
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full capitalize bg-sage-50 text-sage-700 border border-sage-200 font-medium">
                          {req.category.replace('_', ' ')}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-charcoal-900 group-hover:text-brand-800 transition-colors truncate">
                        {req.subject}
                      </h3>
                      <p className="text-xs text-sage-500 line-clamp-1 mt-0.5">{req.description}</p>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0">
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize ${
                          req.status === 'completed'
                            ? 'bg-forest-50 text-forest-800 border border-forest-200'
                            : req.status === 'in_progress'
                            ? 'bg-blue-50 text-blue-800 border border-blue-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {req.status.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-sage-400 mt-2 flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right Col: Action Items / Tasks */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-charcoal-900 tracking-tight">Pending Action Items</h2>
            <Link
              id="overview-view-all-tasks"
              href="/portal/tasks"
              className="text-xs font-semibold text-brand-800 hover:text-brand-900 flex items-center space-x-1"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {pendingTasks.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white border border-sage-200/90 text-center shadow-soft-xs space-y-1">
              <CheckCircle2 className="w-9 h-9 text-forest-600 mx-auto mb-2" />
              <p className="text-sm font-bold text-charcoal-900">You&apos;re all caught up!</p>
              <p className="text-xs text-sage-500">No pending documents or action requests required from you.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingTasks.slice(0, 3).map((task) => (
                <div
                  key={task._id}
                  className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-2 shadow-soft-xs"
                >
                  <div className="flex items-start justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 px-2 py-0.5 rounded-full bg-amber-100 border border-amber-200">
                      Action Required
                    </span>
                    <span className="text-xs text-sage-500 font-medium">
                      Due {new Date(task.dueAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-charcoal-900">{task.title}</h4>
                  {task.customerActionDescription && (
                    <p className="text-xs text-sage-600 leading-relaxed">{task.customerActionDescription}</p>
                  )}
                  <div className="pt-1">
                    <Link
                      href="/portal/tasks"
                      className="text-xs font-bold text-amber-800 hover:text-amber-900 inline-flex items-center space-x-1"
                    >
                      <span>Complete Action</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Customer Privacy & Security Assurance */}
          <div className="p-5 rounded-2xl bg-white border border-sage-200/90 shadow-soft-xs text-xs text-sage-500 space-y-2">
            <div className="flex items-center space-x-2 text-charcoal-900 font-bold">
              <ShieldCheck className="w-4 h-4 text-forest-700" />
              <span>Tenant Security & Isolation</span>
            </div>
            <p className="leading-relaxed">
              Your customer data is strictly isolated to {user?.clientName || 'your organization'} with encrypted data transfers, zero cross-tenant leakage, and strict RBAC protections.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
