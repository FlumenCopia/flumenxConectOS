'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Users, MessageSquare, Clock, CheckSquare, Plus, ArrowRight, RefreshCw, Flame } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getLeadsApi, LeadItem } from '@/lib/leads';
import { getConversationsApi } from '@/lib/conversations';
import { getTasksApi, TaskItem } from '@/lib/tasks';

export default function ClientDashboardPage() {
  const { activeClient } = useAuth();

  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [totalLeadsCount, setTotalLeadsCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [openTasksCount, setOpenTasksCount] = useState(0);
  const [overdueTasksCount, setOverdueTasksCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [leadsRes, convsRes, tasksRes] = await Promise.all([
        getLeadsApi({ limit: 5, page: 1 }).catch(() => null),
        getConversationsApi({ unreadOnly: true, limit: 1 }).catch(() => null),
        getTasksApi({ status: 'open', limit: 50 }).catch(() => null),
      ]);

      if (leadsRes) {
        setLeads(leadsRes.leads || []);
        setTotalLeadsCount(leadsRes.pagination?.total || 0);
      }

      if (convsRes) {
        setUnreadMessagesCount(convsRes.counts?.unread || 0);
      }

      if (tasksRes?.data) {
        const openTasks = tasksRes.data.tasks || [];
        setOpenTasksCount(openTasks.length);
        const now = new Date();
        const overdue = openTasks.filter(
          (t: TaskItem) => t.dueAt && new Date(t.dueAt) < now && t.status !== 'completed'
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

  const stats = [
    {
      label: 'Total Leads',
      value: totalLeadsCount.toString(),
      change: totalLeadsCount === 0 ? 'No leads recorded yet' : 'In CRM pipeline',
      icon: Users,
      color: 'text-brand-800',
    },
    {
      label: 'Unread Messages',
      value: unreadMessagesCount.toString(),
      change: unreadMessagesCount === 0 ? 'Inbox up to date' : 'Awaiting client response',
      icon: MessageSquare,
      color: 'text-blue-600',
    },
    {
      label: 'Overdue Follow-ups',
      value: overdueTasksCount.toString(),
      change: overdueTasksCount === 0 ? 'Zero overdue items' : 'Follow-up needed',
      icon: Clock,
      color: overdueTasksCount > 0 ? 'text-red-600' : 'text-slate-500',
    },
    {
      label: 'Open Tasks',
      value: openTasksCount.toString(),
      change: openTasksCount === 0 ? 'All tasks complete' : 'Active action items',
      icon: CheckSquare,
      color: 'text-amber-600',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${activeClient?.clientName || 'Client Workspace'} - Operations`}
        description="Daily marketing operations, incoming leads, unified messaging, and pipeline performance."
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadDashboardData}
              disabled={loading}
              className="text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
            <Link href="/client/inbox">
              <Button variant="outline" size="sm" className="text-xs">
                <MessageSquare className="h-3.5 w-3.5 mr-1" />
                <span>Open Inbox</span>
              </Button>
            </Link>
            <Link href="/client/leads">
              <Button size="sm" className="text-xs bg-brand-800 hover:bg-brand-700 text-white">
                <Plus className="h-3.5 w-3.5 mr-1" />
                <span>Add Lead</span>
              </Button>
            </Link>
          </div>
        }
      />

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <Card key={idx} className="border-slate-200 bg-white shadow-xs">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{stat.label}</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
                  <p className="text-[11px] text-slate-500 mt-1">{stat.change}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Leads Section */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <CardHeader className="border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-slate-900">Recent Incoming Leads</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">Live CRM stream across connected acquisition channels</p>
          </div>
          <Link href="/client/leads">
            <Button variant="outline" size="sm" className="text-xs">
              <span>View Full CRM</span>
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading leads...</div>
          ) : leads.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Users className="h-8 w-8 text-slate-300 mx-auto" />
              <p className="text-xs font-medium text-slate-700">No leads recorded yet</p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Incoming leads from WhatsApp, Meta Ads, and website intake forms will appear here in real-time.
              </p>
              <Link href="/client/leads" className="inline-block mt-2">
                <Button size="sm" className="text-xs bg-brand-800 text-white">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add First Lead
                </Button>
              </Link>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Lead Name</th>
                  <th className="py-3 px-4">Acquisition Source</th>
                  <th className="py-3 px-4">Stage</th>
                  <th className="py-3 px-4">Score Tier</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((lead) => {
                  const fullName = `${lead.firstName} ${lead.lastName || ''}`.trim();
                  return (
                    <tr key={lead._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">{fullName}</td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-medium capitalize">
                          {lead.source.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant={lead.stage === 'won' ? 'success' : lead.stage === 'lost' ? 'danger' : 'info'}>
                          {lead.stage}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4">
                        {lead.scoreTier === 'hot' ? (
                          <span className="inline-flex items-center gap-1 text-rose-700 font-semibold">
                            <Flame className="w-3 h-3 text-rose-500 fill-rose-500" />
                            Hot ({lead.score})
                          </span>
                        ) : (
                          <span className="text-slate-600 capitalize">{lead.scoreTier || 'Cold'}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/client/leads/${lead._id}`}
                          className="text-brand-800 hover:text-brand-900 font-semibold"
                        >
                          View Lead &rarr;
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
