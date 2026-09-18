'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import {
  Building2,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  ExternalLink,
  Archive,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  X,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { getClientsApi, createClientApi, archiveClientApi,  ClientItem,
} from '@/lib/clients';
import { getAccountManagersApi, AccountManagerItem } from '@/lib/api/staff';
import { getErrorMessage } from '@/lib/api';

export default function AdminClientsPage() {
  const router = useRouter();

  const [clients, setClients] = useState<ClientItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [healthFilter, setHealthFilter] = useState('all');
  const [managerFilter, setManagerFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [accountManagers, setAccountManagers] = useState<AccountManagerItem[]>([]);

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [clientToArchive, setClientToArchive] = useState<ClientItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // New Client Form
  const [newClient, setNewClient] = useState({
    name: '',
    legalName: '',
    email: '',
    phone: '',
    website: '',
    industry: 'Digital Marketing & E-Commerce',
    timezone: 'America/New_York',
    currency: 'USD',
    brandColor: '#1e40af',
    primaryAccountManagerId: '',
    backupAccountManagerId: '',
    notes: '',
  });

  const loadClients = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getClientsApi({
        page,
        limit: 10,
        search: search.trim() || undefined,
        status: statusFilter,
        health: healthFilter,
        managerId: managerFilter !== 'all' ? managerFilter : undefined,
        sortBy,
        sortOrder,
      });

      setClients(data.clients);
      setTotalCount(data.pagination.total);
      setTotalPages(data.pagination.totalPages || 1);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [page, search, statusFilter, healthFilter, managerFilter, sortBy, sortOrder]);

  useEffect(() => {
    getAccountManagersApi().then(setAccountManagers).catch(() => {});
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  // Handle Client Creation
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.name.trim()) return;

    setActionLoading(true);
    setFormError(null);
    try {
      const created = await createClientApi(newClient);
      setIsCreateModalOpen(false);
      setNewClient({
        name: '',
        legalName: '',
        email: '',
        phone: '',
        website: '',
        industry: 'Digital Marketing & E-Commerce',
        timezone: 'America/New_York',
        currency: 'USD',
        brandColor: '#1e40af',
        primaryAccountManagerId: '',
        backupAccountManagerId: '',
        notes: '',
      });
      router.push(`/admin/clients/${created._id}`);
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Archive
  const handleConfirmArchive = async () => {
    if (!clientToArchive) return;
    setActionLoading(true);
    try {
      await archiveClientApi(clientToArchive._id);
      setClientToArchive(null);
      loadClients();
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  // Status Badge Formatter
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'onboarding':
        return <Badge variant="info">Onboarding</Badge>;
      case 'paused':
        return <Badge variant="warning">Paused</Badge>;
      case 'archived':
        return <Badge variant="danger">Archived</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  // Health Badge Formatter
  const renderHealthBadge = (health: string) => {
    switch (health) {
      case 'healthy':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
            <span className="h-1.5 w-1.5 rounded-full bg-green-600"></span>
            Healthy
          </span>
        );
      case 'needs_attention':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
            Attention
          </span>
        );
      case 'at_risk':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
            <span className="h-1.5 w-1.5 rounded-full bg-red-600"></span>
            At Risk
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
            Inactive
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-sage-200/80 pb-5">
        <div>
          <h1 className="text-xl font-bold text-charcoal-900 tracking-tight flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-forest-50 border border-forest-100 text-brand-800">
              <Building2 className="h-5 w-5" />
            </span>
            Client Directory
          </h1>
          <p className="text-xs text-sage-500 mt-1">
            Manage FlumenX agency client accounts, multi-tenant workspaces, account managers, and onboarding workflows.
          </p>
        </div>
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="gap-2 h-9 text-xs font-semibold shrink-0 bg-brand-800 hover:bg-brand-900 text-white rounded-xl shadow-forest-sm"
        >
          <Plus className="h-4 w-4" />
          Provision Client
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-sage-200/90 shadow-soft-xs rounded-2xl bg-white">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-sage-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by name, email, slug..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-sage-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-800/20 focus:border-brand-800 text-charcoal-900 placeholder-sage-400 bg-white"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-semibold text-sage-500 whitespace-nowrap">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full text-xs py-1.5 px-2.5 border border-sage-200 rounded-xl bg-white text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-brand-800/20 focus:border-brand-800"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="onboarding">Onboarding</option>
                <option value="paused">Paused</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            {/* Health Filter */}
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-semibold text-sage-500 whitespace-nowrap">Health:</label>
              <select
                value={healthFilter}
                onChange={(e) => {
                  setHealthFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full text-xs py-1.5 px-2.5 border border-sage-200 rounded-xl bg-white text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-brand-800/20 focus:border-brand-800"
              >
                <option value="all">All Health Scores</option>
                <option value="healthy">Healthy</option>
                <option value="needs_attention">Needs Attention</option>
                <option value="at_risk">At Risk</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Manager Filter */}
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-semibold text-sage-500 whitespace-nowrap">Manager:</label>
              <select
                value={managerFilter}
                onChange={(e) => {
                  setManagerFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full text-xs py-1.5 px-2.5 border border-sage-200 rounded-xl bg-white text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-brand-800/20 focus:border-brand-800"
              >
                <option value="all">All Managers</option>
                {accountManagers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Filter */}
            <div className="flex items-center gap-2 md:col-span-4 lg:col-span-1">
              <label className="text-[11px] font-semibold text-sage-500 whitespace-nowrap">Sort:</label>
              <select
                value={`${sortBy}:${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split(':');
                  setSortBy(field);
                  setSortOrder(order as 'asc' | 'desc');
                  setPage(1);
                }}
                className="w-full text-xs py-1.5 px-2.5 border border-sage-200 rounded-xl bg-white text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-brand-800/20 focus:border-brand-800"
              >
                <option value="createdAt:desc">Newest First</option>
                <option value="createdAt:asc">Oldest First</option>
                <option value="name:asc">Name (A-Z)</option>
                <option value="name:desc">Name (Z-A)</option>
                <option value="onboardingProgress:desc">Progress (High-Low)</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Banner */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Clients Table */}
      <Card className="border-sage-200/90 shadow-soft-xs rounded-2xl bg-white overflow-hidden">
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center text-sage-400 gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-brand-800" />
            <span className="text-xs font-medium">Loading client directory...</span>
          </div>
        ) : clients.length === 0 ? (
          <div className="py-20 text-center text-sage-400 space-y-3">
            <Building2 className="h-10 w-10 mx-auto text-sage-300" />
            <p className="text-sm font-bold text-charcoal-900">No client workspaces found</p>
            <p className="text-xs text-sage-500 max-w-sm mx-auto">
              {search || statusFilter !== 'all' || healthFilter !== 'all'
                ? 'Try adjusting your search criteria or active filters.'
                : 'Click "Provision Client" to create your first multi-tenant workspace.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#FAFBF9] border-b border-sage-200/80 text-[11px] font-semibold text-sage-600 uppercase tracking-wider">
                  <th className="py-3 px-5">Client Workspace</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Health</th>
                  <th className="py-3 px-4">Account Manager</th>
                  <th className="py-3 px-4">Onboarding</th>
                  <th className="py-3 px-4">Members</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sage-100">
                {clients.map((client) => (
                  <tr key={client._id} className="hover:bg-forest-50/40 transition-colors group">
                    {/* Client Info */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-8 w-8 rounded-xl font-bold text-white flex items-center justify-center shrink-0 text-xs shadow-soft-xs"
                          style={{ backgroundColor: client.brandColor || '#166534' }}
                        >
                          {client.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <Link
                            href={`/admin/clients/${client._id}`}
                            className="font-semibold text-charcoal-900 hover:text-brand-800 truncate"
                          >
                            {client.name}
                          </Link>
                          <span className="text-[11px] text-sage-400 font-mono truncate">
                            /{client.slug}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">{renderStatusBadge(client.status)}</td>

                    {/* Health */}
                    <td className="py-3.5 px-4">{renderHealthBadge(client.health)}</td>

                    {/* Manager */}
                    <td className="py-3.5 px-4">
                      {client.primaryAccountManagerId ? (
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-forest-50 border border-forest-200 flex items-center justify-center text-[10px] font-bold text-brand-800 shrink-0">
                            {(typeof client.primaryAccountManagerId === 'object' && client.primaryAccountManagerId.name
                              ? client.primaryAccountManagerId.name
                              : 'AM'
                            ).slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-xs text-charcoal-900 truncate font-medium">
                            {typeof client.primaryAccountManagerId === 'object' && client.primaryAccountManagerId
                              ? client.primaryAccountManagerId.name || 'Account Manager'
                              : String(client.primaryAccountManagerId || '')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-sage-400 italic">Unassigned</span>
                      )}
                    </td>

                    {/* Onboarding Progress */}
                    <td className="py-3.5 px-4">
                      <div className="w-32">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-charcoal-900 font-semibold">{client.onboardingProgress}%</span>
                          <span className="text-[10px] text-sage-400 capitalize">{client.onboardingStatus}</span>
                        </div>
                        <div className="w-full bg-sage-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                              client.onboardingProgress === 100
                                ? 'bg-forest-600'
                                : client.onboardingProgress > 50
                                ? 'bg-brand-700'
                                : 'bg-amber-500'
                            }`}
                            style={{ width: `${client.onboardingProgress}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>

                    {/* Members Count */}
                    <td className="py-3.5 px-4 text-sage-600 font-medium">
                      {client.activeMemberCount || 0} user{client.activeMemberCount === 1 ? '' : 's'}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/admin/clients/${client._id}`}>
                          <Button variant="outline" size="sm" className="h-7 px-3 text-[11px] border-sage-200/90 rounded-xl hover:bg-sage-50 text-charcoal-900">
                            View Profile
                          </Button>
                        </Link>
                        {!client.isArchived && (
                          <button
                            type="button"
                            title="Archive Client"
                            onClick={() => setClientToArchive(client)}
                            className="p-1.5 text-sage-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {clients.length > 0 && (
          <div className="px-5 py-3.5 border-t border-sage-100 bg-[#FAFBF9] flex items-center justify-between text-xs text-sage-600">
            <span>
              Showing {clients.length} of {totalCount} workspace{totalCount === 1 ? '' : 's'}
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-7 px-2 border-sage-200/90 rounded-lg"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="px-2 font-semibold text-charcoal-900">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || isLoading}
                onClick={() => setPage((p) => p + 1)}
                className="h-7 px-2 border-sage-200/90 rounded-lg"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Provision Client Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-soft-xl max-w-xl w-full border border-sage-200/90 overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-sage-100 bg-surface/50">
              <h2 className="text-sm font-bold text-charcoal-900 flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-forest-50 text-brand-800">
                  <Building2 className="h-4 w-4" />
                </span>
                Provision Client Workspace
              </h2>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-sage-400 hover:text-charcoal-900 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-charcoal-900">
                    Client Workspace Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newClient.name}
                    onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                    placeholder="e.g. Acme Digital Media"
                    className="w-full text-xs px-3 py-2 border border-sage-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-800/20 focus:border-brand-800 text-charcoal-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-charcoal-900">Legal Business Name</label>
                  <input
                    type="text"
                    value={newClient.legalName}
                    onChange={(e) => setNewClient({ ...newClient, legalName: e.target.value })}
                    placeholder="e.g. Acme Holdings LLC"
                    className="w-full text-xs px-3 py-2 border border-sage-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-800/20 focus:border-brand-800 text-charcoal-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-charcoal-900">Contact Email</label>
                  <input
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    placeholder="billing@client.com"
                    className="w-full text-xs px-3 py-2 border border-sage-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-800/20 focus:border-brand-800 text-charcoal-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-charcoal-900">Phone</label>
                  <input
                    type="text"
                    value={newClient.phone}
                    onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                    placeholder="+1 555-0199"
                    className="w-full text-xs px-3 py-2 border border-sage-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-800/20 focus:border-brand-800 text-charcoal-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-charcoal-900">Website</label>
                  <input
                    type="text"
                    value={newClient.website}
                    onChange={(e) => setNewClient({ ...newClient, website: e.target.value })}
                    placeholder="https://client.com"
                    className="w-full text-xs px-3 py-2 border border-sage-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-800/20 focus:border-brand-800 text-charcoal-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-charcoal-900">Timezone</label>
                  <select
                    value={newClient.timezone}
                    onChange={(e) => setNewClient({ ...newClient, timezone: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-sage-200 rounded-xl bg-white text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-brand-800/20 focus:border-brand-800"
                  >
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="America/Chicago">America/Chicago (CST)</option>
                    <option value="America/Denver">America/Denver (MST)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                    <option value="UTC">UTC Universal</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-charcoal-900">Currency</label>
                  <select
                    value={newClient.currency}
                    onChange={(e) => setNewClient({ ...newClient, currency: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-sage-200 rounded-xl bg-white text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-brand-800/20 focus:border-brand-800"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="CAD">CAD ($)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-charcoal-900">Primary Account Manager</label>
                  <select
                    value={newClient.primaryAccountManagerId}
                    onChange={(e) => setNewClient({ ...newClient, primaryAccountManagerId: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-sage-200 rounded-xl bg-white text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-brand-800/20 focus:border-brand-800"
                  >
                    <option value="">-- None Assigned --</option>
                    {accountManagers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-charcoal-900">Backup Account Manager</label>
                  <select
                    value={newClient.backupAccountManagerId}
                    onChange={(e) => setNewClient({ ...newClient, backupAccountManagerId: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-sage-200 rounded-xl bg-white text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-brand-800/20 focus:border-brand-800"
                  >
                    <option value="">-- None Assigned --</option>
                    {accountManagers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-charcoal-900">Brand Primary Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newClient.brandColor}
                    onChange={(e) => setNewClient({ ...newClient, brandColor: e.target.value })}
                    className="h-8 w-12 border border-sage-200 rounded-xl cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={newClient.brandColor}
                    onChange={(e) => setNewClient({ ...newClient, brandColor: e.target.value })}
                    className="w-28 text-xs px-2.5 py-1.5 border border-sage-200 rounded-xl text-charcoal-900 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-charcoal-900">Internal Agency Notes</label>
                <textarea
                  rows={2}
                  value={newClient.notes}
                  onChange={(e) => setNewClient({ ...newClient, notes: e.target.value })}
                  placeholder="Onboarding background or key marketing requirements..."
                  className="w-full text-xs px-3 py-2 border border-sage-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-800/20 focus:border-brand-800 text-charcoal-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-sage-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={actionLoading}
                  className="border-sage-200/90 rounded-xl text-charcoal-900"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={actionLoading}
                  className="gap-1.5 bg-brand-800 hover:bg-brand-900 text-white rounded-xl shadow-forest-sm font-semibold"
                >
                  {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Create Workspace
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive Confirmation Dialog */}
      {clientToArchive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-soft-xl max-w-md w-full border border-sage-200/90 p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="text-sm font-bold text-charcoal-900">Archive Client Workspace?</h3>
            </div>
            <p className="text-xs text-sage-600 leading-relaxed">
              Are you sure you want to archive <strong>{clientToArchive.name}</strong>? Client users will lose access to
              the workspace. Historical records, CRM leads, and campaigns will be safely preserved.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setClientToArchive(null)}
                disabled={actionLoading}
                className="border-sage-200/90 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmArchive}
                disabled={actionLoading}
                className="gap-1.5 rounded-xl font-semibold"
              >
                {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm Archive
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
