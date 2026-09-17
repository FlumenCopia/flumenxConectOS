'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  Search,
  RefreshCw,
  Mail,
  CheckCircle2,
  AlertCircle,
  X,
  MoreVertical,
  Building2,
  KeyRound,
  Filter,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getClientsApi, ClientItem } from '@/lib/clients';
import { getStaffUsersApi, inviteStaffUserApi, updateStaffStatusApi, StaffUserItem } from '@/lib/api/staff';
import { getRolesApi, RoleItem } from '@/lib/api/roles';
import { getErrorMessage } from '@/lib/api';

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'client_admin' | 'client_staff';
  roleTitle: string;
  assignedClients: string[];
  status: 'active' | 'suspended';
  lastActiveAt: string;
  joinedAt: string;
}

export default function AdminUsersPage() {
  const [staffList, setStaffList] = useState<StaffUserItem[]>([]);
  const [availableRoles, setAvailableRoles] = useState<RoleItem[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Invite Modal
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('client_staff');
  const [inviteRoleTitle, setInviteRoleTitle] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadStaffData = async () => {
    setLoading(true);
    try {
      const users = await getStaffUsersApi({
        search: searchQuery || undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined,
      });
      setStaffList(users);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [clientsRes, rolesRes] = await Promise.all([
          getClientsApi({ limit: 100 }),
          getRolesApi(),
        ]);
        if (clientsRes?.clients) setClients(clientsRes.clients);
        if (rolesRes) setAvailableRoles(rolesRes);
      } catch {
        // Fallback silently if metadata query fails
      }
    };
    loadMetadata();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadStaffData();
    }, 200);
    return () => clearTimeout(timeout);
  }, [searchQuery, roleFilter]);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const selectedRoleObj = availableRoles.find((r) => r.slug === inviteRole);
      const defaultTitle = selectedRoleObj ? selectedRoleObj.name : 'Staff Member';

      await inviteStaffUserApi({
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        role: inviteRole,
        roleTitle: inviteRoleTitle.trim() || defaultTitle,
        clientId: selectedClient || undefined,
      });

      await loadStaffData();
      setIsInviteModalOpen(false);
      setInviteName('');
      setInviteEmail('');
      setInviteRoleTitle('');
      setSelectedClient('');
      setSuccess(`Staff user ${inviteEmail.trim()} successfully registered.`);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: StaffUserItem) => {
    if (user.role === 'super_admin' && user.email === 'admin@flumenx.com') {
      alert('The root Super Administrator account cannot be suspended.');
      return;
    }

    const nextStatus = user.status === 'active' ? 'suspended' : 'active';
    try {
      await updateStaffStatusApi(user.id, nextStatus);
      await loadStaffData();
      setSuccess(`User ${user.name} is now ${nextStatus}.`);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

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
              Agency Staff & User Directory
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Manage internal agency account directors, media buyers, copywriters, and platform administrators.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={() => setIsInviteModalOpen(true)}
            className="bg-brand-600 hover:bg-brand-700 text-white flex items-center gap-1.5"
          >
            <UserPlus className="h-4 w-4" />
            Invite Team Member
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Agency Staff</span>
            <div className="mt-2 text-2xl font-bold text-slate-900">{staffList.length}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Active agency personnel</div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Super Admins</span>
            <div className="mt-2 text-2xl font-bold text-brand-700">
              {staffList.filter((u) => u.role === 'super_admin').length}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Global system privileges</div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Account Directors</span>
            <div className="mt-2 text-2xl font-bold text-slate-900">
              {staffList.filter((u) => u.role === 'client_admin').length}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Assigned to client workspaces</div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Active Status</span>
            <div className="mt-2 text-2xl font-bold text-emerald-700">
              {staffList.filter((u) => u.status === 'active').length}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">0 suspended accounts</div>
          </CardContent>
        </Card>
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

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search staff by name, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="all">All Roles</option>
            {availableRoles.length > 0 ? (
              availableRoles.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.name}
                </option>
              ))
            ) : (
              <>
                <option value="super_admin">Super Admins</option>
                <option value="client_admin">Client Admins / AMs</option>
                <option value="client_staff">Media Buyers & Staff</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* Staff Table */}
      <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
                <th className="py-3 px-4">Team Member</th>
                <th className="py-3 px-4">Role & Level</th>
                <th className="py-3 px-4">Assigned Workspaces</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Last Activity</th>
                <th className="py-3 px-4">Joined Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staffList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                    {loading ? 'Loading team members...' : 'No team members found matching your search.'}
                  </td>
                </tr>
              ) : (
                staffList.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                          {u.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{u.name}</p>
                          <p className="text-[11px] text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            u.role === 'super_admin'
                              ? 'brand'
                              : u.role === 'client_admin'
                              ? 'info'
                              : 'neutral'
                          }
                        >
                          {u.roleTitle}
                        </Badge>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {u.assignedClients.map((clientName, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700"
                          >
                            {clientName}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <Badge variant={u.status === 'active' ? 'success' : 'danger'}>
                        {u.status.toUpperCase()}
                      </Badge>
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap text-[11px]">
                      {u.lastActiveAt.includes('T') ? new Date(u.lastActiveAt).toLocaleString() : u.lastActiveAt}
                    </td>

                    <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap text-[11px]">
                      {new Date(u.joinedAt).toLocaleDateString()}
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleStatus(u)}
                        className={`h-7 text-[11px] px-2.5 ${
                          u.status === 'active'
                            ? 'text-rose-600 hover:bg-rose-50 hover:border-rose-200'
                            : 'text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200'
                        }`}
                      >
                        {u.status === 'active' ? 'Suspend' : 'Reactivate'}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Invite Staff Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-brand-50 text-brand-700">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Invite Agency Staff Member</h3>
                  <p className="text-[11px] text-slate-400">Issue secure one-time onboarding link</p>
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
                <label className="block font-semibold text-slate-700 mb-1">Full Name:</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. Alex Rivera"
                  required
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Agency Email:</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="alex.rivera@flumenx.com"
                  required
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">System Role:</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50"
                >
                  {availableRoles.length > 0 ? (
                    availableRoles.map((r) => (
                      <option key={r.slug} value={r.slug}>
                        {r.name}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="client_staff">Client Staff / Specialist</option>
                      <option value="client_admin">Account Director / Workspace Admin</option>
                      <option value="super_admin">Super Administrator (Global)</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Job Title / Specialty:</label>
                <input
                  type="text"
                  value={inviteRoleTitle}
                  onChange={(e) => setInviteRoleTitle(e.target.value)}
                  placeholder="e.g. Senior Paid Ads Strategist"
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assigned Client Workspace:</label>
                <select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50"
                >
                  <option value="">All Workspaces / Floating Account Manager</option>
                  {clients.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
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
                  disabled={isSubmitting || !inviteName || !inviteEmail}
                  className="bg-brand-600 hover:bg-brand-700 text-white"
                >
                  {isSubmitting ? 'Sending...' : 'Send Invitation'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
