'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Building2, Users, Radio, AlertCircle, Plus, RefreshCw, ExternalLink, ArrowUpRight } from 'lucide-react';
import { getClientsApi, ClientItem } from '@/lib/clients';

export default function AdminDashboardPage() {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [totalClients, setTotalClients] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getClientsApi({ limit: 10, page: 1 });
      setClients(res.clients || []);
      setTotalClients(res.pagination?.total || 0);
    } catch (err) {
      console.error('Failed to load clients', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const activeClientsCount = clients.filter((c) => c.status === 'active').length;
  const attentionClientsCount = clients.filter((c) => c.health === 'needs_attention' || c.health === 'at_risk').length;

  const stats = [
    {
      label: 'Total Client Accounts',
      value: totalClients.toString(),
      change: `${activeClientsCount} active workspaces`,
      icon: Building2,
      color: 'text-brand-800',
      bg: 'bg-forest-50 border-forest-100',
    },
    {
      label: 'Client Workspaces',
      value: activeClientsCount.toString(),
      change: 'Active tenant portals',
      icon: Users,
      color: 'text-emerald-700',
      bg: 'bg-emerald-50/80 border-emerald-100',
    },
    {
      label: 'System Status',
      value: 'Operational',
      change: 'All micro-services live',
      icon: Radio,
      color: 'text-brand-700',
      bg: 'bg-forest-50 border-forest-100',
    },
    {
      label: 'Attention Required',
      value: attentionClientsCount.toString(),
      change: attentionClientsCount > 0 ? 'Accounts needing review' : 'Zero critical alerts',
      icon: AlertCircle,
      color: attentionClientsCount > 0 ? 'text-amber-700' : 'text-sage-500',
      bg: attentionClientsCount > 0 ? 'bg-amber-50 border-amber-100' : 'bg-sage-50 border-sage-100',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Super Admin Dashboard"
        description="Cross-client operations overview, integration health, and platform tenant monitoring."
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={loadClients}
              disabled={loading}
              className="text-xs border-sage-200/90 text-charcoal-900 hover:bg-sage-50 rounded-xl"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 text-sage-500 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
            <Link href="/admin/clients">
              <Button size="sm" className="text-xs bg-brand-800 hover:bg-brand-900 text-white rounded-xl shadow-forest-sm font-semibold">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                <span>New Client Account</span>
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
            <div key={idx} className="bg-white rounded-2xl border border-sage-200/90 p-5 shadow-soft-xs flex items-center justify-between hover:shadow-soft-sm transition-all duration-200">
              <div>
                <p className="text-[11px] font-semibold text-sage-500 uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-extrabold text-charcoal-900 mt-1 tracking-tight">{stat.value}</p>
                <p className="text-[11px] text-sage-600 mt-1 font-medium">{stat.change}</p>
              </div>
              <div className={`p-3 rounded-2xl border ${stat.bg}`}>
                <Icon className={`h-6 w-6 ${stat.color}`} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Client Summary Table Card */}
      <Card className="border-sage-200/90 bg-white shadow-soft-xs rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-sage-100 p-5 flex flex-row items-center justify-between bg-surface/50">
          <div>
            <CardTitle className="text-sm font-bold text-charcoal-900">Client Workspaces Overview</CardTitle>
            <p className="text-xs text-sage-500 mt-0.5">Live status and health monitoring across client tenant accounts</p>
          </div>
          <Link href="/admin/clients">
            <Button variant="outline" size="sm" className="text-xs border-sage-200/90 rounded-xl hover:bg-sage-50">
              View All Clients
            </Button>
          </Link>
        </CardHeader>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center text-xs text-sage-400 font-medium">Loading workspaces...</div>
          ) : clients.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <Building2 className="h-9 w-9 text-sage-300 mx-auto" />
              <p className="text-xs font-semibold text-charcoal-900">No client accounts created yet</p>
              <Link href="/admin/clients" className="inline-block mt-1">
                <Button size="sm" className="text-xs bg-brand-800 hover:bg-brand-900 text-white rounded-xl shadow-forest-sm">
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Create First Client
                </Button>
              </Link>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FAFBF9] border-b border-sage-200/80 text-sage-600 uppercase tracking-wider font-semibold text-[11px]">
                  <th className="py-3 px-5">Client Workspace</th>
                  <th className="py-3 px-4">Industry</th>
                  <th className="py-3 px-4">Health</th>
                  <th className="py-3 px-4">Account Manager</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sage-100">
                {clients.map((client) => {
                  const managerName =
                    typeof client.primaryAccountManagerId === 'object' && client.primaryAccountManagerId?.name
                      ? client.primaryAccountManagerId.name
                      : 'Assigned';
                  return (
                    <tr key={client._id} className="hover:bg-forest-50/40 transition-colors group">
                      <td className="py-3.5 px-5 font-semibold text-charcoal-900">
                        <Link href={`/admin/clients/${client._id}`} className="hover:text-brand-800 flex items-center gap-1.5 transition-colors">
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold shrink-0 shadow-soft-xs"
                            style={{ backgroundColor: client.brandColor || '#166534' }}
                          >
                            {client.name.slice(0, 2).toUpperCase()}
                          </div>
                          <span>{client.name}</span>
                          <ArrowUpRight className="w-3.5 h-3.5 text-sage-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 text-sage-600">{client.industry || 'General Marketing'}</td>
                      <td className="py-3.5 px-4">
                        <Badge variant={client.health === 'healthy' ? 'success' : client.health === 'at_risk' ? 'danger' : 'warning'}>
                          {client.health}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-sage-600">
                        {managerName}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant={client.status === 'active' ? 'info' : 'neutral'}>
                          {client.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <Link
                          href={`/admin/clients/${client._id}`}
                          className="text-brand-800 hover:text-brand-900 font-semibold inline-flex items-center gap-1 text-xs"
                        >
                          Manage &rarr;
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
