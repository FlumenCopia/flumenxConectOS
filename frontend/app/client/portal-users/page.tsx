'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Search,
  X,
  Send,
  UserX,
  FileText,
  Lock,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  listPortalUsersApi,
  updatePortalUserStatusApi,
  listPortalInvitationsApi,
  inviteCustomerContactApi,
  revokePortalInvitationApi,
  PortalUserItem,
  PortalInvitationItem,
} from '@/lib/api/clientPortal';
import { getContactsApi, ContactItem } from '@/lib/conversations';

export default function ClientPortalUsersPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'invitations'>('users');
  const [users, setUsers] = useState<PortalUserItem[]>([]);
  const [invitations, setInvitations] = useState<PortalInvitationItem[]>([]);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Invite Modal
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviting, setInviting] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [usersRes, invRes, contactsRes] = await Promise.all([
        listPortalUsersApi({ status: statusFilter !== 'all' ? statusFilter : undefined }),
        listPortalInvitationsApi(),
        getContactsApi({ limit: 100 }).catch(() => ({ contacts: [], pagination: { total: 0, page: 1, limit: 100, totalPages: 0 } })),
      ]);

      if (usersRes.success && usersRes.data) {
        setUsers(usersRes.data.users || []);
      }
      if (invRes.success && invRes.data) {
        setInvitations(invRes.data.invitations || []);
      }
      if (contactsRes && contactsRes.contacts) {
        setContacts(contactsRes.contacts);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load portal accounts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Contact selection in invite modal
  const handleContactSelect = (contactId: string) => {
    setSelectedContactId(contactId);
    const found = contacts.find((c) => c._id === contactId);
    if (found) {
      setInviteEmail(found.email || '');
      setInviteName(found.name || '');
    }
  };

  // Submit Invitation
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContactId) {
      setError('Please select a contact to invite.');
      return;
    }

    setInviting(true);
    setError(null);
    try {
      const res = await inviteCustomerContactApi({
        contactId: selectedContactId,
        email: inviteEmail ? inviteEmail.trim() : undefined,
        name: inviteName ? inviteName.trim() : undefined,
      });

      if (res.success) {
        setSuccess('Invitation dispatched successfully with single-use cryptographic token.');
        setIsInviteModalOpen(false);
        setSelectedContactId('');
        setInviteEmail('');
        setInviteName('');
        await fetchData(true);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to dispatch invitation');
    } finally {
      setInviting(false);
    }
  };

  // Toggle Portal User Active / Suspended
  const handleToggleUserStatus = async (user: PortalUserItem) => {
    const nextStatus = user.status === 'active' ? 'suspended' : 'active';
    const actionLabel = nextStatus === 'active' ? 'reactivate' : 'suspend';

    if (!confirm(`Are you sure you want to ${actionLabel} access for ${user.name}?`)) return;

    try {
      const res = await updatePortalUserStatusApi(user._id, nextStatus);
      if (res.success) {
        setSuccess(`User ${user.name} has been ${nextStatus}.`);
        await fetchData(true);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to update user status');
    }
  };

  // Revoke Pending Invitation
  const handleRevokeInvitation = async (inv: PortalInvitationItem) => {
    if (!confirm(`Are you sure you want to revoke the pending invitation for ${inv.email}?`)) return;

    try {
      const res = await revokePortalInvitationApi(inv._id);
      if (res.success) {
        setSuccess(`Invitation for ${inv.email} revoked.`);
        await fetchData(true);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to revoke invitation');
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const filteredInvitations = invitations.filter((i) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return i.email.toLowerCase().includes(q) || (i.name && i.name.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-brand-50 text-brand-700">
              <Users className="h-5 w-5" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Customer Portal Users & Invitations
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Provision self-service access for clients and customers to view tickets, profile info, and shared tasks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-brand-600' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>

          <Button
            size="sm"
            onClick={() => setIsInviteModalOpen(true)}
            className="bg-brand-600 hover:bg-brand-700 text-white flex items-center gap-1.5"
          >
            <UserPlus className="h-4 w-4" />
            Invite Customer
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'users'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          Active Customer Accounts ({users.length})
        </button>

        <button
          onClick={() => setActiveTab('invitations')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'invitations'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Clock className="h-4 w-4" />
          Invitations & Access Tokens ({invitations.length})
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {activeTab === 'users' && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Accounts</option>
            <option value="suspended">Suspended Accounts</option>
          </select>
        )}
      </div>

      {/* TAB 1: PORTAL USERS */}
      {activeTab === 'users' && (
        <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-brand-600" />
              <span className="text-xs">Loading portal users...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <Users className="h-10 w-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-800">No portal users found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Invite a CRM contact to grant them access to their self-service Customer Portal.
              </p>
              <Button size="sm" onClick={() => setIsInviteModalOpen(true)} className="mt-2">
                Invite Customer Contact
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Contact Phone</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Consent</th>
                    <th className="py-3 px-4">Last Login</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((u) => (
                    <tr key={u._id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full bg-brand-100 text-brand-800 flex items-center justify-center font-bold text-xs">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{u.name}</p>
                            <p className="text-[11px] text-slate-400">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {u.phone || '—'}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <Badge variant={u.status === 'active' ? 'success' : 'danger'}>
                          {u.status.toUpperCase()}
                        </Badge>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {u.consentGiven ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Consent Active
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Not recorded</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never logged in'}
                      </td>

                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleUserStatus(u)}
                          className={`h-7 text-[11px] px-2.5 ${
                            u.status === 'active'
                              ? 'text-rose-600 hover:bg-rose-50 hover:border-rose-200'
                              : 'text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200'
                          }`}
                        >
                          {u.status === 'active' ? 'Suspend Access' : 'Reactivate Access'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 2: INVITATIONS */}
      {activeTab === 'invitations' && (
        <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-brand-600" />
              <span className="text-xs">Loading invitations...</span>
            </div>
          ) : filteredInvitations.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <Clock className="h-10 w-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-800">No invitations found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Dispatched invitations will be listed here with status tracking.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
                    <th className="py-3 px-4">Recipient</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Invited By</th>
                    <th className="py-3 px-4">Expires</th>
                    <th className="py-3 px-4">Sent Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInvitations.map((inv) => (
                    <tr key={inv._id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div>
                          <p className="font-semibold text-slate-900">{inv.name || 'Customer'}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{inv.email}</p>
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <Badge
                          variant={
                            inv.status === 'accepted'
                              ? 'success'
                              : inv.status === 'pending'
                              ? 'warning'
                              : 'neutral'
                          }
                        >
                          {inv.status.toUpperCase()}
                        </Badge>
                      </td>

                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {inv.invitedBy?.name || 'Staff Member'}
                      </td>

                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {new Date(inv.expiresAt).toLocaleDateString()}
                      </td>

                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                        {new Date(inv.createdAt).toLocaleDateString()}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {inv.status === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRevokeInvitation(inv)}
                            className="h-7 text-[11px] px-2.5 text-rose-600 hover:bg-rose-50 hover:border-rose-200"
                          >
                            Revoke Invite
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Invite Customer Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-brand-50 text-brand-700">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Invite Customer to Portal</h3>
                  <p className="text-[11px] text-slate-400">Generate a single-use onboarding link</p>
                </div>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Select Existing CRM Contact:
                </label>
                <select
                  value={selectedContactId}
                  onChange={(e) => handleContactSelect(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50"
                >
                  <option value="">-- Choose Contact --</option>
                  {contacts.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} {c.email ? `(${c.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Customer Full Name:
                </label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Recipient Email:
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="john@example.com"
                  required
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-500 space-y-1">
                <p className="font-semibold text-slate-700">Security Guarantee:</p>
                <p>
                  A 32-byte cryptographic token with SHA-256 hash storage will be generated. The recipient will be invited to set their password.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsInviteModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={inviting || !selectedContactId || !inviteEmail}
                  className="bg-brand-600 hover:bg-brand-700 text-white flex items-center gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  {inviting ? 'Dispatching...' : 'Send Invitation'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
