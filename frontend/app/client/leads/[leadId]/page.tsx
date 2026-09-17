'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Flame,
  Mail,
  Phone,
  Building,
  User,
  UserCheck,
  Tag,
  Globe,
  FileText,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Send,
  Code,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MessageSquare,
  Smartphone,
  X,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  getLeadApi,
  updateLeadStageApi,
  assignLeadApi,
  scheduleFollowUpApi,
  deleteLeadApi,
  getLeadActivitiesApi,
  addLeadNoteApi,
  LeadItem,
  LeadActivityItem,
  LeadStage
} from '@/lib/leads';
import { getWorkspaceTeamApi, ClientMemberItem } from '@/lib/clients';
import { createConversationApi, ConversationChannel } from '@/lib/conversations';

const STAGE_STEPS: { key: LeadStage; label: string }[] = [
  { key: 'new', label: 'New Lead' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'proposal', label: 'Proposal' },
  { key: 'won', label: 'Won Deal' },
];

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.leadId as string;

  const [lead, setLead] = useState<LeadItem | null>(null);
  const [activities, setActivities] = useState<LeadActivityItem[]>([]);
  const [teamMembers, setTeamMembers] = useState<ClientMemberItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Note state
  const [noteInput, setNoteInput] = useState('');
  const [isPostingNote, setIsPostingNote] = useState(false);

  // Follow up state
  const [isFollowUpOpen, setIsFollowUpOpen] = useState(false);
  const [newFollowUpDate, setNewFollowUpDate] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [isSavingFollowUp, setIsSavingFollowUp] = useState(false);

  // Lost modal state
  const [isLostModalOpen, setIsLostModalOpen] = useState(false);
  const [lostReasonInput, setLostReasonInput] = useState('');
  const [isSavingLost, setIsSavingLost] = useState(false);

  // Raw payload toggle
  const [showRawPayload, setShowRawPayload] = useState(false);

  // Message Modal State
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [messageChannel, setMessageChannel] = useState<ConversationChannel>('whatsapp');
  const [messageBody, setMessageBody] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messageSuccess, setMessageSuccess] = useState<string | null>(null);

  const handleSendMessageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead || !messageBody.trim()) return;
    setIsSendingMessage(true);
    try {
      const fullName = `${lead.firstName} ${lead.lastName || ''}`.trim();
      await createConversationApi({
        contactName: fullName,
        contactEmail: lead.email,
        contactPhone: lead.phone,
        leadId: lead._id,
        channel: messageChannel,
        subject: `Outreach to ${fullName} (${messageChannel.toUpperCase()})`,
        initialMessage: messageBody.trim(),
        priority: lead.scoreTier === 'hot' ? 'urgent' : 'medium',
      });
      setMessageSuccess(`Message dispatched via ${messageChannel.toUpperCase()}!`);
      setMessageBody('');
      setTimeout(() => {
        setIsMessageModalOpen(false);
        setMessageSuccess(null);
        loadData();
      }, 2000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to dispatch message');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [leadData, activitiesData, teamData] = await Promise.all([
        getLeadApi(leadId),
        getLeadActivitiesApi(leadId),
        getWorkspaceTeamApi().catch(() => null),
      ]);
      setLead(leadData);
      setActivities(activitiesData || []);
      if (teamData?.members) {
        setTeamMembers(teamData.members);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load lead details');
    } finally {
      setIsLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    if (leadId) {
      loadData();
    }
  }, [leadId, loadData]);

  // Stage change handler
  const handleStageChange = async (targetStage: LeadStage) => {
    if (!lead || lead.stage === targetStage) return;

    if (targetStage === 'lost') {
      setIsLostModalOpen(true);
      return;
    }

    try {
      await updateLeadStageApi(leadId, targetStage);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to update stage');
    }
  };

  const confirmLostReason = async () => {
    if (!lostReasonInput.trim()) {
      alert('Please state a reason for marking this lead as Lost.');
      return;
    }
    setIsSavingLost(true);
    try {
      await updateLeadStageApi(leadId, 'lost', lostReasonInput.trim());
      setIsLostModalOpen(false);
      setLostReasonInput('');
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to update stage to Lost');
    } finally {
      setIsSavingLost(false);
    }
  };

  // Assignment handler
  const handleAssignChange = async (userId: string) => {
    try {
      await assignLeadApi(leadId, userId || null);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to update lead assignment');
    }
  };

  // Follow-up handler
  const handleSaveFollowUp = async (dateStr: string | null, notes?: string) => {
    setIsSavingFollowUp(true);
    try {
      await scheduleFollowUpApi(leadId, dateStr, notes);
      setIsFollowUpOpen(false);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to schedule follow-up');
    } finally {
      setIsSavingFollowUp(false);
    }
  };

  // Add Note handler
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteInput.trim()) return;

    setIsPostingNote(true);
    try {
      await addLeadNoteApi(leadId, noteInput.trim());
      setNoteInput('');
      const updatedActivities = await getLeadActivitiesApi(leadId);
      setActivities(updatedActivities || []);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to save note');
    } finally {
      setIsPostingNote(false);
    }
  };

  // Archive lead
  const handleArchiveLead = async () => {
    if (!confirm('Are you sure you want to archive this lead?')) return;
    try {
      await deleteLeadApi(leadId);
      router.push('/client/leads');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to archive lead');
    }
  };

  if (isLoading) {
    return (
      <div className="p-16 text-center">
        <div className="w-6 h-6 border-2 border-brand-800 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-slate-500">Loading lead details...</p>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
        <h3 className="text-base font-semibold text-slate-900">Lead Not Found</h3>
        <p className="text-xs text-slate-500 mt-1">{error || 'This lead may have been deleted or archived.'}</p>
        <Link href="/client/leads" className="inline-block mt-4">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Leads
          </Button>
        </Link>
      </div>
    );
  }

  const fullName = `${lead.firstName} ${lead.lastName || ''}`.trim();
  const isOverdue = lead.followUpDate && new Date(lead.followUpDate) < new Date();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Navigation */}
      <div>
        <Link
          href="/client/leads"
          className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Back to Leads Directory
        </Link>
      </div>

      {/* Hero Header Card */}
      <Card className="bg-white border-slate-200 shadow-xs">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">{fullName}</h1>
                <Badge
                  variant={
                    lead.stage === 'won'
                      ? 'success'
                      : lead.stage === 'lost'
                      ? 'danger'
                      : lead.stage === 'new'
                      ? 'info'
                      : 'brand'
                  }
                  className="capitalize font-semibold text-xs px-2.5 py-0.5"
                >
                  {lead.stage}
                </Badge>
                {lead.scoreTier === 'hot' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                    <Flame className="w-3 h-3 text-rose-500 fill-rose-500" />
                    Hot Lead ({lead.score} pts)
                  </span>
                )}
                {lead.scoreTier === 'warm' && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                    Warm ({lead.score} pts)
                  </span>
                )}
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                  Via {lead.source.replace('_', ' ')}
                </span>
              </div>

              <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 flex-wrap">
                {lead.company && (
                  <span className="flex items-center gap-1.5 font-medium text-slate-700">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    {lead.company} {lead.title ? `(${lead.title})` : ''}
                  </span>
                )}
                {lead.email && (
                  <a
                    href={`mailto:${lead.email}`}
                    className="flex items-center gap-1.5 hover:text-brand-700 hover:underline"
                  >
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    {lead.email}
                  </a>
                )}
                {lead.phone && (
                  <a
                    href={`tel:${lead.phone}`}
                    className="flex items-center gap-1.5 hover:text-brand-700 hover:underline"
                  >
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {lead.phone}
                  </a>
                )}
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Stage selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400 font-medium">Stage:</span>
                <select
                  value={lead.stage}
                  onChange={(e) => handleStageChange(e.target.value as LeadStage)}
                  className="text-xs bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="qualified">Qualified</option>
                  <option value="proposal">Proposal</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                  <option value="unqualified">Unqualified</option>
                </select>
              </div>

              {/* Assignment selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400 font-medium">Assign:</span>
                <select
                  value={lead.assignedTo?._id || ''}
                  onChange={(e) => handleAssignChange(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                size="sm"
                onClick={() => {
                  setIsMessageModalOpen(true);
                  setMessageBody(`Hi ${lead.firstName}, `);
                  setMessageSuccess(null);
                }}
                className="bg-brand-800 hover:bg-brand-700 text-white text-xs shadow-xs flex items-center gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Message Lead
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFollowUpOpen(true)}
                className="text-xs border-slate-300"
              >
                <Calendar className="w-3.5 h-3.5 mr-1" />
                Schedule
              </Button>

              <button
                type="button"
                onClick={handleArchiveLead}
                title="Archive Lead"
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Lost alert banner if lost */}
          {lead.stage === 'lost' && lead.lostReason && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong>Marked as Lost:</strong> {lead.lostReason}
              </div>
            </div>
          )}

          {/* Visual Pipeline Stepper */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between relative">
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-slate-200 -z-0" />
              {STAGE_STEPS.map((s, idx) => {
                const isCurrent = lead.stage === s.key;
                const isPassed =
                  STAGE_STEPS.findIndex((x) => x.key === lead.stage) > idx;

                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => handleStageChange(s.key)}
                    className="relative z-10 flex flex-col items-center group focus:outline-none"
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                        isCurrent
                          ? 'bg-brand-800 border-brand-800 text-white ring-4 ring-brand-100'
                          : isPassed
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'bg-white border-slate-300 text-slate-400 group-hover:border-slate-400'
                      }`}
                    >
                      {isPassed ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                    </div>
                    <span
                      className={`mt-1.5 text-[11px] font-semibold ${
                        isCurrent
                          ? 'text-brand-900'
                          : isPassed
                          ? 'text-slate-800'
                          : 'text-slate-400'
                      }`}
                    >
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (Details, Attribution, Follow-up) */}
        <div className="space-y-6 lg:col-span-1">
          {/* Follow-Up Card */}
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="py-3 px-4 border-b border-slate-100 flex items-center justify-between">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Follow-Up SLA Status
              </CardTitle>
              <button
                type="button"
                onClick={() => setIsFollowUpOpen(true)}
                className="text-xs text-brand-700 font-semibold hover:underline"
              >
                Reschedule
              </button>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-xs">
              {lead.followUpDate ? (
                <div>
                  <div className="flex items-center gap-2">
                    <Clock className={`w-4 h-4 ${isOverdue ? 'text-rose-600' : 'text-slate-500'}`} />
                    <span className={`font-semibold ${isOverdue ? 'text-rose-600' : 'text-slate-800'}`}>
                      {new Date(lead.followUpDate).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>
                  {isOverdue && (
                    <p className="mt-1 text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> SLA Follow-up Overdue
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-slate-500 italic">No follow-up currently scheduled.</div>
              )}

              <div className="pt-2 border-t border-slate-100 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-[11px] h-7"
                  onClick={() => {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    handleSaveFollowUp(tomorrow.toISOString(), 'Quick follow-up set for tomorrow');
                  }}
                >
                  +1 Day
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-[11px] h-7"
                  onClick={() => {
                    const nextWeek = new Date();
                    nextWeek.setDate(nextWeek.getDate() + 7);
                    handleSaveFollowUp(nextWeek.toISOString(), 'Follow-up set for next week');
                  }}
                >
                  +7 Days
                </Button>
                {lead.followUpDate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[11px] h-7 text-slate-500 hover:text-rose-600"
                    onClick={() => handleSaveFollowUp(null)}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Marketing Attribution Card */}
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="py-3 px-4 border-b border-slate-100">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Marketing Attribution
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">Intake Method</span>
                <span className="font-semibold text-slate-800 capitalize">{lead.intakeMethod}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">Source</span>
                <span className="font-semibold text-slate-800">{lead.source}</span>
              </div>
              {lead.attribution?.utmCampaign && (
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400">UTM Campaign</span>
                  <span className="font-semibold text-slate-800">{lead.attribution.utmCampaign}</span>
                </div>
              )}
              {lead.attribution?.utmSource && (
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400">UTM Source</span>
                  <span className="font-semibold text-slate-800">{lead.attribution.utmSource}</span>
                </div>
              )}
              {lead.attribution?.utmMedium && (
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400">UTM Medium</span>
                  <span className="font-semibold text-slate-800">{lead.attribution.utmMedium}</span>
                </div>
              )}
              {lead.attribution?.adId && (
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400">Ad Identifier</span>
                  <span className="font-mono text-slate-800">{lead.attribution.adId}</span>
                </div>
              )}
              {lead.attribution?.formId && (
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400">Form ID</span>
                  <span className="font-mono text-slate-800">{lead.attribution.formId}</span>
                </div>
              )}
              {lead.attribution?.landingPage && (
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400">Landing Page</span>
                  <span className="font-mono text-[11px] text-slate-700 truncate max-w-[150px]" title={lead.attribution.landingPage}>
                    {lead.attribution.landingPage}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-1">
                <span className="text-slate-400">First Captured</span>
                <span className="text-slate-700">
                  {new Date(lead.createdAt).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Webhook Payload Debugger (if intakeMethod === webhook) */}
          {lead.intakePayloadSnapshot && Object.keys(lead.intakePayloadSnapshot).length > 0 && (
            <Card className="bg-white border-slate-200 shadow-xs">
              <CardHeader
                className="py-3 px-4 border-b border-slate-100 cursor-pointer hover:bg-slate-50"
                onClick={() => setShowRawPayload(!showRawPayload)}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5 text-slate-500" />
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Webhook Payload Snapshot
                    </CardTitle>
                  </div>
                  {showRawPayload ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </CardHeader>
              {showRawPayload && (
                <CardContent className="p-3 bg-slate-900 rounded-b-lg">
                  <pre className="text-[11px] text-emerald-400 font-mono overflow-x-auto max-h-60 p-2">
                    {JSON.stringify(lead.intakePayloadSnapshot, null, 2)}
                  </pre>
                </CardContent>
              )}
            </Card>
          )}
        </div>

        {/* Right Column (Activity Timeline & Notes) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Post Note Card */}
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="py-3 px-5 border-b border-slate-100">
              <CardTitle className="text-sm font-semibold text-slate-900">
                Log Activity / Note
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleAddNote} className="space-y-3">
                <textarea
                  rows={3}
                  required
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Record call summary, client feedback, next steps, or internal note..."
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isPostingNote}
                    className="bg-brand-800 hover:bg-brand-700 text-white text-xs"
                  >
                    <Send className="w-3.5 h-3.5 mr-1" />
                    Post Activity Note
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Activity Timeline Card */}
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="py-3 px-5 border-b border-slate-100">
              <CardTitle className="text-sm font-semibold text-slate-900">
                Interaction History & Audit Trail ({activities.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              {activities.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 italic">
                  No activity entries recorded yet for this lead.
                </div>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {activities.map((act) => (
                    <div key={act._id} className="relative group">
                      {/* Timeline dot */}
                      <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-brand-700 border-2 border-white ring-1 ring-slate-200" />

                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-900">{act.title}</span>
                          <span className="text-[11px] text-slate-400">
                            {new Date(act.createdAt).toLocaleString(undefined, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </span>
                        </div>

                        {act.description && (
                          <p className="text-xs text-slate-600 mt-1 whitespace-pre-line bg-slate-50 p-2.5 rounded border border-slate-100">
                            {act.description}
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                          {act.userId ? (
                            <span>By: {act.userId.name}</span>
                          ) : (
                            <span>System Automation</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Schedule Follow-up Modal */}
      {isFollowUpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Schedule Lead Follow-Up</h3>
              <p className="text-xs text-slate-500 mt-0.5">Set a calendar target date and note for sales follow-up</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Date *</label>
                <input
                  type="date"
                  required
                  value={newFollowUpDate}
                  onChange={(e) => setNewFollowUpDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Follow-Up Note</label>
                <textarea
                  rows={2}
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                  placeholder="Call about pricing proposal review..."
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setIsFollowUpOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={isSavingFollowUp}
                onClick={() => {
                  if (!newFollowUpDate) {
                    alert('Please select a date.');
                    return;
                  }
                  handleSaveFollowUp(new Date(newFollowUpDate).toISOString(), followUpNotes);
                }}
                className="bg-brand-800 text-white"
              >
                Save Schedule
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Lost Reason Modal */}
      {isLostModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
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
                onClick={() => setIsLostModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                isLoading={isSavingLost}
                onClick={confirmLostReason}
              >
                Confirm Lost
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Message Lead Modal */}
      {isMessageModalOpen && lead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Message {lead.firstName} {lead.lastName || ''}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {lead.company ? `${lead.company} • ` : ''}
                    {lead.phone || lead.email || 'No direct phone/email'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMessageModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick External Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {lead.phone && (
                <a
                  href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                >
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                  WhatsApp Web
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              )}
              {lead.email && (
                <a
                  href={`mailto:${lead.email}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  Mail App
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              )}
              {lead.phone && (
                <a
                  href={`tel:${lead.phone}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-amber-600" />
                  Call / Cellular
                </a>
              )}
              <Link
                href={`/client/inbox?leadId=${lead._id}&contactName=${encodeURIComponent(
                  `${lead.firstName} ${lead.lastName || ''}`.trim()
                )}&phone=${encodeURIComponent(lead.phone || '')}&email=${encodeURIComponent(
                  lead.email || ''
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
                    onClick={() => setIsMessageModalOpen(false)}
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
