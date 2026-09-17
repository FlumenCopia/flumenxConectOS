'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Building2, Users, Radio, AlertCircle, Plus, RefreshCw, ExternalLink } from 'lucide-react';
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
    },
    {
      label: 'Client Workspaces',
      value: activeClientsCount.toString(),
      change: 'Active tenant portals',
      icon: Users,
      color: 'text-green-600',
    },
    {
      label: 'System Status',
      value: 'Operational',
      change: 'All core micro-services live',
      icon: Radio,
      color: 'text-blue-600',
    },
    {
      label: 'Attention Required',
      value: attentionClientsCount.toString(),
      change: attentionClientsCount > 0 ? 'Accounts needing review' : 'Zero critical alerts',
      icon: AlertCircle,
      color: attentionClientsCount > 0 ? 'text-amber-600' : 'text-slate-500',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Super Admin Dashboard"
        description="Cross-client operations overview, integration health, and platform monitoring."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadClients}
              disabled={loading}
              className="text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
            <Link href="/admin/clients">
              <Button size="sm" className="text-xs bg-brand-800 hover:bg-brand-700 text-white">
                <Plus className="h-3.5 w-3.5 mr-1" />
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

      {/* Client Summary Table Card */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <CardHeader className="border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-slate-900">Client Workspaces Overview</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">Live status and health monitoring across client accounts</p>
          </div>
          <Link href="/admin/clients">
            <Button variant="outline" size="sm" className="text-xs">
              View All Clients
            </Button>
          </Link>
        </CardHeader>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading workspaces...</div>
          ) : clients.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Building2 className="h-8 w-8 text-slate-300 mx-auto" />
              <p className="text-xs font-medium text-slate-700">No client accounts created yet</p>
              <Link href="/admin/clients" className="inline-block mt-2">
                <Button size="sm" className="text-xs bg-brand-800 text-white">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Create First Client
                </Button>
              </Link>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Client Workspace</th>
                  <th className="py-3 px-4">Industry</th>
                  <th className="py-3 px-4">Health</th>
                  <th className="py-3 px-4">Account Manager</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients.map((client) => {
                  const managerName =
                    typeof client.primaryAccountManagerId === 'object' && client.primaryAccountManagerId?.name
                      ? client.primaryAccountManagerId.name
                      : 'Assigned';
                  return (
                    <tr key={client._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <Link href={`/admin/clients/${client._id}`} className="hover:text-brand-800 flex items-center gap-1.5">
                          <span>{client.name}</span>
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">{client.industry || 'General Marketing'}</td>
                      <td className="py-3.5 px-4">
                        <Badge variant={client.health === 'healthy' ? 'success' : client.health === 'at_risk' ? 'danger' : 'warning'}>
                          {client.health}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {managerName}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant={client.status === 'active' ? 'info' : 'neutral'}>
                          {client.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/admin/clients/${client._id}`}
                          className="text-brand-800 hover:text-brand-900 font-semibold"
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
