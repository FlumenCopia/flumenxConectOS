'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  DollarSign,
  Layers,
  Sparkles,
  Search,
  Filter,
  Plus,
  ArrowUpRight,
  Eye,
  FileCheck,
  History,
  AlertTriangle,
  X,
  Send,
  ThumbsUp,
  RotateCcw,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export type ApprovalType = 'creative_ad' | 'copywriting' | 'budget_revision' | 'landing_page';
export type ApprovalStatus = 'pending_approval' | 'approved' | 'changes_requested';

export interface ApprovalItem {
  id: string;
  title: string;
  type: ApprovalType;
  platform: 'Meta Ads' | 'Google Ads' | 'All Channels';
  campaignName: string;
  description: string;
  previewUrl?: string;
  headline?: string;
  bodyText?: string;
  budgetChange?: {
    currentBudget: number;
    proposedBudget: number;
    currency: string;
    effectiveDate: string;
  };
  status: ApprovalStatus;
  requestedBy: string;
  requestedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  clientComments?: string;
}

export default function ClientApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [success, setSuccess] = useState<string | null>(null);

  // Review Modal State
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(null);
  const [reviewMode, setReviewMode] = useState<'view' | 'request_changes'>('view');
  const [revisionComments, setRevisionComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Request Modal
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<ApprovalType>('creative_ad');
  const [newPlatform, setNewPlatform] = useState<'Meta Ads' | 'Google Ads' | 'All Channels'>('Meta Ads');
  const [newCampaign, setNewCampaign] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newHeadline, setNewHeadline] = useState('');

  const handleApprove = (item: ApprovalItem) => {
    setApprovals(
      approvals.map((a) =>
        a.id === item.id
          ? {
              ...a,
              status: 'approved',
              reviewedBy: 'Current Client User',
              reviewedAt: new Date().toISOString(),
              clientComments: 'Formally approved for live deployment.',
            }
          : a
      )
    );
    setSelectedItem(null);
    setSuccess(`"${item.title}" approved! Account management team notified.`);
    setTimeout(() => setSuccess(null), 5000);
  };

  const handleRequestChangesSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !revisionComments.trim()) return;

    setIsSubmitting(true);
    setTimeout(() => {
      setApprovals(
        approvals.map((a) =>
          a.id === selectedItem.id
            ? {
                ...a,
                status: 'changes_requested',
                reviewedBy: 'Current Client User',
                reviewedAt: new Date().toISOString(),
                clientComments: revisionComments.trim(),
              }
            : a
        )
      );
      setIsSubmitting(false);
      setSelectedItem(null);
      setRevisionComments('');
      setSuccess(`Revision request logged for "${selectedItem.title}".`);
      setTimeout(() => setSuccess(null), 5000);
    }, 400);
  };

  const handleCreateApproval = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newItem: ApprovalItem = {
      id: `appr_${Date.now()}`,
      title: newTitle.trim(),
      type: newType,
      platform: newPlatform,
      campaignName: newCampaign.trim() || 'General Marketing Campaign',
      description: newDesc.trim() || 'New creative proposal submitted for client review.',
      headline: newHeadline.trim(),
      status: 'pending_approval',
      requestedBy: 'Agency Creative Team',
      requestedAt: new Date().toISOString(),
    };

    setApprovals([newItem, ...approvals]);
    setIsNewModalOpen(false);
    setNewTitle('');
    setNewCampaign('');
    setNewDesc('');
    setNewHeadline('');
    setSuccess(`Approval request "${newItem.title}" submitted for sign-off.`);
    setTimeout(() => setSuccess(null), 5000);
  };

  const filteredApprovals = approvals.filter((item) => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.campaignName.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q)
    );
  });

  const pendingCount = approvals.filter((a) => a.status === 'pending_approval').length;
  const approvedCount = approvals.filter((a) => a.status === 'approved').length;
  const changesCount = approvals.filter((a) => a.status === 'changes_requested').length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-brand-50 text-brand-700">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Creative & Campaign Approvals (Release 12)
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Collaborative client sign-off workflow for ad graphics, copywriting, landing pages, and budget scaling.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={() => setIsNewModalOpen(true)}
            className="bg-brand-600 hover:bg-brand-700 text-white flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Submit Approval Item
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-amber-200 shadow-sm bg-amber-50/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-amber-800 text-xs font-semibold uppercase tracking-wider">
              <span>Pending Review</span>
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-900">{pendingCount}</div>
            <div className="text-[11px] text-amber-700 mt-0.5">Awaiting client sign-off</div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 shadow-sm bg-emerald-50/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-emerald-800 text-xs font-semibold uppercase tracking-wider">
              <span>Approved & Live</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-900">{approvedCount}</div>
            <div className="text-[11px] text-emerald-700 mt-0.5">Authorized for publishing</div>
          </CardContent>
        </Card>

        <Card className="border-rose-200 shadow-sm bg-rose-50/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-rose-800 text-xs font-semibold uppercase tracking-wider">
              <span>Revisions Requested</span>
              <XCircle className="h-4 w-4 text-rose-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-rose-900">{changesCount}</div>
            <div className="text-[11px] text-rose-700 mt-0.5">Agency updating deliverables</div>
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

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search proposals by title, campaign, or copy..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="all">All Approval States</option>
            <option value="pending_approval">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="changes_requested">Changes Requested</option>
          </select>
        </div>
      </div>

      {/* Approvals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredApprovals.map((item) => (
          <Card
            key={item.id}
            className="border-slate-200 shadow-sm bg-white hover:border-slate-300 transition-all flex flex-col justify-between overflow-hidden"
          >
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      {item.platform}
                    </span>
                    <span className="text-slate-400 text-xs">•</span>
                    <span className="text-xs font-semibold text-slate-500">{item.campaignName}</span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm mt-1.5">{item.title}</h3>
                </div>

                <Badge
                  variant={
                    item.status === 'approved'
                      ? 'success'
                      : item.status === 'pending_approval'
                      ? 'warning'
                      : 'danger'
                  }
                >
                  {item.status === 'pending_approval'
                    ? 'PENDING REVIEW'
                    : item.status === 'approved'
                    ? 'APPROVED'
                    : 'CHANGES REQUESTED'}
                </Badge>
              </div>

              {/* Visual Preview if present */}
              {item.previewUrl && (
                <div className="relative rounded-xl overflow-hidden border border-slate-100 bg-slate-50 aspect-video flex items-center justify-center">
                  <img
                    src={item.previewUrl}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Budget Comparison if budget change */}
              {item.budgetChange && (
                <div className="p-3.5 rounded-xl border border-brand-200 bg-brand-50/40 text-xs space-y-2">
                  <div className="flex items-center justify-between font-semibold text-slate-800">
                    <span>Proposed Spend Scaling:</span>
                    <span className="text-brand-700 font-bold">
                      ${item.budgetChange.currentBudget.toLocaleString()} → ${item.budgetChange.proposedBudget.toLocaleString()} / mo
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Effective Target Date: {item.budgetChange.effectiveDate}
                  </p>
                </div>
              )}

              {/* Ad Copy preview */}
              {item.headline && (
                <div className="p-3 rounded-lg border border-slate-100 bg-slate-50 text-xs space-y-1">
                  <p className="font-bold text-slate-900">&quot;{item.headline}&quot;</p>
                  {item.bodyText && <p className="text-slate-600 text-[11px]">{item.bodyText}</p>}
                </div>
              )}

              <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>

              {/* Audit trail feedback if already reviewed */}
              {item.clientComments && (
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/80 text-xs space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="font-semibold text-slate-700">Client Feedback ({item.reviewedBy}):</span>
                    <span>{item.reviewedAt ? new Date(item.reviewedAt).toLocaleDateString() : ''}</span>
                  </div>
                  <p className="text-slate-700 italic">&quot;{item.clientComments}&quot;</p>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span>Requested by {item.requestedBy}</span>
                <span>{new Date(item.requestedAt).toLocaleDateString()}</span>
              </div>
            </CardContent>

            {/* Action Bar */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              {item.status === 'pending_approval' ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedItem(item);
                      setReviewMode('request_changes');
                    }}
                    className="h-8 text-xs text-rose-700 hover:bg-rose-50 hover:border-rose-200"
                  >
                    Request Changes
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => handleApprove(item)}
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                    Approve Proposal
                  </Button>
                </>
              ) : (
                <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                  <History className="h-3.5 w-3.5" />
                  <span>Audit Sign-off Recorded</span>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Request Changes Modal */}
      {selectedItem && reviewMode === 'request_changes' && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-rose-50 text-rose-700">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Request Deliverable Changes</h3>
                  <p className="text-[11px] text-slate-400">Provide direct feedback to the agency creative team</p>
                </div>
              </div>
              <button onClick={() => setSelectedItem(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRequestChangesSubmit} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Proposal Title:</label>
                <p className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-800 font-medium">
                  {selectedItem.title}
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Required Modifications & Feedback:
                </label>
                <textarea
                  rows={4}
                  value={revisionComments}
                  onChange={(e) => setRevisionComments(e.target.value)}
                  placeholder="Specify desired copy changes, visual tweaks, targeting adjustments, or budget boundaries..."
                  required
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setSelectedItem(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting || !revisionComments.trim()}
                  className="bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  {isSubmitting ? 'Submitting...' : 'Submit Revision Request'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submit Approval Item Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-brand-50 text-brand-700">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Submit Item for Approval</h3>
                  <p className="text-[11px] text-slate-400">Request formal sign-off from the client</p>
                </div>
              </div>
              <button onClick={() => setIsNewModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateApproval} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Deliverable Title:</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Black Friday Reel Creative & Copy"
                  required
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Item Type:</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as ApprovalType)}
                    className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50"
                  >
                    <option value="creative_ad">Ad Visual / Graphic</option>
                    <option value="copywriting">Ad Copywriting</option>
                    <option value="budget_revision">Budget Revision</option>
                    <option value="landing_page">Landing Page</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Channel:</label>
                  <select
                    value={newPlatform}
                    onChange={(e) => setNewPlatform(e.target.value as any)}
                    className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50"
                  >
                    <option value="Meta Ads">Meta Ads</option>
                    <option value="Google Ads">Google Ads</option>
                    <option value="All Channels">All Channels</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Associated Campaign:</label>
                <input
                  type="text"
                  value={newCampaign}
                  onChange={(e) => setNewCampaign(e.target.value)}
                  placeholder="e.g. Q4 Holiday Scale 2026"
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Headline / Primary Copy:</label>
                <input
                  type="text"
                  value={newHeadline}
                  onChange={(e) => setNewHeadline(e.target.value)}
                  placeholder="Catchy headline or primary ad copy..."
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description & Context:</label>
                <textarea
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Provide background, targeting rationale, and goals..."
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsNewModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={!newTitle.trim()} className="bg-brand-600 hover:bg-brand-700 text-white">
                  Submit for Approval
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
