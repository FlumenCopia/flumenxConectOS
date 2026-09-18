'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  Kanban,
  Plus,
  Flame,
  Clock,
  Calendar,
  Building,
  Mail,
  Phone,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  getLeadsApi,
  updateLeadStageApi,
  getPipelineSummaryApi,
  createLeadApi,
  LeadItem,
  LeadStage,
  PipelineSummary,
  ScoreTier,
  LeadSource
} from '@/lib/leads';
import { getWorkspaceTeamApi, ClientMemberItem } from '@/lib/clients';

const STAGES: { key: LeadStage; label: string; color: string; border: string; bg: string }[] = [
  { key: 'new', label: 'New', color: 'text-blue-700', border: 'border-blue-200', bg: 'bg-blue-50/50' },
  { key: 'contacted', label: 'Contacted', color: 'text-purple-700', border: 'border-purple-200', bg: 'bg-purple-50/50' },
  { key: 'qualified', label: 'Qualified', color: 'text-indigo-700', border: 'border-indigo-200', bg: 'bg-indigo-50/50' },
  { key: 'proposal', label: 'Proposal', color: 'text-amber-700', border: 'border-amber-200', bg: 'bg-amber-50/50' },
  { key: 'won', label: 'Won', color: 'text-emerald-700', border: 'border-emerald-200', bg: 'bg-emerald-50/50' },
  { key: 'lost', label: 'Lost', color: 'text-rose-700', border: 'border-rose-200', bg: 'bg-rose-50/50' },
  { key: 'unqualified', label: 'Unqualified', color: 'text-slate-600', border: 'border-slate-200', bg: 'bg-slate-50/50' },
];

const STAGE_SEQUENCE: LeadStage[] = ['new', 'contacted', 'qualified', 'proposal', 'won'];

export default function PipelinePage() {
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [summaries, setSummaries] = useState<Record<string, PipelineSummary>>({});
  const [teamMembers, setTeamMembers] = useState<ClientMemberItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<LeadStage | null>(null);

  // Lost modal states
  const [lostLeadId, setLostLeadId] = useState<string | null>(null);
  const [lostReason, setLostReason] = useState('');
  const [isSubmittingLost, setIsSubmittingLost] = useState(false);

  // Add lead modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createStage, setCreateStage] = useState<LeadStage>('new');
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

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [leadsRes, summaryRes, teamRes] = await Promise.all([
        getLeadsApi({ limit: 150 }).catch((err) => {
          console.error('getLeadsApi error', err);
          return { leads: [], pagination: { total: 0 } };
        }),
        getPipelineSummaryApi().catch((err) => {
          console.warn('getPipelineSummaryApi error', err);
          return [];
        }),
        getWorkspaceTeamApi().catch(() => null),
      ]);

      setLeads(leadsRes?.leads || []);

      const summaryMap: Record<string, PipelineSummary> = {};
      if (Array.isArray(summaryRes)) {
        summaryRes.forEach((s) => {
          if (s?.stage) summaryMap[s.stage] = s;
        });
      }
      setSummaries(summaryMap);

      if (teamRes?.members) {
        setTeamMembers(teamRes.members);
      }
    } catch (err) {
      console.error('Failed to load pipeline data', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Stage advancement
  const handleTransition = async (leadId: string, targetStage: LeadStage) => {
    const lead = leads.find((l) => l._id === leadId);
    if (!lead || lead.stage === targetStage) return;

    if (targetStage === 'lost') {
      setLostLeadId(leadId);
      setLostReason('');
      return;
    }

    // Optimistic UI update
    setLeads((prev) =>
      prev.map((l) => (l._id === leadId ? { ...l, stage: targetStage } : l))
    );

    try {
      await updateLeadStageApi(leadId, targetStage);
      const updatedSummaries = await getPipelineSummaryApi();
      const sMap: Record<string, PipelineSummary> = {};
      updatedSummaries.forEach((s) => { sMap[s.stage] = s; });
      setSummaries(sMap);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to update pipeline stage');
      loadData();
    }
  };

  const submitLostReason = async () => {
    if (!lostLeadId) return;
    if (!lostReason.trim()) {
      alert('Please provide a reason before marking lead as Lost.');
      return;
    }

    setIsSubmittingLost(true);
    try {
      await updateLeadStageApi(lostLeadId, 'lost', lostReason.trim());
      setLostLeadId(null);
      setLostReason('');
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to update lead');
    } finally {
      setIsSubmittingLost(false);
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    setDraggedLeadId(leadId);
    e.dataTransfer.setData('text/plain', leadId);
  };

  const handleDragOver = (e: React.DragEvent, stage: LeadStage) => {
    e.preventDefault();
    if (dragOverStage !== stage) {
      setDragOverStage(stage);
    }
  };

  const handleDragLeave = (stage: LeadStage) => {
    if (dragOverStage === stage) {
      setDragOverStage(null);
    }
  };

  const handleDrop = (e: React.DragEvent, stage: LeadStage) => {
    e.preventDefault();
    setDragOverStage(null);
    const leadId = e.dataTransfer.getData('text/plain') || draggedLeadId;
    if (leadId) {
      handleTransition(leadId, stage);
    }
    setDraggedLeadId(null);
  };

  // Quick sequential advance
  const handleQuickAdvance = (lead: LeadItem, direction: 'next' | 'prev') => {
    const currentIndex = STAGE_SEQUENCE.indexOf(lead.stage);
    if (currentIndex === -1) {
      if (direction === 'prev') handleTransition(lead._id, 'qualified');
      return;
    }
    const targetIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (targetIndex >= 0 && targetIndex < STAGE_SEQUENCE.length) {
      handleTransition(lead._id, STAGE_SEQUENCE[targetIndex]);
    }
  };

  // Handle Quick Create Lead from Column
  const handleOpenCreateForStage = (stage: LeadStage) => {
    setCreateStage(stage);
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLead.firstName.trim()) {
      alert('First Name is required');
      return;
    }

    try {
      const created = await createLeadApi({
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

      // Advance stage if not 'new'
      if (createStage !== 'new') {
        await updateLeadStageApi(created._id, createStage);
      }

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
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to create lead');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sage-200/90">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-sage-900">Lead Pipeline Board</h1>
          <p className="text-xs text-sage-500 mt-1 font-normal">
            Visualize client deal flow, drag prospects across stages, and maintain sales velocity.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View Switcher */}
          <div className="inline-flex rounded-lg border border-sage-200 bg-white p-1 shadow-soft-xs">
            <Link
              href="/client/leads"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-sage-600 hover:text-sage-900 hover:bg-sage-50 transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
              Directory
            </Link>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-brand-800 text-white shadow-soft-xs"
            >
              <Kanban className="w-3.5 h-3.5" />
              Pipeline Board
            </button>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => handleOpenCreateForStage('new')}
            className="shadow-forest-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Lead
          </Button>
        </div>
      </div>

      {/* Kanban Board Container */}
      {isLoading ? (
        <div className="p-16 text-center bg-white rounded-lg border border-slate-200">
          <div className="w-6 h-6 border-2 border-brand-800 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500">Loading pipeline board...</p>
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-[1280px]">
            {STAGES.map((col) => {
              const colLeads = leads.filter((l) => l.stage === col.key);
              const colSummary = summaries[col.key];
              const isOver = dragOverStage === col.key;

              return (
                <div
                  key={col.key}
                  onDragOver={(e) => handleDragOver(e, col.key)}
                  onDragLeave={() => handleDragLeave(col.key)}
                  onDrop={(e) => handleDrop(e, col.key)}
                  className={`flex-1 flex flex-col min-w-[240px] max-w-[280px] bg-slate-100/70 rounded-xl p-3 border transition-colors ${
                    isOver ? 'border-brand-500 ring-2 ring-brand-200 bg-brand-50/30' : col.border
                  }`}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold uppercase tracking-wider ${col.color}`}>
                        {col.label}
                      </span>
                      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">
                        {colLeads.length}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenCreateForStage(col.key)}
                      title={`Add lead to ${col.label}`}
                      className="text-slate-400 hover:text-slate-700 p-0.5 rounded hover:bg-white transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Cards Container */}
                  <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[calc(100vh-280px)] pr-0.5">
                    {colLeads.length === 0 ? (
                      <div className="h-28 border border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center text-center p-3">
                        <p className="text-[11px] text-slate-400">No leads in {col.label}</p>
                        <button
                          type="button"
                          onClick={() => handleOpenCreateForStage(col.key)}
                          className="mt-1 text-[11px] font-medium text-brand-700 hover:underline"
                        >
                          + Add here
                        </button>
                      </div>
                    ) : (
                      colLeads.map((lead) => {
                        const fullName = `${lead.firstName} ${lead.lastName || ''}`.trim();
                        const isOverdue = lead.followUpDate && new Date(lead.followUpDate) < new Date();
                        const canAdvanceForward =
                          STAGE_SEQUENCE.includes(lead.stage) &&
                          STAGE_SEQUENCE.indexOf(lead.stage) < STAGE_SEQUENCE.length - 1;
                        const canAdvanceBackward =
                          STAGE_SEQUENCE.includes(lead.stage) &&
                          STAGE_SEQUENCE.indexOf(lead.stage) > 0;

                        return (
                          <div
                            key={lead._id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, lead._id)}
                            className="bg-white rounded-lg p-3 border border-slate-200 shadow-xs hover:shadow-sm transition-all cursor-grab active:cursor-grabbing group select-none"
                          >
                            {/* Card Top: Name & Quick link */}
                            <div className="flex items-start justify-between gap-1">
                              <Link
                                href={`/client/leads/${lead._id}`}
                                className="font-semibold text-xs text-slate-900 hover:text-brand-700 leading-snug line-clamp-1 group-hover:text-brand-800"
                              >
                                {fullName}
                              </Link>
                              <Link
                                href={`/client/leads/${lead._id}`}
                                className="text-slate-300 hover:text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            </div>

                            {/* Company / Title */}
                            {lead.company && (
                              <p className="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-1">
                                <Building className="w-3 h-3 text-slate-400 shrink-0" />
                                {lead.company}
                              </p>
                            )}

                            {/* Badges: Score & Source */}
                            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                              {lead.scoreTier === 'hot' && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  <Flame className="w-2.5 h-2.5 text-rose-500 fill-rose-500" />
                                  Hot ({lead.score})
                                </span>
                              )}
                              {lead.scoreTier === 'warm' && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                  Warm ({lead.score})
                                </span>
                              )}
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                                {lead.source.replace('_', ' ')}
                              </span>
                            </div>

                            {/* Follow-up reminder */}
                            {lead.followUpDate && (
                              <div
                                className={`mt-2 flex items-center gap-1 text-[10px] font-medium ${
                                  isOverdue ? 'text-rose-600' : 'text-slate-500'
                                }`}
                              >
                                <Clock className="w-3 h-3" />
                                <span>
                                  {isOverdue ? 'Due: ' : 'Follow-up: '}
                                  {new Date(lead.followUpDate).toLocaleDateString()}
                                </span>
                              </div>
                            )}

                            {/* Footer: Assigned Rep & Quick Advance */}
                            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                              <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                                {lead.assignedTo?.name || 'Unassigned'}
                              </span>

                              <div className="flex items-center gap-1">
                                {canAdvanceBackward && (
                                  <button
                                    type="button"
                                    onClick={() => handleQuickAdvance(lead, 'prev')}
                                    title="Move back one stage"
                                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                                  >
                                    <ArrowLeft className="w-3 h-3" />
                                  </button>
                                )}
                                {canAdvanceForward && (
                                  <button
                                    type="button"
                                    onClick={() => handleQuickAdvance(lead, 'next')}
                                    title="Advance to next stage"
                                    className="p-1 rounded text-brand-700 hover:text-brand-900 hover:bg-brand-50"
                                  >
                                    <ArrowRight className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lost Reason Modal */}
      {lostLeadId && (
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
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                placeholder="e.g. Budget constraints, opted for competitor, timing postponed..."
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLostLeadId(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                isLoading={isSubmittingLost}
                onClick={submitLostReason}
              >
                Confirm Lost
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Add Lead to &quot;{STAGES.find((s) => s.key === createStage)?.label}&quot; Stage
                </h3>
                <p className="text-xs text-slate-500">Fast CRM pipeline prospect creation</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={newLead.firstName}
                    onChange={(e) => setNewLead({ ...newLead, firstName: e.target.value })}
                    className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={newLead.lastName}
                    onChange={(e) => setNewLead({ ...newLead, lastName: e.target.value })}
                    className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={newLead.email}
                    onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                    className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={newLead.phone}
                    onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                    className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500"
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
                    className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assign Rep</label>
                  <select
                    value={newLead.assignedTo}
                    onChange={(e) => setNewLead({ ...newLead, assignedTo: e.target.value })}
                    className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                  >
                    <option value="">Unassigned</option>
                    {teamMembers.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" className="bg-brand-800 text-white">
                  Add to Board
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
