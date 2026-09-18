'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  Filter,
  Plus,
  Download,
  Kanban,
  Calendar,
  AlertCircle,
  Clock,
  ArrowUpDown,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Flame,
  CheckCircle2,
  Trash2,
  X,
  Building,
  Mail,
  Phone,
  UserCheck,
  MessageSquare,
  Send,
  Smartphone,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import {
  getLeadsApi,
  createLeadApi,
  updateLeadStageApi,
  deleteLeadApi,
  exportLeadsCsvApi,
  LeadItem,
  LeadStage,
  LeadSource,
  ScoreTier
} from '@/lib/leads';
import { getWorkspaceTeamApi, ClientMemberItem } from '@/lib/clients';
import { createConversationApi, ConversationChannel } from '@/lib/conversations';

const STAGE_OPTIONS: { label: string; value: LeadStage }[] = [
  { label: 'New', value: 'new' },
  { label: 'Contacted', value: 'contacted' },
  { label: 'Qualified', value: 'qualified' },
  { label: 'Proposal', value: 'proposal' },
  { label: 'Won', value: 'won' },
  { label: 'Lost', value: 'lost' },
  { label: 'Unqualified', value: 'unqualified' },
];

const SOURCE_OPTIONS: { label: string; value: LeadSource }[] = [
  { label: 'Meta Ads', value: 'meta_ads' },
  { label: 'Google Ads', value: 'google_ads' },
  { label: 'Elementor Form', value: 'elementor_form' },
  { label: 'Custom Webhook', value: 'custom_webhook' },
  { label: 'Manual Intake', value: 'manual' },
  { label: 'Client Referral', value: 'referral' },
  { label: 'Other', value: 'other' },
];

const getStageBadgeVariant = (stage: LeadStage) => {
  switch (stage) {
    case 'new': return 'info';
    case 'contacted': return 'brand';
    case 'qualified': return 'warning';
    case 'proposal': return 'warning';
    case 'won': return 'success';
    case 'lost': return 'danger';
    case 'unqualified': return 'neutral';
    default: return 'neutral';
  }
};

const getScoreTierBadge = (tier: ScoreTier, score: number) => {
  switch (tier) {
    case 'hot':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <Flame className="w-3 h-3 text-rose-500 fill-rose-500" />
          Hot ({score})
        </span>
      );
    case 'warm':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
          Warm ({score})
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">
          Cold ({score})
        </span>
      );
  }
};

const formatSourceLabel = (src: LeadSource) => {
  switch (src) {
    case 'meta_ads': return 'Meta Ads';
    case 'google_ads': return 'Google Ads';
    case 'elementor_form': return 'Website Form';
    case 'custom_webhook': return 'Webhook API';
    case 'manual': return 'Manual CRM';
    case 'referral': return 'Referral';
    default: return 'Other';
  }
};

export default function ClientLeadsPage() {
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [teamMembers, setTeamMembers] = useState<ClientMemberItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search states
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<LeadStage | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<LeadSource | 'all'>('all');
  const [scoreTierFilter, setScoreTierFilter] = useState<ScoreTier | 'all'>('all');
  const [followUpFilter, setFollowUpFilter] = useState<'all' | 'overdue' | 'upcoming'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newLead, setNewLead] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    title: '',
    source: 'manual' as LeadSource,
    notes: '',
    assignedTo: '',
    followUpDate: '',
  });

  // Lost reason modal state
  const [lostTargetLeadId, setLostTargetLeadId] = useState<string | null>(null);
  const [lostReasonInput, setLostReasonInput] = useState('');
  const [isUpdatingStage, setIsUpdatingStage] = useState(false);

  // Message modal state
  const [messageTargetLead, setMessageTargetLead] = useState<LeadItem | null>(null);
  const [messageChannel, setMessageChannel] = useState<ConversationChannel>('whatsapp');
  const [messageBody, setMessageBody] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messageSuccess, setMessageSuccess] = useState<string | null>(null);

  const handleSendMessageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageTargetLead || !messageBody.trim()) return;
    setIsSendingMessage(true);
    try {
      const fullName = `${messageTargetLead.firstName} ${messageTargetLead.lastName || ''}`.trim();
      await createConversationApi({
        contactName: fullName,
        contactEmail: messageTargetLead.email,
        contactPhone: messageTargetLead.phone,
        leadId: messageTargetLead._id,
        channel: messageChannel,
        subject: `Lead Outreach (${messageChannel.toUpperCase()})`,
        initialMessage: messageBody.trim(),
        priority: messageTargetLead.scoreTier === 'hot' ? 'urgent' : 'medium',
      });
      setMessageSuccess(`Message sent via ${messageChannel.toUpperCase()} to ${fullName}!`);
      setMessageBody('');
      setTimeout(() => {
        setMessageTargetLead(null);
        setMessageSuccess(null);
      }, 2000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to dispatch message');
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Fetch leads
  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getLeadsApi({
        page,
        limit: 15,
        search: search.trim() || undefined,
        stage: stageFilter,
        source: sourceFilter,
        scoreTier: scoreTierFilter,
        followUpFilter: followUpFilter !== 'all' ? followUpFilter : undefined,
      });
      setLeads(data.leads || []);
      setTotalPages(data.pagination.totalPages || 1);
      setTotalCount(data.pagination.total || 0);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load client leads');
    } finally {
      setIsLoading(false);
    }
  }, [page, search, stageFilter, sourceFilter, scoreTierFilter, followUpFilter]);

  // Fetch team members for assignments
  useEffect(() => {
    const fetchTeam = async () => {
      try {
        const teamData = await getWorkspaceTeamApi();
        setTeamMembers(teamData?.members || []);
      } catch (err) {
        // non-critical if team members cannot be fetched
      }
    };
    fetchTeam();
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Handle stage transition
  const handleStageChange = async (leadId: string, newStage: LeadStage) => {
    if (newStage === 'lost') {
      setLostTargetLeadId(leadId);
      setLostReasonInput('');
      return;
    }

    try {
      await updateLeadStageApi(leadId, newStage);
      fetchLeads();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to update lead stage');
    }
  };

  const confirmLostStage = async () => {
    if (!lostTargetLeadId) return;
    if (!lostReasonInput.trim()) {
      alert('Please specify why this lead was lost before submitting.');
      return;
    }

    setIsUpdatingStage(true);
    try {
      await updateLeadStageApi(lostTargetLeadId, 'lost', lostReasonInput.trim());
      setLostTargetLeadId(null);
      setLostReasonInput('');
      fetchLeads();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to transition lead to Lost stage');
    } finally {
      setIsUpdatingStage(false);
    }
  };

  // Handle Archive / Delete
  const handleArchive = async (leadId: string, name: string) => {
    if (!confirm(`Are you sure you want to archive lead "${name}"?`)) return;
    try {
      await deleteLeadApi(leadId);
      fetchLeads();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to archive lead');
    }
  };

  // Handle CSV Export
  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportLeadsCsvApi({
        stage: stageFilter !== 'all' ? stageFilter : undefined,
        source: sourceFilter !== 'all' ? sourceFilter : undefined,
      });
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to generate CSV export');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Create Lead
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLead.firstName.trim()) {
      alert('Lead First Name is required.');
      return;
    }
    if (!newLead.email?.trim() && !newLead.phone?.trim()) {
      alert('Please provide either an email or a phone number for the contact.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createLeadApi({
        firstName: newLead.firstName.trim(),
        lastName: newLead.lastName.trim() || undefined,
        email: newLead.email.trim() || undefined,
        phone: newLead.phone.trim() || undefined,
        company: newLead.company.trim() || undefined,
        title: newLead.title.trim() || undefined,
        source: newLead.source,
        notes: newLead.notes.trim() || undefined,
        assignedTo: newLead.assignedTo || undefined,
        followUpDate: newLead.followUpDate ? new Date(newLead.followUpDate).toISOString() : undefined,
      });
      setIsCreateOpen(false);
      setNewLead({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        company: '',
        title: '',
        source: 'manual',
        notes: '',
        assignedTo: '',
        followUpDate: '',
      });
      fetchLeads();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to create lead');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick calculations for metric counters
  const hotCount = leads.filter((l) => l.scoreTier === 'hot').length;
  const overdueCount = leads.filter((l) => l.followUpDate && new Date(l.followUpDate) < new Date()).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sage-200/90">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-sage-900">Leads CRM</h1>
          <p className="text-xs text-sage-500 mt-1 font-normal">
            Capture, track, score, and progress incoming client prospects through pipeline stages.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View Switcher */}
          <div className="inline-flex rounded-lg border border-sage-200 bg-white p-1 shadow-soft-xs">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-brand-800 text-white shadow-soft-xs"
            >
              <Users className="w-3.5 h-3.5" />
              Directory
            </button>
            <Link
              href="/client/leads/pipeline"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-sage-600 hover:text-sage-900 hover:bg-sage-50 transition-colors"
            >
              <Kanban className="w-3.5 h-3.5" />
              Pipeline Board
            </Link>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleExport}
            isLoading={isExporting}
            className="text-sage-700 bg-white border-sage-300"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Export CSV
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="shadow-forest-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Lead
          </Button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total Prospects"
          value={totalCount}
          change="In active pipeline"
          isPositive={true}
          icon={Users}
          iconBgColor="bg-emerald-50"
          iconColor="text-emerald-700"
        />
        <StatCard
          label="Hot Opportunities"
          value={hotCount}
          change="High buying intent"
          isPositive={true}
          icon={Flame}
          iconBgColor="bg-rose-50"
          iconColor="text-rose-600"
        />
        <StatCard
          label="Follow-Ups Due"
          value={overdueCount}
          change={overdueCount > 0 ? "Action required" : "Zero overdue"}
          isPositive={overdueCount === 0}
          icon={Clock}
          iconBgColor="bg-amber-50"
          iconColor="text-amber-700"
        />
        <StatCard
          label="Pipeline Funnel"
          value="7 Stages"
          change="From new to won"
          isPositive={true}
          icon={CheckCircle2}
          iconBgColor="bg-teal-50"
          iconColor="text-teal-700"
        />
      </div>

      {/* Filter and Search Bar */}
      <Card className="bg-white border-slate-200 shadow-xs">
        <div className="p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search leads by name, email, company..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs bg-sage-50/60 border border-sage-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 text-sage-900 transition-colors shadow-soft-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Stage filter */}
            <select
              value={stageFilter}
              onChange={(e) => {
                setStageFilter(e.target.value as any);
                setPage(1);
              }}
              className="text-xs bg-sage-50/60 border border-sage-200 rounded-lg px-2.5 py-2 text-sage-700 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 cursor-pointer shadow-soft-xs"
            >
              <option value="all">All Stages</option>
              {STAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Source filter */}
            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value as any);
                setPage(1);
              }}
              className="text-xs bg-sage-50/60 border border-sage-200 rounded-lg px-2.5 py-2 text-sage-700 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 cursor-pointer shadow-soft-xs"
            >
              <option value="all">All Sources</option>
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Score Tier filter */}
            <select
              value={scoreTierFilter}
              onChange={(e) => {
                setScoreTierFilter(e.target.value as any);
                setPage(1);
              }}
              className="text-xs bg-sage-50/60 border border-sage-200 rounded-lg px-2.5 py-2 text-sage-700 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 cursor-pointer shadow-soft-xs"
            >
              <option value="all">All Priority Tiers</option>
              <option value="hot">🔥 Hot Priority (75+)</option>
              <option value="warm">Warm Priority (40-74)</option>
              <option value="cold">Cold Priority (&lt;40)</option>
            </select>

            {/* Follow-up filter */}
            <select
              value={followUpFilter}
              onChange={(e) => {
                setFollowUpFilter(e.target.value as any);
                setPage(1);
              }}
              className="text-xs bg-sage-50/60 border border-sage-200 rounded-lg px-2.5 py-2 text-sage-700 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 cursor-pointer shadow-soft-xs"
            >
              <option value="all">All Schedules</option>
              <option value="overdue">⚠️ Overdue Follow-ups</option>
              <option value="upcoming">Upcoming Follow-ups</option>
            </select>

            {(search || stageFilter !== 'all' || sourceFilter !== 'all' || scoreTierFilter !== 'all' || followUpFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setStageFilter('all');
                  setSourceFilter('all');
                  setScoreTierFilter('all');
                  setFollowUpFilter('all');
                  setPage(1);
                }}
                className="text-xs text-brand-800 hover:text-brand-900 font-semibold px-2 py-1"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Leads Table Card */}
      <Card className="bg-white border-sage-200/90 shadow-soft-xs rounded-xl overflow-hidden">
        {error ? (
          <div className="p-8 text-center">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-900">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchLeads} className="mt-4">
              Try Again
            </Button>
          </div>
        ) : isLoading ? (
          <div className="p-12 text-center">
            <div className="w-6 h-6 border-2 border-brand-800 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500">Loading client leads...</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-900">No leads found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              There are no leads matching your active filters or intake webhooks have not sent leads yet.
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="mt-4 bg-brand-800 hover:bg-brand-700 text-white"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add First Lead
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-sage-600">
              <thead className="bg-sage-50/70 text-sage-500 border-b border-sage-200/80 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Stage</th>
                  <th className="py-3 px-4">Score</th>
                  <th className="py-3 px-4">Acquisition Source</th>
                  <th className="py-3 px-4">Follow-Up Date</th>
                  <th className="py-3 px-4">Assigned Rep</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sage-100">
                {leads.map((lead) => {
                  const fullName = `${lead.firstName} ${lead.lastName || ''}`.trim();
                  const isOverdue = lead.followUpDate && new Date(lead.followUpDate) < new Date();

                  return (
                    <tr key={lead._id} className="hover:bg-sage-50/60 transition-colors group">
                      {/* Contact Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-start gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-brand-100 text-brand-800 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5 border border-white shadow-soft-xs">
                            {fullName.charAt(0) || 'U'}
                          </div>
                          <div>
                            <Link
                              href={`/client/leads/${lead._id}`}
                              className="font-bold text-sage-900 hover:text-brand-800 flex items-center gap-1.5 transition-colors"
                            >
                              <span>{fullName}</span>
                              <ExternalLink className="w-3 h-3 text-sage-300 group-hover:text-brand-600 transition-colors" />
                            </Link>
                            <div className="flex flex-col gap-0.5 mt-0.5 text-[11px] text-sage-500">
                              {lead.company && (
                                <span className="flex items-center gap-1 truncate max-w-[200px]">
                                  <Building className="w-3 h-3 text-sage-400 shrink-0" />
                                  {lead.company} {lead.title ? `• ${lead.title}` : ''}
                                </span>
                              )}
                              <div className="flex items-center gap-3">
                                {lead.email && (
                                  <span className="flex items-center gap-1 text-sage-600">
                                    <Mail className="w-3 h-3 text-sage-400 shrink-0" />
                                    {lead.email}
                                  </span>
                                )}
                                {lead.phone && (
                                  <span className="flex items-center gap-1 text-sage-600">
                                    <Phone className="w-3 h-3 text-sage-400 shrink-0" />
                                    {lead.phone}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Stage Selector */}
                      <td className="py-3.5 px-4">
                        <select
                          value={lead.stage}
                          onChange={(e) => handleStageChange(lead._id, e.target.value as LeadStage)}
                          className={`text-xs font-semibold rounded-lg px-2.5 py-1 border transition-colors focus:outline-none focus:ring-2 focus:ring-brand-700/20 shadow-soft-xs cursor-pointer ${
                            lead.stage === 'won'
                              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                              : lead.stage === 'lost'
                              ? 'bg-rose-50 text-rose-800 border-rose-300'
                              : lead.stage === 'new'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : 'bg-sage-50/80 text-sage-800 border-sage-200'
                          }`}
                        >
                          {STAGE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        {lead.stage === 'lost' && lead.lostReason && (
                          <p className="text-[10px] text-rose-600 mt-1 italic truncate max-w-[140px]" title={lead.lostReason}>
                            Reason: {lead.lostReason}
                          </p>
                        )}
                      </td>

                      {/* Score Badge */}
                      <td className="py-3.5 px-4">
                        {getScoreTierBadge(lead.scoreTier, lead.score)}
                      </td>

                      {/* Source */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                          {formatSourceLabel(lead.source)}
                        </span>
                        {lead.attribution?.utmCampaign && (
                          <span className="block text-[10px] text-slate-400 mt-0.5 truncate max-w-[120px]">
                            {lead.attribution.utmCampaign}
                          </span>
                        )}
                      </td>

                      {/* Follow-Up Date */}
                      <td className="py-3.5 px-4">
                        {lead.followUpDate ? (
                          <div className="flex flex-col">
                            <span
                              className={`text-xs font-medium flex items-center gap-1 ${
                                isOverdue ? 'text-rose-600 font-semibold' : 'text-slate-700'
                              }`}
                            >
                              <Calendar className="w-3 h-3" />
                              {new Date(lead.followUpDate).toLocaleDateString()}
                            </span>
                            {isOverdue && (
                              <span className="text-[10px] text-rose-600 font-medium">⚠️ Overdue</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Assigned Rep */}
                      <td className="py-3.5 px-4">
                        {lead.assignedTo ? (
                          <span className="inline-flex items-center gap-1 text-slate-800 font-medium">
                            <UserCheck className="w-3.5 h-3.5 text-brand-600" />
                            {lead.assignedTo.name}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setMessageTargetLead(lead);
                              setMessageBody(`Hi ${lead.firstName}, `);
                              setMessageSuccess(null);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded transition-colors"
                            title="Message Lead via WhatsApp, SMS, or Email"
                          >
                            <MessageSquare className="w-3 h-3" />
                            Message
                          </button>
                          <Link
                            href={`/client/leads/${lead._id}`}
                            className="text-xs font-medium text-brand-800 hover:text-brand-600 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
                          >
                            Details
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleArchive(lead._id, fullName)}
                            title="Archive lead"
                            className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span>
              Showing page <strong className="text-slate-900">{page}</strong> of{' '}
              <strong className="text-slate-900">{totalPages}</strong> ({totalCount} total leads)
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="h-7 px-2 text-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-0.5" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                className="h-7 px-2 text-xs"
              >
                Next <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* New Lead Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Add New Lead</h3>
                <p className="text-xs text-slate-500">Record a new prospective lead in your client CRM</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={newLead.firstName}
                    onChange={(e) => setNewLead({ ...newLead, firstName: e.target.value })}
                    placeholder="e.g. Sarah"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={newLead.lastName}
                    onChange={(e) => setNewLead({ ...newLead, lastName: e.target.value })}
                    placeholder="e.g. Jenkins"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={newLead.email}
                    onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                    placeholder="sarah@example.com"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={newLead.phone}
                    onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                    placeholder="+1 555-0199"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Company</label>
                  <input
                    type="text"
                    value={newLead.company}
                    onChange={(e) => setNewLead({ ...newLead, company: e.target.value })}
                    placeholder="Apex Marketing LLC"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Job Title</label>
                  <input
                    type="text"
                    value={newLead.title}
                    onChange={(e) => setNewLead({ ...newLead, title: e.target.value })}
                    placeholder="VP of Growth"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Acquisition Source</label>
                  <select
                    value={newLead.source}
                    onChange={(e) => setNewLead({ ...newLead, source: e.target.value as LeadSource })}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                  >
                    {SOURCE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assign Representative</label>
                  <select
                    value={newLead.assignedTo}
                    onChange={(e) => setNewLead({ ...newLead, assignedTo: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                  >
                    <option value="">Unassigned</option>
                    {teamMembers.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name} ({m.roleName})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Follow-Up Date</label>
                <input
                  type="date"
                  value={newLead.followUpDate}
                  onChange={(e) => setNewLead({ ...newLead, followUpDate: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Notes</label>
                <textarea
                  rows={3}
                  value={newLead.notes}
                  onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                  placeholder="Inquired about full-service Google Ads management..."
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isSubmitting}
                  className="bg-brand-800 hover:bg-brand-700 text-white"
                >
                  Save Lead
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lost Reason Modal */}
      {lostTargetLeadId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden p-6 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-500" />
                Mark Lead as Lost
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                A reason must be recorded when moving a lead to Lost for marketing and pipeline reporting.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Lost *</label>
              <textarea
                rows={3}
                required
                value={lostReasonInput}
                onChange={(e) => setLostReasonInput(e.target.value)}
                placeholder="e.g. Budget constraints, opted for competitor, timing postponed..."
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLostTargetLeadId(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                isLoading={isUpdatingStage}
                onClick={confirmLostStage}
              >
                Confirm Lost
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Message Lead Modal */}
      {messageTargetLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Message {messageTargetLead.firstName} {messageTargetLead.lastName || ''}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {messageTargetLead.company ? `${messageTargetLead.company} • ` : ''}
                    {messageTargetLead.phone || messageTargetLead.email || 'No direct phone/email'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMessageTargetLead(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick External Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {messageTargetLead.phone && (
                <a
                  href={`https://wa.me/${messageTargetLead.phone.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                >
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                  WhatsApp Web
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              )}
              {messageTargetLead.email && (
                <a
                  href={`mailto:${messageTargetLead.email}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  Mail App
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              )}
              {messageTargetLead.phone && (
                <a
                  href={`tel:${messageTargetLead.phone}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-amber-600" />
                  Call / Cellular
                </a>
              )}
              <Link
                href={`/client/inbox?leadId=${messageTargetLead._id}&contactName=${encodeURIComponent(
                  `${messageTargetLead.firstName} ${messageTargetLead.lastName || ''}`.trim()
                )}&phone=${encodeURIComponent(messageTargetLead.phone || '')}&email=${encodeURIComponent(
                  messageTargetLead.email || ''
                )}&channel=${messageChannel}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-50 text-brand-800 hover:bg-brand-100 border border-brand-200 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5 text-brand-700" />
                Open in Unified Inbox
              </Link>
            </div>

            {/* Quick Send Form */}
            <form onSubmit={handleSendMessageSubmit} className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">Dispatch Outbound Message:</label>
                <div className="flex items-center gap-1">
                  {(['whatsapp', 'email', 'sms'] as ConversationChannel[]).map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setMessageChannel(ch)}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider transition-all ${
                        messageChannel === ch
                          ? 'bg-brand-800 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                rows={4}
                required
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder={`Type message to dispatch via ${messageChannel.toUpperCase()}...`}
                className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500 leading-relaxed"
              />

              {messageSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-medium">{messageSuccess}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <Link
                  href="/client/integrations?tab=messaging"
                  className="text-[11px] text-slate-400 hover:text-brand-700 underline flex items-center gap-1"
                >
                  <span>Configure API tokens</span>
                </Link>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setMessageTargetLead(null)}
                  >
                    Close
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSendingMessage || !messageBody.trim()}
                    className="bg-brand-800 hover:bg-brand-700 text-white flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {isSendingMessage ? 'Dispatching...' : `Send ${messageChannel.toUpperCase()}`}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
