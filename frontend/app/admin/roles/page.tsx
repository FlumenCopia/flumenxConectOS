'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Shield,
  Lock,
  Plus,
  Check,
  X,
  Search,
  Filter,
  Users,
  AlertCircle,
  CheckCircle2,
  Settings,
  HelpCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getRolesApi, createRoleApi, deleteRoleApi, RoleItem } from '@/lib/api/roles';
import { getErrorMessage } from '@/lib/api';

interface PermissionCapability {
  code: string;
  module: string;
  name: string;
  description: string;
}

const ALL_PERMISSIONS: PermissionCapability[] = [
  // Clients
  { code: 'clients.create', module: 'Clients', name: 'Create Clients', description: 'Provision new client workspaces' },
  { code: 'clients.update', module: 'Clients', name: 'Update Clients', description: 'Modify client settings and profiles' },
  { code: 'clients.archive', module: 'Clients', name: 'Archive Clients', description: 'Archive and deactivate client workspaces' },
  { code: 'clients.manage_users', module: 'Clients', name: 'Manage Client Users', description: 'Invite, edit, or remove client workspace users' },
  { code: 'clients.assign_managers', module: 'Clients', name: 'Assign Account Managers', description: 'Assign primary and backup account managers' },
  // Leads & CRM
  { code: 'leads.view', module: 'Leads & CRM', name: 'View Leads', description: 'View CRM leads and pipeline' },
  { code: 'leads.create', module: 'Leads & CRM', name: 'Create Leads', description: 'Create manual leads and import CSV' },
  { code: 'leads.update', module: 'Leads & CRM', name: 'Update Leads', description: 'Update lead stages and status' },
  { code: 'leads.delete', module: 'Leads & CRM', name: 'Delete Leads', description: 'Archive or remove leads' },
  { code: 'leads.export', module: 'Leads & CRM', name: 'Export Leads', description: 'Export leads to CSV' },
  // Unified Inbox
  { code: 'conversations.view', module: 'Unified Inbox', name: 'View Conversations', description: 'Access unified inbox messages' },
  { code: 'conversations.reply', module: 'Unified Inbox', name: 'Reply to Conversations', description: 'Send messages and quick replies' },
  { code: 'conversations.assign', module: 'Unified Inbox', name: 'Assign Conversations', description: 'Assign threads to team members' },
  // Website Forms
  { code: 'forms.view', module: 'Website Forms', name: 'View Forms', description: 'Access website forms and submissions' },
  { code: 'forms.create', module: 'Website Forms', name: 'Create Forms', description: 'Create new website intake forms' },
  { code: 'forms.edit', module: 'Website Forms', name: 'Edit Forms', description: 'Edit form fields, layout, and configuration' },
  // Ads & Campaigns
  { code: 'ads.view', module: 'Ads & Campaigns', name: 'View Ad Accounts', description: 'Access connected Meta and Google advertising accounts' },
  { code: 'ads.manage_connections', module: 'Ads & Campaigns', name: 'Manage Ad Connections', description: 'Connect and revoke ad credentials' },
  { code: 'ads.sync', module: 'Ads & Campaigns', name: 'Sync Ad Performance', description: 'Trigger manual and automated ad spend sync' },
  // Tasks & Follow-ups
  { code: 'tasks.view', module: 'Tasks & SLA', name: 'View Tasks', description: 'Access task queues and follow-ups' },
  { code: 'tasks.complete', module: 'Tasks & SLA', name: 'Complete Tasks', description: 'Start, complete, and snooze tasks' },
  { code: 'tasks.manage_sla', module: 'Tasks & SLA', name: 'Manage SLA Policies', description: 'Configure workspace SLA response target policies' },
  // Workflows
  { code: 'workflows.view', module: 'Workflows', name: 'View Workflows', description: 'View workflow automations and runs' },
  { code: 'workflows.create', module: 'Workflows', name: 'Create Workflows', description: 'Create and modify automation flows' },
  // Reporting
  { code: 'reports.view', module: 'Reports', name: 'View Reports', description: 'View performance and marketing analytics' },
  { code: 'reports.export', module: 'Reports', name: 'Export Reports', description: 'Export analytics to CSV' },
  // Customer Portal
  { code: 'portal.view', module: 'Customer Portal', name: 'View Customer Portal', description: 'View customer requests and portal users' },
  { code: 'portal.manage', module: 'Customer Portal', name: 'Manage Customer Portal', description: 'Invite customers, revoke access, and update requests' },
];

interface RoleDef {
  id: string;
  name: string;
  slug: string;
  description: string;
  isSystem: boolean;
  userCount: number;
  permissions: string[];
}

const SYSTEM_ROLES: RoleDef[] = [
  {
    id: 'role_sa',
    name: 'Super Administrator',
    slug: 'super_admin',
    description: 'Complete cross-client access to all platform administrative capabilities and tenant provisioning.',
    isSystem: true,
    userCount: 0,
    permissions: ALL_PERMISSIONS.map((p) => p.code),
  },
  {
    id: 'role_ca',
    name: 'Client Administrator (Account Director)',
    slug: 'client_admin',
    description: 'Full workspace authority over assigned client tenants, leads, team members, integrations, and portal.',
    isSystem: true,
    userCount: 0,
    permissions: ALL_PERMISSIONS.filter(
      (p) => !['clients.create', 'clients.archive'].includes(p.code)
    ).map((p) => p.code),
  },
  {
    id: 'role_cs',
    name: 'Client Staff (Specialist / Media Buyer)',
    slug: 'client_staff',
    description: 'Operational privileges for managing leads, replying in inbox, viewing campaigns, and executing tasks.',
    isSystem: true,
    userCount: 0,
    permissions: [
      'leads.view',
      'leads.create',
      'leads.update',
      'conversations.view',
      'conversations.reply',
      'forms.view',
      'ads.view',
      'tasks.view',
      'tasks.complete',
      'workflows.view',
      'reports.view',
      'portal.view',
    ],
  },
];

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<RoleDef[]>(SYSTEM_ROLES);
  const [selectedRoleSlug, setSelectedRoleSlug] = useState<string>('client_admin');
  const [activeModuleTab, setActiveModuleTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Custom Role Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);

  const loadRoles = async () => {
    setIsLoading(true);
    try {
      const liveRoles = await getRolesApi();
      if (liveRoles && liveRoles.length > 0) {
        setRoles(
          liveRoles.map((r) => ({
            id: r.id || r._id,
            name: r.name,
            slug: r.slug,
            description: r.description || '',
            isSystem: r.isSystem,
            userCount: r.userCount || 0,
            permissions: r.permissionCodes || r.permissions || [],
          }))
        );
      }
    } catch (err) {
      console.error('Failed to load roles from API', err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadRoles();
  }, []);

  const selectedRole = roles.find((r) => r.slug === selectedRoleSlug) || roles[0] || {
    id: '',
    name: 'Role',
    slug: '',
    description: '',
    isSystem: false,
    userCount: 0,
    permissions: [],
  };

  const modules = Array.from(new Set(ALL_PERMISSIONS.map((p) => p.module)));

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;

    const slug = newRoleName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    setIsSubmitting(true);
    setError(null);
    try {
      await createRoleApi({
        name: newRoleName.trim(),
        slug,
        description: newRoleDesc.trim() || 'Custom agency role',
        permissionCodes: selectedPerms,
      });

      await loadRoles();
      setSelectedRoleSlug(slug);
      setIsModalOpen(false);
      setNewRoleName('');
      setNewRoleDesc('');
      setSelectedPerms([]);
      setSuccess(`Custom role "${newRoleName.trim()}" created and saved to MongoDB.`);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePermissionForCustomRole = (code: string) => {
    if (selectedPerms.includes(code)) {
      setSelectedPerms(selectedPerms.filter((c) => c !== code));
    } else {
      setSelectedPerms([...selectedPerms, code]);
    }
  };

  const filteredPermissions = ALL_PERMISSIONS.filter((p) => {
    if (activeModuleTab !== 'all' && p.module !== activeModuleTab) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-brand-50 text-brand-700">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Role-Based Access Control (RBAC) & Permissions Matrix
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Define system roles, audit tenant permission boundaries, and enforce least-privilege security across MongoDB collections.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="bg-brand-600 hover:bg-brand-700 text-white flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Create Custom Role
          </Button>
        </div>
      </div>

      {/* Success alert */}
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

      {/* Role Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {roles.map((r) => {
          const isSelected = r.slug === selectedRoleSlug;
          return (
            <div
              key={r.id}
              onClick={() => setSelectedRoleSlug(r.slug)}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-brand-50/40 border-brand-500 shadow-sm ring-1 ring-brand-500'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className={`h-4 w-4 ${isSelected ? 'text-brand-700' : 'text-slate-400'}`} />
                  <span className="font-bold text-slate-900 text-xs">{r.name}</span>
                </div>
                {r.isSystem ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                    <Lock className="h-2.5 w-2.5" /> System Lock
                  </span>
                ) : (
                  <Badge variant="neutral">Custom</Badge>
                )}
              </div>

              <p className="text-[11px] text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                {r.description}
              </p>

              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-mono">{r.slug}</span>
                <span className="font-semibold text-brand-700">{r.permissions.length} capabilities</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Permission Matrix for Selected Role */}
      <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">
                Active Capability Matrix for &quot;{selectedRole.name}&quot;
              </h2>
              <Badge variant="brand">{selectedRole.permissions.length} of {ALL_PERMISSIONS.length} granted</Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Review and audit granular access rights enforced on Express routes and MongoDB middleware.
            </p>
          </div>

          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search capabilities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Module Filters */}
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-1.5 text-xs">
          <button
            onClick={() => setActiveModuleTab('all')}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${
              activeModuleTab === 'all'
                ? 'bg-white text-brand-700 shadow-sm border border-slate-200 font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Modules
          </button>
          {modules.map((m) => (
            <button
              key={m}
              onClick={() => setActiveModuleTab(m)}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                activeModuleTab === m
                  ? 'bg-white text-brand-700 shadow-sm border border-slate-200 font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Capabilities Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
                <th className="py-3 px-4 w-12 text-center">Granted</th>
                <th className="py-3 px-4">Capability Name</th>
                <th className="py-3 px-4">Module</th>
                <th className="py-3 px-4">Security Code</th>
                <th className="py-3 px-4">Description & Scope</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPermissions.map((perm) => {
                const isGranted = selectedRole.permissions.includes(perm.code);

                return (
                  <tr key={perm.code} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 text-center">
                      {isGranted ? (
                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-emerald-100 text-emerald-700">
                          <Check className="h-3 w-3" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-slate-100 text-slate-300">
                          <X className="h-3 w-3" />
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      {perm.name}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[10px] font-medium border border-slate-200">
                        {perm.module}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono text-brand-700 whitespace-nowrap text-[11px]">
                      {perm.code}
                    </td>

                    <td className="py-3 px-4 text-slate-500">
                      {perm.description}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Custom Role Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-brand-50 text-brand-700">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Create Specialized Agency Role</h3>
                  <p className="text-[11px] text-slate-400">Assemble customized capability sets</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRole} className="space-y-4 pt-4 text-xs overflow-y-auto flex-1 pr-1">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Role Title:</label>
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="e.g. Senior Copywriter & Content Strategist"
                  required
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description:</label>
                <textarea
                  rows={2}
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  placeholder="Outline responsibilities and boundary permissions..."
                  className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-semibold text-slate-700">Select Granted Capabilities:</label>
                  <span className="text-brand-600 font-bold">{selectedPerms.length} selected</span>
                </div>
                <div className="border border-slate-200 rounded-lg p-3 max-h-48 overflow-y-auto space-y-1.5 bg-slate-50">
                  {ALL_PERMISSIONS.map((perm) => (
                    <label
                      key={perm.code}
                      className="flex items-center gap-2 p-1.5 rounded hover:bg-white cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPerms.includes(perm.code)}
                        onChange={() => togglePermissionForCustomRole(perm.code)}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="font-medium text-slate-800">{perm.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">({perm.code})</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={!newRoleName.trim()} className="bg-brand-600 hover:bg-brand-700 text-white">
                  Save Role
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
