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
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-sage-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-forest-50 text-forest-800 border border-forest-100">
              <Users className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-charcoal-900">
              Customer Portal Users & Invitations
            </h1>
          </div>
          <p className="mt-1 text-xs text-sage-500">
            Provision self-service access for clients and customers to view tickets, profile info, and shared tasks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-2 rounded-xl border-sage-200 hover:bg-sage-50 text-charcoal-700 shadow-soft-xs"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-brand-800' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>

          <Button
            size="sm"
            onClick={() => setIsInviteModalOpen(true)}
            className="bg-brand-800 hover:bg-brand-900 text-white flex items-center gap-1.5 rounded-xl shadow-soft-xs px-4"
          >
            <UserPlus className="h-4 w-4" />
            Invite Customer
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {success && (
        <div className="p-3.5 bg-forest-50/80 border border-forest-200 rounded-xl text-xs text-forest-900 flex items-center justify-between shadow-soft-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-forest-600" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-forest-700 hover:text-forest-900 p-1">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between shadow-soft-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800 p-1">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-sage-200 gap-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3.5 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'users'
              ? 'border-brand-800 text-brand-900'
              : 'border-transparent text-sage-500 hover:text-charcoal-800'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          Active Customer Accounts ({users.length})
        </button>

        <button
          onClick={() => setActiveTab('invitations')}
          className={`pb-3.5 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'invitations'
              ? 'border-brand-800 text-brand-900'
              : 'border-transparent text-sage-500 hover:text-charcoal-800'
          }`}
        >
          <Clock className="h-4 w-4" />
          Invitations & Access Tokens ({invitations.length})
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-sage-200/90 shadow-soft-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-sage-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-sage-200 bg-sage-50/50 text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-brand-800/20 focus:border-brand-800 transition"
          />
        </div>

        {activeTab === 'users' && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-white border border-sage-200 rounded-xl px-3 py-2 font-medium text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-brand-800/20 focus:border-brand-800 transition shadow-soft-xs"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Accounts</option>
            <option value="suspended">Suspended Accounts</option>
          </select>
        )}
      </div>

      {/* TAB 1: PORTAL USERS */}
      {activeTab === 'users' && (
        <Card className="border-sage-200/90 shadow-soft-xs overflow-hidden bg-white rounded-2xl">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-sage-400 gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-brand-800" />
              <span className="text-xs">Loading portal users...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <Users className="h-10 w-10 text-sage-300 mx-auto" />
              <h3 className="text-sm font-semibold text-charcoal-900">No portal users found</h3>
              <p className="text-xs text-sage-500 max-w-sm mx-auto">
                Invite a CRM contact to grant them access to their self-service Customer Portal.
              </p>
              <Button size="sm" onClick={() => setIsInviteModalOpen(true)} className="mt-2 bg-brand-800 hover:bg-brand-900 text-white rounded-xl">
                Invite Customer Contact
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-sage-50/70 border-b border-sage-200/90 text-[11px] font-semibold text-sage-600 uppercase">
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Contact Phone</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Consent</th>
                    <th className="py-3 px-4">Last Login</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sage-100">
                  {filteredUsers.map((u) => (
                    <tr key={u._id} className="hover:bg-sage-50/50 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-forest-100 text-forest-800 flex items-center justify-center font-bold text-xs border border-forest-200">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-charcoal-900">{u.name}</p>
                            <p className="text-[11px] text-sage-400">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-charcoal-700 whitespace-nowrap">
                        {u.phone || '—'}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <Badge variant={u.status === 'active' ? 'success' : 'danger'}>
                          {u.status.toUpperCase()}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {u.consentGiven ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-forest-800 font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5 text-forest-600" /> Consent Active
                          </span>
                        ) : (
                          <span className="text-sage-400 text-[11px]">Not recorded</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-sage-500 whitespace-nowrap">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never logged in'}
                      </td>

                      <td className="py-3.5 px-4 text-sage-400 whitespace-nowrap">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleUserStatus(u)}
                          className={`h-7 text-[11px] px-2.5 rounded-lg ${
                            u.status === 'active'
                              ? 'text-rose-600 hover:bg-rose-50 border-rose-200'
                              : 'text-forest-700 hover:bg-forest-50 border-forest-200'
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
        <Card className="border-sage-200/90 shadow-soft-xs overflow-hidden bg-white rounded-2xl">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-sage-400 gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-brand-800" />
              <span className="text-xs">Loading invitations...</span>
            </div>
          ) : filteredInvitations.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <Clock className="h-10 w-10 text-sage-300 mx-auto" />
              <h3 className="text-sm font-semibold text-charcoal-900">No invitations found</h3>
              <p className="text-xs text-sage-500 max-w-sm mx-auto">
                Dispatched invitations will be listed here with status tracking.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-sage-50/70 border-b border-sage-200/90 text-[11px] font-semibold text-sage-600 uppercase">
                    <th className="py-3 px-4">Recipient</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Invited By</th>
                    <th className="py-3 px-4">Expires</th>
                    <th className="py-3 px-4">Sent Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sage-100">
                  {filteredInvitations.map((inv) => (
                    <tr key={inv._id} className="hover:bg-sage-50/50 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div>
                          <p className="font-semibold text-charcoal-900">{inv.name || 'Customer'}</p>
                          <p className="text-[11px] text-sage-400 font-mono">{inv.email}</p>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
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

                      <td className="py-3.5 px-4 text-charcoal-700 whitespace-nowrap">
                        {inv.invitedBy?.name || 'Staff Member'}
                      </td>

                      <td className="py-3.5 px-4 text-sage-500 whitespace-nowrap">
                        {new Date(inv.expiresAt).toLocaleDateString()}
                      </td>

                      <td className="py-3.5 px-4 text-sage-400 whitespace-nowrap">
                        {new Date(inv.createdAt).toLocaleDateString()}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {inv.status === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRevokeInvitation(inv)}
                            className="h-7 text-[11px] px-2.5 rounded-lg text-rose-600 hover:bg-rose-50 border-rose-200"
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
        <div className="fixed inset-0 z-50 bg-charcoal-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-sage-200/90 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-sage-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-forest-50 text-forest-800 border border-forest-100">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-charcoal-900 text-base">Invite Customer to Portal</h3>
                  <p className="text-[11px] text-sage-500">Generate a single-use onboarding link</p>
                </div>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="text-sage-400 hover:text-charcoal-700 p-1.5 rounded-lg transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block font-semibold text-charcoal-800 mb-1">
                  Select Existing CRM Contact:
                </label>
                <select
                  value={selectedContactId}
                  onChange={(e) => handleContactSelect(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-xl border border-sage-200 focus:outline-none focus:ring-2 focus:ring-brand-800/20 focus:border-brand-800 bg-sage-50/50 text-charcoal-900 transition"
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
                <label className="block font-semibold text-charcoal-800 mb-1">
                  Customer Full Name:
                </label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full p-2.5 rounded-xl border border-sage-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-800/20 focus:border-brand-800 text-charcoal-900 transition"
                />
              </div>

              <div>
                <label className="block font-semibold text-charcoal-800 mb-1">
                  Recipient Email:
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="john@example.com"
                  required
                  className="w-full p-2.5 rounded-xl border border-sage-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-800/20 focus:border-brand-800 text-charcoal-900 transition"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-forest-50/50 border border-forest-100 text-[11px] text-sage-600 space-y-1">
                <p className="font-semibold text-forest-900">Security Guarantee:</p>
                <p className="text-forest-800 leading-relaxed">
                  A 32-byte cryptographic token with SHA-256 hash storage will be generated. The recipient will be invited to set their password.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="rounded-xl border-sage-200 text-charcoal-700 hover:bg-sage-50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={inviting || !selectedContactId || !inviteEmail}
                  className="bg-brand-800 hover:bg-brand-900 text-white flex items-center gap-1.5 rounded-xl shadow-soft-xs px-4"
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
