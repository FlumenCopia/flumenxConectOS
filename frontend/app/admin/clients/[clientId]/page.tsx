'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import {
  Building2,
  ArrowLeft,
  Users,
  CheckCircle2,
  Clock,
  Settings,
  Activity,
  FileText,
  UserPlus,
  Shield,
  Trash2,
  Edit2,
  Mail,
  Phone,
  Globe,
  MapPin,
  Calendar,
  AlertCircle,
  Loader2,
  Plus,
  X,
  Send,
  AlertTriangle,
  RefreshCw,
  Radio,
  Copy,
  Check,
} from 'lucide-react';
import {
  getClientWebhooksApi,
  createClientWebhookApi,
  toggleWebhookStatusApi,
  deleteClientWebhookApi,
  ClientWebhookItem,
} from '@/lib/leads';
import {
  getClientApi,
  updateClientApi,
  updateClientStatusApi,
  updateClientHealthApi,
  updateClientManagersApi,
  archiveClientApi,
  updateOnboardingItemApi,
  getClientUsersApi,
  inviteClientUserApi,
  updateUserRoleApi,
  updateUserStatusApi,
  removeClientUserApi,
  getClientActivityApi,
  ClientItem,
  ClientMemberItem,
  ClientInvitationItem,
  ClientActivityItem,
} from '@/lib/clients';
import { getRolesApi, RoleItem } from '@/lib/api/roles';
import { getAccountManagersApi, AccountManagerItem } from '@/lib/api/staff';
import { getErrorMessage } from '@/lib/api';

export default function ClientProfilePage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;

  const [client, setClient] = useState<ClientItem | null>(null);
  const [members, setMembers] = useState<ClientMemberItem[]>([]);
  const [invitations, setInvitations] = useState<ClientInvitationItem[]>([]);
  const [activities, setActivities] = useState<ClientActivityItem[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'profile' | 'team' | 'onboarding' | 'activity' | 'settings' | 'webhooks'>('overview');
  const [webhooks, setWebhooks] = useState<ClientWebhookItem[]>([]);
  const [webhooksLoading, setWebhooksLoading] = useState(false);
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const [newWebhookName, setNewWebhookName] = useState('');
  const [newWebhookSource, setNewWebhookSource] = useState('custom_webhook');
  const [createdRawSecret, setCreatedRawSecret] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Business Profile Form State
  const [profileForm, setProfileForm] = useState({
    name: '',
    legalName: '',
    email: '',
    phone: '',
    website: '',
    industry: '',
    address: '',
    city: '',
    state: '',
    country: '',
    timezone: '',
    currency: '',
  });

  // Settings Form State
  const [settingsForm, setSettingsForm] = useState({
    brandColor: '#1e40af',
    leadResponseThresholdMinutes: 30,
    notificationEmails: '',
    notes: '',
  });

  // Invite Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('client_staff');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Dynamic RBAC Roles & Account Managers
  const [availableRoles, setAvailableRoles] = useState<RoleItem[]>([]);
  const [accountManagers, setAccountManagers] = useState<AccountManagerItem[]>([]);
  const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);
  const [selectedPrimaryManager, setSelectedPrimaryManager] = useState('');
  const [selectedBackupManager, setSelectedBackupManager] = useState('');
  const [managerLoading, setManagerLoading] = useState(false);

  // Load all Client Data
  const loadClientData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [clientData, teamData, activityData, rolesData, managersData] = await Promise.all([
        getClientApi(clientId),
        getClientUsersApi(clientId),
        getClientActivityApi(clientId, 1, 25),
        getRolesApi().catch(() => [] as RoleItem[]),
        getAccountManagersApi().catch(() => [] as AccountManagerItem[]),
      ]);

      setClient(clientData);
      setMembers(teamData.members);
      setInvitations(teamData.invitations);
      setActivities(activityData.activities);
      setAvailableRoles(rolesData);
      setAccountManagers(managersData);

      // Populate form fields
      setProfileForm({
        name: clientData.name || '',
        legalName: clientData.legalName || '',
        email: clientData.email || '',
        phone: clientData.phone || '',
        website: clientData.website || '',
        industry: clientData.industry || '',
        address: clientData.address || '',
        city: clientData.city || '',
        state: clientData.state || '',
        country: clientData.country || '',
        timezone: clientData.timezone || 'America/New_York',
        currency: clientData.currency || 'USD',
      });

      setSettingsForm({
        brandColor: clientData.brandColor || '#1e40af',
        leadResponseThresholdMinutes: clientData.settings?.leadResponseThresholdMinutes || 30,
        notificationEmails: clientData.settings?.notificationEmails?.join(', ') || '',
        notes: clientData.notes || '',
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadClientData();
  }, [loadClientData]);

  // Handle Business Profile Update
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const updated = await updateClientApi(clientId, profileForm);
      setClient(updated);
      setSuccessMessage('Business profile details saved successfully.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Settings Update
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const emails = settingsForm.notificationEmails
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);

      const updated = await updateClientApi(clientId, {
        brandColor: settingsForm.brandColor,
        notes: settingsForm.notes,
        settings: {
          leadResponseThresholdMinutes: Number(settingsForm.leadResponseThresholdMinutes),
          notificationEmails: emails,
          brandPrimaryColor: settingsForm.brandColor,
        },
      });

      setClient(updated);
      setSuccessMessage('Workspace settings and branding updated.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Quick Status Change
  const handleStatusChange = async (newStatus: string) => {
    try {
      const updated = await updateClientStatusApi(clientId, newStatus);
      setClient(updated);
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  // Handle Quick Health Change
  const handleHealthChange = async (newHealth: string) => {
    try {
      const updated = await updateClientHealthApi(clientId, newHealth);
      setClient(updated);
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  // Handle Onboarding Item Status Update
  const handleOnboardingItemUpdate = async (itemId: string, newStatus: string) => {
    try {
      const res = await updateOnboardingItemApi(clientId, itemId, { status: newStatus });
      if (client) {
        setClient({
          ...client,
          onboardingStatus: res.onboardingStatus as any,
          onboardingProgress: res.onboardingProgress,
          onboardingChecklist: res.checklist,
        });
      }
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  // Handle Account Managers Update
  const handleSaveManagers = async (e: React.FormEvent) => {
    e.preventDefault();
    setManagerLoading(true);
    try {
      const updated = await updateClientManagersApi(clientId, {
        primaryAccountManagerId: selectedPrimaryManager || null,
        backupAccountManagerId: selectedBackupManager || null,
      });
      setClient(updated);
      setIsManagerModalOpen(false);
      setSuccessMessage('Account managers updated successfully.');
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setManagerLoading(false);
    }
  };

  // Handle Team Member Invitation
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviteLoading(true);
    setInviteError(null);
    try {
      await inviteClientUserApi(clientId, {
        email: inviteEmail.trim(),
        roleId: inviteRole,
      });

      setIsInviteModalOpen(false);
      const invitedEmailCopy = inviteEmail.trim();
      const roleName = inviteRole === 'client_admin' ? 'Client Admin' : 'Client Staff';
      setInviteEmail('');
      setInviteRole('client_staff');
      loadClientData();
      setSuccessMessage(`Invitation dispatched successfully to ${invitedEmailCopy} as ${roleName}.`);
    } catch (err) {
      setInviteError(getErrorMessage(err));
    } finally {
      setInviteLoading(false);
    }
  };

  // Handle User Status Toggle
  const handleToggleUserStatus = async (userId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      await updateUserStatusApi(clientId, userId, nextStatus);
      loadClientData();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  // Handle Remove Member
  const handleRemoveUser = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to remove ${email} from this client workspace?`)) return;
    try {
      await removeClientUserApi(clientId, userId);
      loadClientData();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  if (isLoading) {
    return (
      <div className="py-32 flex flex-col items-center justify-center text-slate-400 gap-2">
        <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
        <span className="text-xs">Loading client workspace...</span>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="py-20 text-center space-y-4">
        <AlertCircle className="h-10 w-10 mx-auto text-red-500" />
        <h2 className="text-sm font-bold text-slate-800">Client Workspace Not Found</h2>
        <Link href="/admin/clients">
          <Button variant="outline" size="sm">
            Back to Client Directory
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Link & Header */}
      <div>
        <Link
          href="/admin/clients"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 transition-colors mb-3 font-medium"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Client Directory</span>
        </Link>

        {/* Client Top Banner */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div
              className="h-14 w-14 rounded-lg font-bold text-white flex items-center justify-center text-lg shadow-sm shrink-0"
              style={{ backgroundColor: client.brandColor || '#1e40af' }}
            >
              {client.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-bold text-slate-900">{client.name}</h1>
                <Badge variant={client.status === 'active' ? 'success' : client.status === 'onboarding' ? 'info' : 'warning'}>
                  {client.status.toUpperCase()}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">/{client.slug}</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                {client.industry && <span>{client.industry}</span>}
                {client.city && <span>• {client.city}, {client.country}</span>}
                <span>• SLA: {client.settings?.leadResponseThresholdMinutes || 30}m</span>
              </div>
            </div>
          </div>

          {/* Quick Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Status Selector */}
            <select
              value={client.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="text-xs py-1.5 px-2 border border-slate-300 rounded bg-white text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-brand-600"
            >
              <option value="active">Status: Active</option>
              <option value="onboarding">Status: Onboarding</option>
              <option value="paused">Status: Paused</option>
              <option value="inactive">Status: Inactive</option>
              <option value="archived">Status: Archived</option>
            </select>

            {/* Quick Health Selector */}
            <select
              value={client.health}
              onChange={(e) => handleHealthChange(e.target.value)}
              className="text-xs py-1.5 px-2 border border-slate-300 rounded bg-white text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-brand-600"
            >
              <option value="healthy">Health: Healthy</option>
              <option value="needs_attention">Health: Attention</option>
              <option value="at_risk">Health: At Risk</option>
              <option value="inactive">Health: Inactive</option>
            </select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsInviteModalOpen(true)}
              className="gap-1 text-xs"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Invite User
            </Button>
          </div>
        </div>
      </div>

      {/* Status Alerts */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMessage && (
        <div className="p-3 bg-green-50 border border-green-200 rounded text-xs text-green-700 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200 flex gap-6 text-xs font-medium text-slate-500 overflow-x-auto">
        {[
          { id: 'overview', label: 'Overview', icon: Building2 },
          { id: 'profile', label: 'Business Profile', icon: FileText },
          { id: 'team', label: `Team Members (${members.length})`, icon: Users },
          { id: 'onboarding', label: `Onboarding (${client.onboardingProgress}%)`, icon: CheckCircle2 },
          { id: 'activity', label: 'Activity Trail', icon: Activity },
          { id: 'webhooks', label: 'Lead Webhooks', icon: Radio },
          { id: 'settings', label: 'Workspace Settings', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={async () => {
                setActiveTab(tab.id as any);
                setSuccessMessage(null);
                if (tab.id === 'webhooks') {
                  setWebhooksLoading(true);
                  try {
                    const whData = await getClientWebhooksApi(clientId);
                    setWebhooks(whData);
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setWebhooksLoading(false);
                  }
                }
              }}
              className={`pb-3 flex items-center gap-2 transition-colors whitespace-nowrap ${
                isActive
                  ? 'border-b-2 border-brand-700 font-bold text-brand-800'
                  : 'hover:text-slate-900 border-b-2 border-transparent'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Key Metrics */}
          <div className="md:col-span-2 space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <Card className="border-slate-200 p-4">
                <p className="text-[11px] font-semibold text-slate-400 uppercase">Onboarding</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{client.onboardingProgress}%</p>
                <span className="text-[10px] text-slate-500 capitalize">{client.onboardingStatus}</span>
              </Card>
              <Card className="border-slate-200 p-4">
                <p className="text-[11px] font-semibold text-slate-400 uppercase">Active Members</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{members.length}</p>
                <span className="text-[10px] text-slate-500">{invitations.length} pending invite{invitations.length === 1 ? '' : 's'}</span>
              </Card>
              <Card className="border-slate-200 p-4">
                <p className="text-[11px] font-semibold text-slate-400 uppercase">Response SLA</p>
                <p className="text-xl font-bold text-slate-900 mt-1">
                  {client.settings?.leadResponseThresholdMinutes || 30}m
                </p>
                <span className="text-[10px] text-slate-500">Lead target</span>
              </Card>
            </div>

            {/* Account Managers Card */}
            <Card className="border-slate-200">
              <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold text-slate-900">FlumenX Account Managers</CardTitle>
                <button
                  onClick={() => {
                    const primaryId =
                      typeof client.primaryAccountManagerId === 'object' && client.primaryAccountManagerId
                        ? client.primaryAccountManagerId._id
                        : typeof client.primaryAccountManagerId === 'string'
                        ? client.primaryAccountManagerId
                        : '';
                    const backupId =
                      typeof client.backupAccountManagerId === 'object' && client.backupAccountManagerId
                        ? client.backupAccountManagerId._id
                        : typeof client.backupAccountManagerId === 'string'
                        ? client.backupAccountManagerId
                        : '';
                    setSelectedPrimaryManager(primaryId);
                    setSelectedBackupManager(backupId);
                    setIsManagerModalOpen(true);
                  }}
                  className="text-[11px] text-brand-700 font-semibold hover:underline"
                >
                  Assign / Edit
                </button>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Primary Manager:</span>
                  {client.primaryAccountManagerId ? (
                    <span className="text-xs font-semibold text-slate-900">
                      {typeof client.primaryAccountManagerId === 'object' && client.primaryAccountManagerId
                        ? client.primaryAccountManagerId.name || 'Account Manager'
                        : String(client.primaryAccountManagerId || '')}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 italic">None assigned</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Backup Manager:</span>
                  {client.backupAccountManagerId ? (
                    <span className="text-xs font-semibold text-slate-900">
                      {typeof client.backupAccountManagerId === 'object' && client.backupAccountManagerId
                        ? client.backupAccountManagerId.name || 'Account Manager'
                        : String(client.backupAccountManagerId || '')}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 italic">None assigned</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity Snapshot */}
            <Card className="border-slate-200">
              <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold text-slate-900">Recent Operational Activity</CardTitle>
                <button
                  onClick={() => setActiveTab('activity')}
                  className="text-[11px] text-brand-700 font-semibold hover:underline"
                >
                  View All
                </button>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {activities.slice(0, 4).map((act) => (
                  <div key={act._id} className="flex items-start gap-3 text-xs">
                    <div className="h-2 w-2 rounded-full bg-brand-600 mt-1.5 shrink-0"></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{act.title}</p>
                      <p className="text-[10px] text-slate-400">{new Date(act.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Quick Details Sidebar */}
          <div className="space-y-6">
            <Card className="border-slate-200 p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-2">Workspace Specs</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Currency:</span>
                  <span className="font-medium text-slate-800">{client.currency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Timezone:</span>
                  <span className="font-medium text-slate-800">{client.timezone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Created:</span>
                  <span className="font-medium text-slate-800">{new Date(client.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: BUSINESS PROFILE */}
      {activeTab === 'profile' && (
        <Card className="border-slate-200">
          <CardHeader className="p-4 border-b border-slate-100">
            <CardTitle className="text-xs font-bold text-slate-900">Client Business Profile</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSaveProfile} className="space-y-4 max-w-2xl">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Display Workspace Name</label>
                  <input
                    type="text"
                    required
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-brand-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Legal Business Name</label>
                  <input
                    type="text"
                    value={profileForm.legalName}
                    onChange={(e) => setProfileForm({ ...profileForm, legalName: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-brand-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Primary Contact Email</label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-brand-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Phone</label>
                  <input
                    type="text"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-brand-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Website</label>
                  <input
                    type="text"
                    value={profileForm.website}
                    onChange={(e) => setProfileForm({ ...profileForm, website: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-brand-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Industry</label>
                  <input
                    type="text"
                    value={profileForm.industry}
                    onChange={(e) => setProfileForm({ ...profileForm, industry: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-brand-600"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Street Address</label>
                <input
                  type="text"
                  value={profileForm.address}
                  onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-brand-600"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">City</label>
                  <input
                    type="text"
                    value={profileForm.city}
                    onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-brand-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">State / Region</label>
                  <input
                    type="text"
                    value={profileForm.state}
                    onChange={(e) => setProfileForm({ ...profileForm, state: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-brand-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Country</label>
                  <input
                    type="text"
                    value={profileForm.country}
                    onChange={(e) => setProfileForm({ ...profileForm, country: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-brand-600"
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button type="submit" size="sm" disabled={actionLoading} className="gap-1.5">
                  {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Business Profile
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* TAB 3: TEAM MEMBERS */}
      {activeTab === 'team' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Workspace Team Members ({members.length})
            </h2>
            <Button size="sm" onClick={() => setIsInviteModalOpen(true)} className="gap-1.5 text-xs">
              <UserPlus className="h-3.5 w-3.5" />
              Invite Team Member
            </Button>
          </div>

          <Card className="border-slate-200 overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Joined Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {members.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                          {member.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{member.name}</p>
                          <p className="text-[11px] text-slate-400">{member.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={member.roleSlug === 'client_admin' ? 'brand' : 'neutral'}>
                        {member.roleName}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={member.membershipStatus === 'active' ? 'success' : 'danger'}>
                        {member.membershipStatus.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(member.joinedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => handleToggleUserStatus(member.userId, member.membershipStatus)}
                      >
                        {member.membershipStatus === 'active' ? 'Suspend' : 'Activate'}
                      </Button>
                      <button
                        type="button"
                        onClick={() => handleRemoveUser(member.userId, member.email)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                        title="Remove member"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Pending Invitations Section */}
          {invitations.length > 0 && (
            <div className="space-y-3 pt-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Pending Invitations ({invitations.length})
              </h3>
              <Card className="border-slate-200 overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                      <th className="py-2.5 px-4">Invited Email</th>
                      <th className="py-2.5 px-4">Role</th>
                      <th className="py-2.5 px-4">Invited By</th>
                      <th className="py-2.5 px-4">Expires</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {invitations.map((inv) => (
                      <tr key={inv.id}>
                        <td className="py-2.5 px-4 font-medium text-slate-800">{inv.email}</td>
                        <td className="py-2.5 px-4">{inv.roleName}</td>
                        <td className="py-2.5 px-4 text-slate-500">{inv.invitedBy}</td>
                        <td className="py-2.5 px-4 text-slate-400">
                          {new Date(inv.expiresAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ONBOARDING CHECKLIST */}
      {activeTab === 'onboarding' && (
        <div className="space-y-6">
          <Card className="border-slate-200 p-6 bg-slate-50/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Agency Onboarding Status</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  14-point marketing kickoff workflow verifying integrations, tracking, and launch approval.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-2xl font-bold text-slate-900">{client.onboardingProgress}%</span>
                <Badge variant={client.onboardingProgress === 100 ? 'success' : 'brand'}>
                  {client.onboardingStatus.toUpperCase()}
                </Badge>
              </div>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 mt-4 overflow-hidden">
              <div
                className="bg-brand-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${client.onboardingProgress}%` }}
              ></div>
            </div>
          </Card>

          <Card className="border-slate-200 divide-y divide-slate-100">
            {client.onboardingChecklist.map((item, idx) => (
              <div key={item._id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="h-6 w-6 rounded-full bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{item.title}</h4>
                    {item.description && <p className="text-[11px] text-slate-500 mt-0.5">{item.description}</p>}
                    {item.notes && (
                      <p className="text-[11px] text-slate-600 italic bg-slate-50 p-1.5 rounded mt-1.5 border border-slate-200">
                        {item.notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <select
                    value={item.status}
                    onChange={(e) => handleOnboardingItemUpdate(item._id, e.target.value)}
                    className="text-xs py-1 px-2 border border-slate-300 rounded bg-white text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-brand-600"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="blocked">Blocked</option>
                    <option value="not_applicable">N/A</option>
                  </select>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* TAB 5: ACTIVITY TRAIL */}
      {activeTab === 'activity' && (
        <Card className="border-slate-200 divide-y divide-slate-100">
          <CardHeader className="p-4 border-b border-slate-100">
            <CardTitle className="text-xs font-bold text-slate-900">Audit & Activity Trail</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {activities.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">No recorded activity yet.</p>
            ) : (
              activities.map((act) => (
                <div key={act._id} className="flex items-start gap-3 text-xs">
                  <div className="h-2 w-2 rounded-full bg-brand-600 mt-1.5 shrink-0"></div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-slate-900">{act.title}</p>
                      <span className="text-[10px] text-slate-400">
                        {new Date(act.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {act.userName && <p className="text-[11px] text-slate-500">By {act.userName}</p>}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 6: SETTINGS */}
      {activeTab === 'settings' && (
        <Card className="border-slate-200">
          <CardHeader className="p-4 border-b border-slate-100">
            <CardTitle className="text-xs font-bold text-slate-900">Workspace Settings & Branding</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSaveSettings} className="space-y-4 max-w-xl">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Brand Primary Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settingsForm.brandColor}
                    onChange={(e) => setSettingsForm({ ...settingsForm, brandColor: e.target.value })}
                    className="h-8 w-12 border border-slate-300 rounded cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={settingsForm.brandColor}
                    onChange={(e) => setSettingsForm({ ...settingsForm, brandColor: e.target.value })}
                    className="w-28 text-xs px-2 py-1.5 border border-slate-300 rounded-md text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Lead SLA Response Threshold (Minutes)
                </label>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={settingsForm.leadResponseThresholdMinutes}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, leadResponseThresholdMinutes: parseInt(e.target.value, 10) })
                  }
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-brand-600"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Alert Notification Emails (Comma-separated)
                </label>
                <input
                  type="text"
                  value={settingsForm.notificationEmails}
                  onChange={(e) => setSettingsForm({ ...settingsForm, notificationEmails: e.target.value })}
                  placeholder="alerts@client.com, manager@agency.com"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-brand-600"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Internal Agency Notes</label>
                <textarea
                  rows={3}
                  value={settingsForm.notes}
                  onChange={(e) => setSettingsForm({ ...settingsForm, notes: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-brand-600"
                />
              </div>

              <div className="pt-2">
                <Button type="submit" size="sm" disabled={actionLoading} className="gap-1.5">
                  {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Workspace Settings
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Lead Webhooks Tab */}
      {activeTab === 'webhooks' && (
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 py-4 px-6">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Radio className="h-4 w-4 text-brand-700" />
                Client Intake Webhooks
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Generate secure intake endpoints for website forms, Meta Lead Ads, and advertising automations.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setCreatedRawSecret(null);
                setNewWebhookName('');
                setNewWebhookSource('custom_webhook');
                setIsWebhookModalOpen(true);
              }}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              New Intake Webhook
            </Button>
          </CardHeader>
          <CardContent className="p-6">
            {webhooksLoading ? (
              <div className="p-8 text-center text-xs text-slate-500">Loading webhooks...</div>
            ) : webhooks.length === 0 ? (
              <div className="p-8 text-center">
                <Radio className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-slate-900">No Webhooks Configured</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Create a webhook to allow landing page forms or advertising platforms to stream leads directly into this client&apos;s pipeline.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-medium tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Webhook Name</th>
                      <th className="py-2.5 px-3">Acquisition Source</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Total Requests</th>
                      <th className="py-2.5 px-3">Success / Fail</th>
                      <th className="py-2.5 px-3">Last Active</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {webhooks.map((wh) => (
                      <tr key={wh._id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-3 font-semibold text-slate-900">{wh.name}</td>
                        <td className="py-3 px-3">
                          <Badge variant="neutral" className="capitalize text-[11px]">
                            {wh.source.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="py-3 px-3">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await toggleWebhookStatusApi(clientId, wh._id, !wh.isActive);
                                const updated = await getClientWebhooksApi(clientId);
                                setWebhooks(updated);
                              } catch (err: any) {
                                alert(err?.response?.data?.message || 'Failed to toggle status');
                              }
                            }}
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              wh.isActive
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {wh.isActive ? 'Active' : 'Paused'}
                          </button>
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-800">{wh.totalRequests}</td>
                        <td className="py-3 px-3">
                          <span className="text-emerald-700 font-medium">{wh.successfulRequests}</span> /{' '}
                          <span className="text-rose-600 font-medium">{wh.failedRequests}</span>
                        </td>
                        <td className="py-3 px-3 text-slate-500">
                          {wh.lastTriggeredAt ? new Date(wh.lastTriggeredAt).toLocaleString() : 'Never'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm(`Delete webhook "${wh.name}"?`)) return;
                              try {
                                await deleteClientWebhookApi(clientId, wh._id);
                                const updated = await getClientWebhooksApi(clientId);
                                setWebhooks(updated);
                              } catch (err: any) {
                                alert(err?.response?.data?.message || 'Failed to delete webhook');
                              }
                            }}
                            className="text-slate-400 hover:text-rose-600 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Webhook Modal */}
      {isWebhookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Radio className="h-4 w-4 text-brand-700" />
                {createdRawSecret ? 'Webhook Secret Key' : 'Create Inbound Webhook'}
              </h3>
              <button
                type="button"
                onClick={() => setIsWebhookModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createdRawSecret ? (
              <div className="space-y-3">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Important:</strong> Copy this secret now. It is hashed with SHA-256 before storage and will <em>never</em> be displayed again.
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Webhook Endpoint URL</label>
                  <div className="bg-slate-100 p-2 rounded text-xs font-mono text-slate-800 break-all select-all">
                    {typeof window !== 'undefined' ? `${window.location.origin.replace('3000', '5000')}/api/v1/client/webhooks/leads` : '/api/v1/client/webhooks/leads'}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Secret Token (X-Webhook-Secret header)</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-900 text-emerald-400 font-mono text-xs p-2 rounded break-all select-all">
                      {createdRawSecret}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(createdRawSecret);
                        setCopiedSecret(true);
                        setTimeout(() => setCopiedSecret(false), 2000);
                      }}
                      className="shrink-0"
                    >
                      {copiedSecret ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end pt-3 border-t border-slate-100">
                  <Button size="sm" onClick={() => setIsWebhookModalOpen(false)}>
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newWebhookName.trim()) {
                    alert('Webhook name is required');
                    return;
                  }
                  try {
                    const res = await createClientWebhookApi(clientId, {
                      name: newWebhookName.trim(),
                      source: newWebhookSource,
                    });
                    setCreatedRawSecret(res.rawSecret || 'Generated');
                    const updated = await getClientWebhooksApi(clientId);
                    setWebhooks(updated);
                  } catch (err: any) {
                    alert(err?.response?.data?.message || 'Failed to create webhook');
                  }
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Webhook Name *</label>
                  <input
                    type="text"
                    required
                    value={newWebhookName}
                    onChange={(e) => setNewWebhookName(e.target.value)}
                    placeholder="e.g. Website Contact Form, Google Ads Webhook..."
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-brand-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Acquisition Source</label>
                  <select
                    value={newWebhookSource}
                    onChange={(e) => setNewWebhookSource(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-800"
                  >
                    <option value="custom_webhook">Custom Webhook API</option>
                    <option value="meta_ads">Meta Lead Ads</option>
                    <option value="google_ads">Google Ads</option>
                    <option value="elementor_form">Elementor / WordPress Form</option>
                    <option value="other">Other Inbound Source</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <Button variant="outline" size="sm" type="button" onClick={() => setIsWebhookModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" type="submit" className="bg-brand-800 text-white">
                    Generate Endpoint & Secret
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-brand-700" />
                Invite Workspace User
              </h3>
              <button type="button" onClick={() => { setIsInviteModalOpen(false); setInviteError(null); }} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {inviteError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                <span>{inviteError}</span>
              </div>
            )}

            <form onSubmit={handleInviteSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Invited Work Email *</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="executive@client.com"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-brand-600"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Workspace Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-800"
                >
                  {availableRoles.filter((r) => r.slug !== 'super_admin').length > 0 ? (
                    availableRoles
                      .filter((r) => r.slug !== 'super_admin')
                      .map((r) => (
                        <option key={r.slug || r.id} value={r.slug || r.id}>
                          {r.name}
                        </option>
                      ))
                  ) : (
                    <>
                      <option value="client_staff">Client Staff (Leads & CRM)</option>
                      <option value="client_admin">Client Admin (Full Workspace Access)</option>
                    </>
                  )}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsInviteModalOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" disabled={inviteLoading} className="gap-1">
                  {inviteLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                  Dispatch Invite
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Account Managers Assignment Modal */}
      {isManagerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-brand-700" />
                Assign FlumenX Account Managers
              </h3>
              <button type="button" onClick={() => setIsManagerModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveManagers} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Primary Account Manager</label>
                <select
                  value={selectedPrimaryManager}
                  onChange={(e) => setSelectedPrimaryManager(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-800"
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
                <label className="block text-xs font-semibold text-slate-700">Backup Account Manager</label>
                <select
                  value={selectedBackupManager}
                  onChange={(e) => setSelectedBackupManager(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-800"
                >
                  <option value="">-- None Assigned --</option>
                  {accountManagers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsManagerModalOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" disabled={managerLoading} className="gap-1">
                  {managerLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                  Save Managers
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
