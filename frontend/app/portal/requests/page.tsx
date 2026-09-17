'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  portalListRequestsApi,
  portalCreateRequestApi,
  CustomerRequestItem,
} from '@/lib/api/portal';
import {
  FileText,
  PlusCircle,
  Search,
  Filter,
  Clock,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  UploadCloud,
  ChevronRight,
} from 'lucide-react';

export default function PortalRequestsPage() {
  const searchParams = useSearchParams();
  const [requests, setRequests] = useState<CustomerRequestItem[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // New Request Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('support');
  const [priority, setPriority] = useState('normal');
  const [attachments, setAttachments] = useState<
    Array<{ id: string; name: string; url: string; size: number; mimeType: string }>
  >([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setModalOpen(true);
    }
  }, [searchParams]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await portalListRequestsApi({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
      });
      setRequests(data.requests);
    } catch (err) {
      console.error('Failed to load requests', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [statusFilter, categoryFilter]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    if (attachments.length + e.target.files.length > 5) {
      setFormError('Maximum of 5 attachments allowed per request.');
      return;
    }

    const files = Array.from(e.target.files);
    const newItems = files.map((file) => {
      if (file.size > 10 * 1024 * 1024) {
        throw new Error(`File "${file.name}" exceeds 10MB limit.`);
      }
      return {
        id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        url: URL.createObjectURL(file), // Safe local blob preview
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
      };
    });

    setAttachments([...attachments, ...newItems]);
    setFormError(null);
  };

  const removeAttachment = (id: string) => {
    setAttachments(attachments.filter((a) => a.id !== id));
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const idempotencyKey = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await portalCreateRequestApi({
        subject: subject.trim(),
        description: description.trim(),
        category,
        priority,
        idempotencyKey,
        attachments,
      });

      setSubject('');
      setDescription('');
      setCategory('support');
      setPriority('normal');
      setAttachments([]);
      setModalOpen(false);
      await loadRequests();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to submit request.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.requestNumber.toLowerCase().includes(q) ||
      r.subject.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Service & Support Requests</h1>
          <p className="text-sm text-slate-400 mt-1">
            Submit new tickets, track existing inquiries, and collaborate with support staff
          </p>
        </div>
        <button
          id="open-new-request-modal-btn"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/30"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Request</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            id="requests-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by request number, title, or keywords..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            id="requests-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          >
            <option value="all">All Statuses</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under Review</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="closed">Closed</option>
          </select>

          <select
            id="requests-category-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          >
            <option value="all">All Categories</option>
            <option value="support">Support</option>
            <option value="billing">Billing</option>
            <option value="inquiry">Inquiry</option>
            <option value="service_request">Service Request</option>
            <option value="profile_change">Profile Change</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="py-24 text-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
          <p className="text-sm">Loading your requests...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="p-12 rounded-2xl bg-slate-900/40 border border-slate-800 text-center">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">No requests found</h3>
          <p className="text-xs text-slate-400 mt-1">
            {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'You have not submitted any service or support requests yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((req) => (
            <Link
              key={req._id}
              id={`request-item-${req.requestNumber}`}
              href={`/portal/requests/${req._id}`}
              className="block p-5 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/40 transition-all shadow-md group"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center space-x-3">
                    <span className="text-xs font-mono font-bold text-indigo-400">{req.requestNumber}</span>
                    <span className="text-[11px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {req.category.replace('_', ' ')}
                    </span>
                    {req.priority === 'urgent' && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        Urgent
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-white group-hover:text-indigo-400 transition-colors truncate">
                    {req.subject}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-2">{req.description}</p>
                </div>

                <div className="flex items-center sm:flex-col sm:items-end justify-between gap-3 flex-shrink-0">
                  <span
                    className={`text-xs font-semibold px-3 py-1 rounded-xl capitalize ${
                      req.status === 'completed'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : req.status === 'in_progress'
                        ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                        : req.status === 'under_review'
                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                        : req.status === 'closed'
                        ? 'bg-slate-800 text-slate-400 border border-slate-700'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {req.status.replace('_', ' ')}
                  </span>
                  <div className="flex items-center space-x-3 text-xs text-slate-500">
                    {req.attachments?.length > 0 && (
                      <span className="flex items-center space-x-1">
                        <Paperclip className="w-3.5 h-3.5" />
                        <span>{req.attachments.length}</span>
                      </span>
                    )}
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Modal: Create Customer Request */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-white">Create New Request</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Describe what you need help with. Our staff will respond to your ticket promptly.
                </p>
              </div>
              <button
                id="close-create-request-modal"
                onClick={() => setModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div
                id="create-request-error"
                className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center space-x-3"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateRequest} className="space-y-5">
              <div>
                <label htmlFor="request-subject-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Subject / Summary *
                </label>
                <input
                  id="request-subject-input"
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Question regarding onboarding invoice #104"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="request-category-select" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Category *
                  </label>
                  <select
                    id="request-category-select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  >
                    <option value="support">General Support</option>
                    <option value="billing">Billing & Invoicing</option>
                    <option value="inquiry">Account Inquiry</option>
                    <option value="service_request">Service Request</option>
                    <option value="profile_change">Profile Change</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="request-priority-select" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Priority
                  </label>
                  <select
                    id="request-priority-select"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="request-description-textarea" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Detailed Description *
                </label>
                <textarea
                  id="request-description-textarea"
                  required
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide complete details about your request or issue..."
                  className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm resize-none"
                />
              </div>

              {/* Attachments (Max 5 files, 10MB limit) */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Attachments (Max 5 files, up to 10MB each)
                </label>
                <div className="border-2 border-dashed border-slate-700 hover:border-slate-600 rounded-2xl p-4 text-center cursor-pointer relative bg-slate-800/30">
                  <input
                    id="request-file-upload-input"
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-1" />
                  <p className="text-xs text-slate-300 font-medium">Click to upload documents or screenshots</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">PDF, DOCX, PNG, JPG, CSV (Executables & SVG prohibited)</p>
                </div>

                {attachments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {attachments.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs"
                      >
                        <div className="flex items-center space-x-2 truncate">
                          <Paperclip className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <span className="text-slate-200 truncate">{file.name}</span>
                          <span className="text-slate-500 flex-shrink-0">({(file.size / 1024).toFixed(1)} KB)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAttachment(file.id)}
                          className="p-1 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  id="submit-request-form-btn"
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/25 flex items-center space-x-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Submit Request</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
