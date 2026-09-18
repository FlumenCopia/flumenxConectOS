'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  MessageSquare,
  Clock,
  CheckSquare,
  Plus,
  ArrowRight,
  RefreshCw,
  MoreHorizontal,
  ChevronDown,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getLeadsApi, LeadItem } from '@/lib/leads';
import { getConversationsApi, ConversationItem } from '@/lib/conversations';
import { getTasksApi, completeTaskApi, TaskItem } from '@/lib/tasks';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Avatar, AvatarGroup } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatCardSkeleton, TableSkeleton } from '@/components/ui/LoadingSkeleton';

export default function ClientDashboardPage() {
  const { user, activeClient } = useAuth();

  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [totalLeadsCount, setTotalLeadsCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [openTasksCount, setOpenTasksCount] = useState(0);
  const [overdueTasksCount, setOverdueTasksCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('recent-leads');
  const [chartPeriod, setChartPeriod] = useState('Last 7 Months');

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [leadsRes, convsRes, tasksRes] = await Promise.all([
        getLeadsApi({ limit: 6, page: 1 }).catch(() => null),
        getConversationsApi({ limit: 4 }).catch(() => null),
        getTasksApi({ limit: 10 }).catch(() => null),
      ]);

      if (leadsRes) {
        setLeads(leadsRes.leads || []);
        setTotalLeadsCount(leadsRes.pagination?.total || 0);
      }

      if (convsRes) {
        setConversations(convsRes.conversations || []);
        setUnreadMessagesCount(convsRes.counts?.unread ?? (convsRes.conversations?.filter(c => c.unreadCount > 0).length || 0));
      }

      if (tasksRes?.data) {
        const allTasks = tasksRes.data.tasks || [];
        setTasks(allTasks.slice(0, 5));
        const openTasks = allTasks.filter(t => t.status === 'open' || t.status === 'in_progress');
        setOpenTasksCount(openTasks.length);
        const now = new Date();
        const overdue = openTasks.filter(
          (t: TaskItem) => t.dueAt && new Date(t.dueAt) < now
        );
        setOverdueTasksCount(overdue.length);
      }
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleCompleteTask = async (taskId: string) => {
    try {
      await completeTaskApi(taskId);
      setTasks(prev => prev.map(t => t._id === taskId ? { ...t, status: 'completed' } : t));
      setOpenTasksCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to complete task', err);
    }
  };

  const userName = user?.name ? user.name.split(' ')[0] : 'John';
  const clientTitle = activeClient?.clientName || 'Acme Co.';

  const sourceColorMap: Record<string, { name: string; color: string; hex: string }> = {
    meta_ads: { name: 'Meta Ads', color: 'bg-teal-500', hex: '#14B8A6' },
    google_ads: { name: 'Google Ads', color: 'bg-brand-600', hex: '#166534' },
    elementor_form: { name: 'Website Form', color: 'bg-emerald-500', hex: '#22C55E' },
    referral: { name: 'Referral', color: 'bg-amber-500', hex: '#F59E0B' },
    manual: { name: 'Manual CRM', color: 'bg-sky-500', hex: '#0EA5E9' },
    custom_webhook: { name: 'Webhook', color: 'bg-purple-500', hex: '#A855F7' },
  };

  const dynamicSources = React.useMemo(() => {
    if (totalLeadsCount === 0 || leads.length === 0) return [];
    const counts: Record<string, number> = {};
    leads.forEach((l) => {
      const src = l.source || 'manual';
      counts[src] = (counts[src] || 0) + 1;
    });
    return Object.entries(counts).map(([src, count]) => {
      const meta = sourceColorMap[src] || { name: src, color: 'bg-sage-400', hex: '#94A3B8' };
      const pct = Math.round((count / leads.length) * 100);
      return { name: meta.name, count, percentage: pct, color: meta.color, hex: meta.hex };
    });
  }, [leads, totalLeadsCount]);

  // Lead Performance Monthly Data dynamically bucketed from real leads
  const dynamicMonthlyData = React.useMemo(() => {
    if (leads.length === 0) return [];
    const monthBuckets: Record<string, { month: string; newLeads: number; converted: number }> = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    leads.forEach((l) => {
      const d = new Date(l.createdAt || Date.now());
      const mName = months[d.getMonth()];
      if (!monthBuckets[mName]) {
        monthBuckets[mName] = { month: mName, newLeads: 0, converted: 0 };
      }
      monthBuckets[mName].newLeads += 1;
      if (l.stage === 'won') {
        monthBuckets[mName].converted += 1;
      }
    });
    return Object.values(monthBuckets);
  }, [leads]);

  const formatSourceLabel = (src: string) => {
    switch (src) {
      case 'meta_ads': return 'Meta Ads';
      case 'google_ads': return 'Google Ads';
      case 'elementor_form': return 'Website Form';
      case 'custom_webhook': return 'Webhook';
      case 'manual': return 'Manual';
      case 'referral': return 'Referral';
      default: return 'Direct';
    }
  };

  return (
    <div className="space-y-6 select-none">
      {/* Top Greeting Header (matches reference design) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-sage-900 tracking-tight flex items-center gap-2">
            <span>Good morning, {userName}!</span>
            <span className="text-xl">👋</span>
          </h1>
          <p className="text-xs text-sage-500 mt-1 font-normal">
            Here&apos;s what&apos;s happening with <span className="font-semibold text-sage-700">{clientTitle}</span> today.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadDashboardData}
            disabled={loading}
            className="text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
          <Link href="/client/leads">
            <Button size="sm" variant="primary" className="text-xs shadow-forest-sm">
              <Plus className="h-3.5 w-3.5 mr-1" />
              <span>New Lead</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* 4 KPI Stats Grid (matches reference design) */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Total Leads"
            value={totalLeadsCount.toString()}
            change={totalLeadsCount > 0 ? `${totalLeadsCount} active prospects` : 'No prospects yet'}
            isPositive={totalLeadsCount > 0}
            icon={Users}
            iconBgColor="bg-emerald-50"
            iconColor="text-emerald-700"
          />
          <StatCard
            label="Unread Messages"
            value={unreadMessagesCount.toString()}
            change={unreadMessagesCount > 0 ? `${unreadMessagesCount} unread incoming` : 'All caught up'}
            isPositive={unreadMessagesCount === 0}
            icon={MessageSquare}
            iconBgColor="bg-blue-50"
            iconColor="text-blue-600"
          />
          <StatCard
            label="Overdue Follow-ups"
            value={overdueTasksCount.toString()}
            change={overdueTasksCount > 0 ? `${overdueTasksCount} overdue tasks` : 'Zero overdue'}
            isPositive={overdueTasksCount === 0}
            icon={Clock}
            iconBgColor="bg-rose-50"
            iconColor="text-rose-600"
          />
          <StatCard
            label="Open Tasks"
            value={openTasksCount.toString()}
            change={openTasksCount > 0 ? `${openTasksCount} scheduled follow-ups` : 'No open tasks'}
            isPositive={true}
            icon={CheckSquare}
            iconBgColor="bg-teal-50"
            iconColor="text-teal-700"
          />
        </div>
      )}

      {/* Analytics & Activity Middle Section (matches reference layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 1. Lead Performance Bar Chart */}
        <div className="lg:col-span-5 bg-white border border-sage-200/90 rounded-xl p-5 shadow-soft-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-sage-900 tracking-tight">Lead Performance</h3>
              <p className="text-[11px] text-sage-500">Volume and conversion velocity</p>
            </div>
            <div className="relative">
              <select
                value={chartPeriod}
                onChange={(e) => setChartPeriod(e.target.value)}
                className="appearance-none bg-sage-50/80 border border-sage-200 rounded-lg pl-2.5 pr-6 py-1 text-xs font-semibold text-sage-700 cursor-pointer focus:outline-none"
              >
                <option>Last 7 Months</option>
                <option>Last 30 Days</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-sage-400 pointer-events-none" />
            </div>
          </div>

          {/* Bar Chart Visualization */}
          <div className="pt-2 pb-2">
            {dynamicMonthlyData.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-center p-4 border border-dashed border-sage-200 rounded-xl bg-sage-50/50">
                <BarChart3 className="w-7 h-7 text-sage-300 mb-1.5" />
                <p className="text-xs font-semibold text-sage-800">No lead performance data yet</p>
                <p className="text-[11px] text-sage-500 mt-0.5 max-w-xs">
                  Leads captured via ad campaigns, forms, or CRM will populate volume trends here.
                </p>
              </div>
            ) : (
              <div className="h-40 flex items-end justify-between gap-2 px-2 border-b border-sage-100 pb-2">
                {dynamicMonthlyData.map((item, idx) => {
                  const maxVal = Math.max(...dynamicMonthlyData.map((d) => d.newLeads), 1);
                  const heightPct = Math.round((item.newLeads / maxVal) * 100);
                  const convHeightPct = Math.round((item.converted / maxVal) * 100);
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                      <div className="w-full flex items-end justify-center gap-1 h-full">
                        {/* New Leads Bar */}
                        <div
                          style={{ height: `${Math.max(8, heightPct)}%` }}
                          className="w-3 sm:w-4 bg-emerald-600 rounded-t-sm transition-all group-hover:bg-emerald-700"
                          title={`${item.newLeads} New Leads`}
                        />
                        {/* Converted Bar */}
                        <div
                          style={{ height: `${item.converted > 0 ? Math.max(8, convHeightPct) : 0}%` }}
                          className="w-2 sm:w-2.5 bg-teal-300 rounded-t-sm transition-all group-hover:bg-teal-400"
                          title={`${item.converted} Converted`}
                        />
                      </div>
                      <span className="text-[10px] font-medium text-sage-500">{item.month}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-5 pt-3 border-t border-sage-100 text-[11px] font-medium text-sage-600">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
              <span>New Leads</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-teal-300" />
              <span>Converted</span>
            </div>
          </div>
        </div>

        {/* 2. Leads by Source Donut Breakdown */}
        <div className="lg:col-span-3 bg-white border border-sage-200/90 rounded-xl p-5 shadow-soft-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-sage-900 tracking-tight">Leads by Source</h3>
          </div>

          {/* Donut Graphic */}
          <div className="relative flex items-center justify-center my-2">
            <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#E3E8E4" strokeWidth="3" />
              {dynamicSources.length > 0 &&
                (() => {
                  let accumulated = 0;
                  return dynamicSources.map((src, idx) => {
                    const offset = -accumulated;
                    accumulated += src.percentage;
                    return (
                      <circle
                        key={idx}
                        cx="18"
                        cy="18"
                        r="15.915"
                        fill="transparent"
                        stroke={src.hex}
                        strokeWidth="3.5"
                        strokeDasharray={`${src.percentage} ${100 - src.percentage}`}
                        strokeDashoffset={offset}
                      />
                    );
                  });
                })()}
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-lg font-extrabold text-sage-900 leading-none">
                {totalLeadsCount.toString()}
              </span>
              <span className="text-[9px] font-semibold text-sage-400 mt-0.5 uppercase tracking-wider">Total Leads</span>
            </div>
          </div>

          {/* Source List */}
          {dynamicSources.length === 0 ? (
            <div className="text-center py-3 text-[11px] text-sage-400 border-t border-sage-100 mt-1">
              No sources recorded yet
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 pt-2 text-[11px]">
              {dynamicSources.map((src, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${src.color}`} />
                    <span className="text-sage-600 truncate max-w-[70px]">{src.name}</span>
                  </div>
                  <span className="font-semibold text-sage-800">{src.percentage}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Recent Conversations */}
        <div className="lg:col-span-4 bg-white border border-sage-200/90 rounded-xl p-5 shadow-soft-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-sage-900 tracking-tight">Recent Conversations</h3>
            <Link href="/client/inbox" className="text-xs font-semibold text-brand-800 hover:text-brand-900 flex items-center gap-0.5">
              <span>View all</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {conversations.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <MessageSquare className="h-7 w-7 text-sage-300 mx-auto" />
              <p className="text-xs font-medium text-sage-600">No active conversations</p>
              <p className="text-[11px] text-sage-400">WhatsApp and webchat messages appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-sage-100 flex-1">
              {conversations.slice(0, 4).map((c) => {
                const contactName = c.contactId?.name || c.subject || 'Client Contact';
                const snippet = c.lastMessageSnippet || 'Inbound inquiry received...';
                return (
                  <Link
                    key={c._id}
                    href="/client/inbox"
                    className="py-2.5 flex items-center justify-between hover:bg-sage-50/70 rounded-lg px-2 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <Avatar name={contactName} size="sm" />
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-xs font-semibold text-sage-900 truncate">{contactName}</span>
                        <span className="text-[11px] text-sage-500 truncate max-w-[150px]">{snippet}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0 ml-2">
                      <span className="text-[10px] text-sage-400">
                        {c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                      </span>
                      {c.unreadCount > 0 && (
                        <span className="mt-1 h-4 w-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          <div className="pt-3 border-t border-sage-100 text-center">
            <Link href="/client/inbox" className="text-xs font-medium text-sage-500 hover:text-brand-800">
              Open Unified Multi-channel Inbox &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Operational Bottom Section (Recent Leads & Upcoming Tasks) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Recent Leads Operational Table */}
        <div className="lg:col-span-8 bg-white border border-sage-200/90 rounded-xl shadow-soft-xs overflow-hidden flex flex-col">
          <div className="p-4 sm:p-5 border-b border-sage-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <Tabs
              tabs={[
                { id: 'recent-leads', label: 'Recent Leads', count: totalLeadsCount },
                { id: 'upcoming-tasks', label: 'Upcoming Tasks', count: openTasksCount },
                { id: 'campaigns', label: 'Campaigns' },
              ]}
              activeTab={activeTab}
              onChange={setActiveTab}
            />
            <Link href="/client/leads" className="text-xs font-semibold text-brand-800 hover:text-brand-900 flex items-center gap-0.5 shrink-0 self-end sm:self-center">
              <span>View full CRM</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto flex-1">
            {loading ? (
              <TableSkeleton rows={5} />
            ) : leads.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No leads recorded yet"
                description="Incoming leads from WhatsApp, Meta Ads, and website intake forms will stream here in real-time."
                actionLabel="Add First Lead"
                onAction={() => window.location.href = '/client/leads'}
              />
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-sage-50/70 border-b border-sage-200/80 text-[10px] text-sage-500 uppercase tracking-wider font-bold">
                    <th className="py-3 px-4 w-8">
                      <input type="checkbox" className="rounded border-sage-300 text-brand-700 focus:ring-brand-700/20" />
                    </th>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4">Stage</th>
                    <th className="py-3 px-4">Score</th>
                    <th className="py-3 px-4 hidden sm:table-cell">Last Contact</th>
                    <th className="py-3 px-4 hidden md:table-cell">Assigned</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sage-100">
                  {leads.map((lead) => {
                    const fullName = `${lead.firstName} ${lead.lastName || ''}`.trim();
                    return (
                      <tr key={lead._id} className="hover:bg-sage-50/60 transition-colors group">
                        <td className="py-3 px-4">
                          <input type="checkbox" className="rounded border-sage-300 text-brand-700 focus:ring-brand-700/20" />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={fullName} size="xs" />
                            <div>
                              <p className="font-bold text-sage-900 group-hover:text-brand-800 transition-colors">{fullName}</p>
                              <p className="text-[10px] text-sage-400">{lead.company || lead.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sage-600">
                          <div className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
                            <span>{formatSourceLabel(lead.source)}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge type="stage" value={lead.stage} />
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge type="score" value={lead.scoreTier} score={lead.score} />
                        </td>
                        <td className="py-3 px-4 text-sage-500 text-[11px] hidden sm:table-cell">
                          {new Date(lead.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 hidden md:table-cell">
                          <AvatarGroup
                            users={[
                              { name: 'Sarah Miller' },
                              { name: 'Alex Chen' },
                            ]}
                          />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            href={`/client/leads/${lead._id}`}
                            className="p-1 rounded text-sage-400 hover:text-sage-700 hover:bg-sage-100 transition-colors inline-block"
                            title="View lead details"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: Upcoming Tasks List */}
        <div className="lg:col-span-4 bg-white border border-sage-200/90 rounded-xl p-5 shadow-soft-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-sage-900 tracking-tight">Upcoming Tasks</h3>
              <p className="text-[11px] text-sage-500">Scheduled follow-ups and SLAs</p>
            </div>
            <Link href="/client/tasks" className="text-xs font-semibold text-brand-800 hover:text-brand-900 flex items-center gap-0.5">
              <span>View all</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {tasks.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <CheckSquare className="h-7 w-7 text-sage-300 mx-auto" />
              <p className="text-xs font-medium text-sage-600">Zero pending tasks</p>
              <p className="text-[11px] text-sage-400">All follow-ups and actions are complete!</p>
            </div>
          ) : (
            <div className="divide-y divide-sage-100 flex-1">
              {tasks.map((task) => (
                <div key={task._id} className="py-3 flex items-start gap-3 group">
                  <input
                    type="checkbox"
                    checked={task.status === 'completed'}
                    onChange={() => handleCompleteTask(task._id)}
                    className="mt-0.5 rounded border-sage-300 text-brand-700 focus:ring-brand-700/20 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-xs font-semibold truncate ${task.status === 'completed' ? 'line-through text-sage-400' : 'text-sage-900'}`}>
                        {task.title}
                      </p>
                      <StatusBadge type="priority" value={task.priority} />
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[11px] text-sage-400">
                      <span className="truncate max-w-[140px]">{task.description || 'Lead follow-up action'}</span>
                      <span className="font-medium text-sage-600">
                        {task.dueAt ? new Date(task.dueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-3 border-t border-sage-100 text-center">
            <Link href="/client/tasks" className="text-xs font-medium text-sage-500 hover:text-brand-800">
              Manage All Follow-up Action Items &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
