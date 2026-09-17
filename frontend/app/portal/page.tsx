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
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
        <p className="text-sm">Loading your portal dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900/60 via-slate-900 to-indigo-950/80 border border-indigo-500/20 p-6 sm:p-8 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center space-x-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>Verified Customer Session • {user?.clientName || 'Workspace'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Welcome back, {user?.name || 'Customer'}
            </h1>
            <p className="text-slate-300 text-sm mt-1.5 max-w-xl">
              Track your service requests, submit follow-up details, view messages, and manage communication preferences securely.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              id="overview-new-request-btn"
              href="/portal/requests?new=true"
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-600/30"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Submit Request</span>
            </Link>
            <Link
              id="overview-profile-btn"
              href="/portal/profile"
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-sm font-medium border border-slate-700/80 transition-all"
            >
              <span>Preferences</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Link
          id="overview-metric-requests"
          href="/portal/requests"
          className="group p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/40 transition-all shadow-lg hover:shadow-indigo-500/5"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Open Requests</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white">{openRequests.length}</div>
          <div className="mt-2 text-xs text-slate-400 flex items-center space-x-1">
            <span>{requests.length} total submitted</span>
            <ArrowRight className="w-3 h-3 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        <Link
          id="overview-metric-tasks"
          href="/portal/tasks"
          className="group p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 transition-all shadow-lg hover:shadow-amber-500/5"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Action Required</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white">{pendingTasks.length}</div>
          <div className="mt-2 text-xs text-amber-400/80 flex items-center space-x-1">
            <span>{pendingTasks.length > 0 ? 'Action required by you' : 'All items completed'}</span>
            <ArrowRight className="w-3 h-3 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        <Link
          id="overview-metric-conversations"
          href="/portal/conversations"
          className="group p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 transition-all shadow-lg hover:shadow-emerald-500/5"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Conversations</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white">{conversations.length}</div>
          <div className="mt-2 text-xs text-slate-400 flex items-center space-x-1">
            <span>Customer support channels</span>
            <ArrowRight className="w-3 h-3 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        <Link
          id="overview-metric-notifications"
          href="/portal/notifications"
          className="group p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-purple-500/40 transition-all shadow-lg hover:shadow-purple-500/5"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Notifications</span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Bell className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white">{unreadNotifications}</div>
          <div className="mt-2 text-xs text-slate-400 flex items-center space-x-1">
            <span>{unreadNotifications > 0 ? 'Unread alerts pending' : 'All caught up'}</span>
            <ArrowRight className="w-3 h-3 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>
      </div>

      {/* Split section: Action Items & Recent Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Recent Requests */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white tracking-tight">Recent Service Requests</h2>
            <Link
              id="overview-view-all-requests"
              href="/portal/requests"
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {requests.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800 text-center">
              <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-300 font-medium">No requests submitted yet</p>
              <p className="text-xs text-slate-500 mt-1">Have questions or need assistance? Open a support request.</p>
              <Link
                href="/portal/requests?new=true"
                className="mt-4 inline-flex items-center space-x-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
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
                  className="block p-4 rounded-xl bg-slate-900/70 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-xs font-mono font-bold text-indigo-400">{req.requestNumber}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full capitalize bg-slate-800 text-slate-300 border border-slate-700">
                          {req.category.replace('_', ' ')}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-white group-hover:text-indigo-400 transition-colors truncate">
                        {req.subject}
                      </h3>
                      <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{req.description}</p>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0">
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg capitalize ${
                          req.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : req.status === 'in_progress'
                            ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {req.status.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-slate-500 mt-2 flex items-center space-x-1">
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
            <h2 className="text-lg font-bold text-white tracking-tight">Pending Action Items</h2>
            <Link
              id="overview-view-all-tasks"
              href="/portal/tasks"
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {pendingTasks.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500/40 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-200">You're all caught up!</p>
              <p className="text-xs text-slate-500 mt-1">No pending documents or action requests required from you.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingTasks.slice(0, 3).map((task) => (
                <div
                  key={task._id}
                  className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 px-2 py-0.5 rounded bg-amber-500/10">
                      Action Required
                    </span>
                    <span className="text-xs text-slate-400">
                      Due {new Date(task.dueAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-white">{task.title}</h4>
                  {task.customerActionDescription && (
                    <p className="text-xs text-slate-300">{task.customerActionDescription}</p>
                  )}
                  <div className="pt-1">
                    <Link
                      href="/portal/tasks"
                      className="text-xs font-semibold text-amber-400 hover:text-amber-300 inline-flex items-center space-x-1"
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
          <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-xs text-slate-400 space-y-2">
            <div className="flex items-center space-x-2 text-slate-300 font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
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
