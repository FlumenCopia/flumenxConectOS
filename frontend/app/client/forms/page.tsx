'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  FileText,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Archive,
  Copy,
  ExternalLink,
  Code2,
  Settings,
  Eye,
  Trash2,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Layers,
  MessageSquare,
  UserCheck,
  Filter,
  Check,
  Share2,
  X,
} from 'lucide-react';
import {
  WebsiteFormItem,
  WebsiteFormFieldItem,
  FormSubmissionItem,
  EmbedConfig,
  FormStatus,
  FieldType,
  LeadFieldMapping,
  ContactFieldMapping,
  getFormsApi,
  getFormByIdApi,
  createFormApi,
  updateFormApi,
  duplicateFormApi,
  updateFormStatusApi,
  archiveFormApi,
  getEmbedConfigApi,
  getSubmissionsApi,
  getSubmissionByIdApi,
  reprocessSubmissionApi,
} from '@/lib/forms';

export default function ClientFormsPage() {
  // Main Data States
  const [forms, setForms] = useState<WebsiteFormItem[]>([]);
  const [counts, setCounts] = useState({ total: 0, published: 0, draft: 0, paused: 0, archived: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FormStatus | 'all'>('all');

  // Modals & Drawers
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<Partial<WebsiteFormItem> | null>(null);
  const [editingFields, setEditingFields] = useState<Partial<WebsiteFormFieldItem>[]>([]);
  const [activeTab, setActiveTab] = useState<'settings' | 'fields' | 'mapping'>('fields');
  const [isSaving, setIsSaving] = useState(false);

  // Preview Modal
  const [previewForm, setPreviewForm] = useState<WebsiteFormItem | null>(null);

  // Embed Modal
  const [embedConfig, setEmbedConfig] = useState<EmbedConfig | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedIframe, setCopiedIframe] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Submissions Drawer
  const [submissionsForm, setSubmissionsForm] = useState<WebsiteFormItem | null>(null);
  const [submissions, setSubmissions] = useState<FormSubmissionItem[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmissionItem | null>(null);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);

  // Load forms
  const fetchForms = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getFormsApi({
        status: statusFilter,
        search: search.trim() || undefined,
      });
      if (res.data) {
        setForms(res.data.forms);
        setCounts(res.data.counts);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load website forms');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  // Open Form Creator
  const handleOpenCreate = () => {
    setEditingForm({
      name: '',
      description: '',
      submitButtonLabel: 'Submit Form',
      successMessage: 'Thank you! Your submission has been received.',
      redirectUrl: '',
      allowedDomains: [],
      honeypotField: '_hp_website',
      status: 'draft',
    });
    setEditingFields([
      {
        fieldKey: 'full_name',
        label: 'Full Name',
        type: 'text',
        placeholder: 'Jane Doe',
        required: true,
        order: 0,
        leadMapping: 'fullName',
        contactMapping: 'name',
      },
      {
        fieldKey: 'email',
        label: 'Business Email',
        type: 'email',
        placeholder: 'jane@company.com',
        required: true,
        order: 1,
        leadMapping: 'email',
        contactMapping: 'email',
      },
      {
        fieldKey: 'phone',
        label: 'Phone Number',
        type: 'phone',
        placeholder: '+1 (555) 000-0000',
        required: false,
        order: 2,
        leadMapping: 'phone',
        contactMapping: 'phone',
      },
      {
        fieldKey: 'company',
        label: 'Company Name',
        type: 'text',
        placeholder: 'Acme Inc.',
        required: false,
        order: 3,
        leadMapping: 'companyName',
        contactMapping: 'none',
      },
      {
        fieldKey: 'message',
        label: 'Project Details',
        type: 'textarea',
        placeholder: 'Tell us about your digital marketing goals...',
        required: false,
        order: 4,
        leadMapping: 'notes',
        contactMapping: 'none',
      },
    ]);
    setActiveTab('fields');
    setIsEditorOpen(true);
  };

  // Open Form Editor
  const handleOpenEdit = async (formId: string) => {
    try {
      setLoading(true);
      const res = await getFormByIdApi(formId);
      if (res.data) {
        setEditingForm(res.data);
        setEditingFields(res.data.fields || []);
        setActiveTab('fields');
        setIsEditorOpen(true);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to fetch form details');
    } finally {
      setLoading(false);
    }
  };

  // Save Form
  const handleSaveForm = async () => {
    if (!editingForm?.name?.trim()) {
      alert('Form name is required');
      return;
    }

    try {
      setIsSaving(true);
      const payload = {
        ...editingForm,
        fields: editingFields,
      };

      if (editingForm._id) {
        await updateFormApi(editingForm._id, payload);
      } else {
        await createFormApi(payload);
      }

      setIsEditorOpen(false);
      setEditingForm(null);
      fetchForms();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save form');
    } finally {
      setIsSaving(false);
    }
  };

  // Duplicate Form
  const handleDuplicate = async (formId: string) => {
    try {
      await duplicateFormApi(formId);
      fetchForms();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to duplicate form');
    }
  };

  // Update Form Status
  const handleStatusChange = async (formId: string, status: FormStatus) => {
    try {
      await updateFormStatusApi(formId, status);
      fetchForms();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update form status');
    }
  };

  // Archive Form
  const handleArchive = async (formId: string) => {
    if (!confirm('Are you sure you want to archive this form? Submissions will no longer be accepted.')) return;
    try {
      await archiveFormApi(formId);
      fetchForms();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to archive form');
    }
  };

  // Open Embed Code Modal
  const handleOpenEmbed = async (formId: string) => {
    try {
      const res = await getEmbedConfigApi(formId);
      if (res.data) {
        setEmbedConfig(res.data);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to get embed code');
    }
  };

  // Open Submissions View
  const handleOpenSubmissions = async (form: WebsiteFormItem) => {
    setSubmissionsForm(form);
    setSelectedSubmission(null);
    try {
      setSubmissionsLoading(true);
      const res = await getSubmissionsApi({ formId: form._id });
      if (res.data) {
        setSubmissions(res.data.submissions);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to fetch form submissions');
    } finally {
      setSubmissionsLoading(false);
    }
  };

  // View Single Submission Details with Events
  const handleSelectSubmission = async (submissionId: string) => {
    try {
      const res = await getSubmissionByIdApi(submissionId);
      if (res.data) {
        setSelectedSubmission(res.data);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to fetch submission details');
    }
  };

  // Reprocess Submission
  const handleReprocessSubmission = async (submissionId: string) => {
    try {
      setReprocessingId(submissionId);
      const res = await reprocessSubmissionApi(submissionId);
      if (res.data) {
        setSelectedSubmission(res.data);
        if (submissionsForm) {
          const listRes = await getSubmissionsApi({ formId: submissionsForm._id });
          if (listRes.data) setSubmissions(listRes.data.submissions);
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to reprocess submission');
    } finally {
      setReprocessingId(null);
    }
  };

  // Field Manipulation inside Editor
  const handleAddField = () => {
    const newFieldKey = `field_${Date.now().toString().slice(-4)}`;
    setEditingFields([
      ...editingFields,
      {
        fieldKey: newFieldKey,
        label: 'New Field',
        type: 'text',
        placeholder: '',
        required: false,
        order: editingFields.length,
        leadMapping: 'none',
        contactMapping: 'none',
      },
    ]);
  };

  const handleUpdateField = (index: number, updates: Partial<WebsiteFormFieldItem>) => {
    const updated = [...editingFields];
    updated[index] = { ...updated[index], ...updates };
    setEditingFields(updated);
  };

  const handleDeleteField = (index: number) => {
    const updated = editingFields.filter((_, i) => i !== index);
    setEditingFields(updated.map((f, i) => ({ ...f, order: i })));
  };

  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === editingFields.length - 1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...editingFields];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setEditingFields(updated.map((f, i) => ({ ...f, order: i })));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Website Lead Intake Forms
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
              Release 6
            </span>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Build responsive intake widgets, configure custom CRM field mappings, embed on external sites, and automate Unified Inbox routing.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchForms}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow transition"
          >
            <Plus className="w-4 h-4" />
            Create Form
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Total Forms</span>
            <FileText className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{counts.total}</div>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Active Published</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{counts.published}</div>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Draft Forms</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{counts.draft}</div>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Total Ingested Leads</span>
            <UserCheck className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {forms.reduce((acc, f) => acc + (f.submissionsCount || 0), 0)}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search forms by title, description or public key..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-zinc-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses ({counts.total})</option>
            <option value="published">Published ({counts.published})</option>
            <option value="draft">Drafts ({counts.draft})</option>
            <option value="paused">Paused ({counts.paused})</option>
            <option value="archived">Archived ({counts.archived})</option>
          </select>
        </div>
      </div>

      {/* Forms Listing */}
      {loading && forms.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mb-3" />
          <p className="text-sm text-zinc-500">Loading website forms...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl text-red-700 dark:text-red-300">
          <div className="flex items-center gap-2 font-semibold mb-1">
            <AlertCircle className="w-5 h-5" />
            Failed to load forms
          </div>
          <p className="text-sm">{error}</p>
          <button
            onClick={fetchForms}
            className="mt-3 px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700 transition"
          >
            Retry
          </button>
        </div>
      ) : forms.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 text-center">
          <FileText className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mb-3" />
          <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">No forms found</h3>
          <p className="text-sm text-zinc-500 max-w-md mt-1 mb-4">
            {search
              ? 'No forms match your search query. Try broadening your filter.'
              : 'Create your first lead capture form to embed on your website, landing pages, or digital campaigns.'}
          </p>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow transition"
          >
            <Plus className="w-4 h-4" />
            Create First Form
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {forms.map((form) => {
            const statusColors: Record<FormStatus, { bg: string; text: string }> = {
              published: { bg: 'bg-emerald-100 dark:bg-emerald-950/50', text: 'text-emerald-800 dark:text-emerald-300' },
              draft: { bg: 'bg-amber-100 dark:bg-amber-950/50', text: 'text-amber-800 dark:text-amber-300' },
              paused: { bg: 'bg-orange-100 dark:bg-orange-950/50', text: 'text-orange-800 dark:text-orange-300' },
              archived: { bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-700 dark:text-zinc-400' },
            };

            return (
              <div
                key={form._id}
                className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow transition flex flex-col justify-between overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 line-clamp-1">
                      {form.name}
                    </h2>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold capitalize ${
                        statusColors[form.status]?.bg
                      } ${statusColors[form.status]?.text}`}
                    >
                      {form.status}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 min-h-[32px] mb-4">
                    {form.description || 'No description provided.'}
                  </p>

                  <div className="grid grid-cols-2 gap-2 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg text-xs mb-4">
                    <div>
                      <span className="text-zinc-400 block">Submissions</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm">
                        {form.submissionsCount || 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block">Fields</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm">
                        {form.fieldsCount || 0} fields
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                      {form.publicKey}
                    </span>
                    <span>{new Date(form.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="border-t border-zinc-100 dark:border-zinc-800 p-3 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between gap-1 text-xs">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(form._id)}
                      className="p-1.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition"
                      title="Edit Form & Fields"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    <button
                      onClick={async () => {
                        const res = await getFormByIdApi(form._id);
                        if (res.data) setPreviewForm(res.data);
                      }}
                      className="p-1.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition"
                      title="Preview Form"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenEmbed(form._id)}
                      className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition"
                      title="Get Embed Code"
                    >
                      <Code2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenSubmissions(form)}
                      className="p-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded transition"
                      title="View Submissions & Event Timeline"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDuplicate(form._id)}
                      className="p-1.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition"
                      title="Duplicate Form"
                    >
                      <Layers className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    {form.status === 'published' ? (
                      <button
                        onClick={() => handleStatusChange(form._id, 'paused')}
                        className="px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/40 rounded transition"
                      >
                        Pause
                      </button>
                    ) : form.status === 'draft' || form.status === 'paused' ? (
                      <button
                        onClick={() => handleStatusChange(form._id, 'published')}
                        className="px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 rounded transition"
                      >
                        Publish
                      </button>
                    ) : null}

                    {form.status !== 'archived' && (
                      <button
                        onClick={() => handleArchive(form._id)}
                        className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition"
                        title="Archive Form"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================= */}
      {/* FORM BUILDER & FIELD EDITOR MODAL */}
      {/* ============================================================= */}
      {isEditorOpen && editingForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  {editingForm._id ? `Edit Form: ${editingForm.name}` : 'Create Website Intake Form'}
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Configure form parameters, field layout, and CRM Lead & Contact mappings.
                </p>
              </div>
              <button
                onClick={() => setIsEditorOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tab Controls */}
            <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-5 bg-zinc-50/50 dark:bg-zinc-800/30">
              <button
                onClick={() => setActiveTab('fields')}
                className={`py-3 px-4 text-sm font-medium border-b-2 transition ${
                  activeTab === 'fields'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                Field Builder ({editingFields.length})
              </button>
              <button
                onClick={() => setActiveTab('mapping')}
                className={`py-3 px-4 text-sm font-medium border-b-2 transition ${
                  activeTab === 'mapping'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                CRM Field Mapping
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`py-3 px-4 text-sm font-medium border-b-2 transition ${
                  activeTab === 'settings'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                Form Settings & Anti-Spam
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* TAB 1: FIELD BUILDER */}
              {activeTab === 'fields' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Form Fields</h4>
                      <p className="text-xs text-zinc-500">
                        Add, reorder, and configure the fields shown to visitors.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddField}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Field
                    </button>
                  </div>

                  {editingFields.map((field, index) => (
                    <div
                      key={index}
                      className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700/80 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-700 dark:text-zinc-300">
                            {index + 1}
                          </span>
                          <input
                            type="text"
                            value={field.label || ''}
                            onChange={(e) => handleUpdateField(index, { label: e.target.value })}
                            placeholder="Field Label (e.g. Work Email)"
                            className="font-medium text-sm px-2.5 py-1 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 flex-1"
                          />
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleMoveField(index, 'up')}
                            disabled={index === 0}
                            className="p-1 text-zinc-400 hover:text-zinc-600 disabled:opacity-30 rounded"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveField(index, 'down')}
                            disabled={index === editingFields.length - 1}
                            className="p-1 text-zinc-400 hover:text-zinc-600 disabled:opacity-30 rounded"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteField(index)}
                            className="p-1 text-red-500 hover:text-red-700 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label className="block text-zinc-500 dark:text-zinc-400 mb-1">Field Key (API / ID)</label>
                          <input
                            type="text"
                            value={field.fieldKey || ''}
                            onChange={(e) => handleUpdateField(index, { fieldKey: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-zinc-500 dark:text-zinc-400 mb-1">Field Type</label>
                          <select
                            value={field.type || 'text'}
                            onChange={(e) => handleUpdateField(index, { type: e.target.value as FieldType })}
                            className="w-full px-2.5 py-1.5 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                          >
                            <option value="text">Text (Single Line)</option>
                            <option value="email">Email Address</option>
                            <option value="phone">Phone Number</option>
                            <option value="textarea">Textarea (Multi-line)</option>
                            <option value="number">Number</option>
                            <option value="select">Dropdown Select</option>
                            <option value="radio">Radio Buttons</option>
                            <option value="checkbox">Checkbox</option>
                            <option value="date">Date Picker</option>
                            <option value="hidden">Hidden Value</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-zinc-500 dark:text-zinc-400 mb-1">Placeholder Text</label>
                          <input
                            type="text"
                            value={field.placeholder || ''}
                            onChange={(e) => handleUpdateField(index, { placeholder: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-6 pt-1 text-xs">
                        <label className="flex items-center gap-2 cursor-pointer text-zinc-700 dark:text-zinc-300">
                          <input
                            type="checkbox"
                            checked={field.required === true}
                            onChange={(e) => handleUpdateField(index, { required: e.target.checked })}
                            className="rounded text-blue-600"
                          />
                          Required Field
                        </label>
                      </div>

                      {/* Options for Select/Radio */}
                      {(field.type === 'select' || field.type === 'radio') && (
                        <div className="p-2.5 bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-700 text-xs space-y-2">
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                            Dropdown / Radio Options
                          </span>
                          <div className="space-y-1.5">
                            {(field.options || []).map((opt, optIdx) => (
                              <div key={optIdx} className="flex items-center gap-2">
                                <input
                                  type="text"
                                  placeholder="Option Label"
                                  value={opt.label}
                                  onChange={(e) => {
                                    const opts = [...(field.options || [])];
                                    opts[optIdx] = { ...opts[optIdx], label: e.target.value };
                                    handleUpdateField(index, { options: opts });
                                  }}
                                  className="flex-1 px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs"
                                />
                                <input
                                  type="text"
                                  placeholder="Value"
                                  value={opt.value}
                                  onChange={(e) => {
                                    const opts = [...(field.options || [])];
                                    opts[optIdx] = { ...opts[optIdx], value: e.target.value };
                                    handleUpdateField(index, { options: opts });
                                  }}
                                  className="w-32 px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-mono"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const opts = (field.options || []).filter((_, i) => i !== optIdx);
                                    handleUpdateField(index, { options: opts });
                                  }}
                                  className="p-1 text-red-500 hover:text-red-700"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                const opts = [...(field.options || []), { label: `Option ${(field.options || []).length + 1}`, value: `opt_${Date.now().toString().slice(-3)}` }];
                                handleUpdateField(index, { options: opts });
                              }}
                              className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 mt-1"
                            >
                              <Plus className="w-3 h-3" /> Add Choice
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 2: CRM FIELD MAPPINGS */}
              {activeTab === 'mapping' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">CRM Schema Mapping</h4>
                    <p className="text-xs text-zinc-500">
                      Configure how each form response maps to CRM Leads and Contacts in your workspace.
                    </p>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                        <tr>
                          <th className="p-3">Form Field</th>
                          <th className="p-3">Lead Entity Mapping</th>
                          <th className="p-3">Contact Entity Mapping</th>
                          <th className="p-3">Custom Field Key</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {editingFields.map((field, index) => (
                          <tr key={index} className="bg-white dark:bg-zinc-900 hover:bg-zinc-50/50">
                            <td className="p-3 font-medium text-zinc-900 dark:text-zinc-100">
                              <div>{field.label}</div>
                              <span className="font-mono text-[10px] text-zinc-400">{field.fieldKey}</span>
                            </td>
                            <td className="p-3">
                              <select
                                value={field.leadMapping || 'none'}
                                onChange={(e) =>
                                  handleUpdateField(index, { leadMapping: e.target.value as LeadFieldMapping })
                                }
                                className="w-full px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
                              >
                                <option value="none">-- Do Not Map --</option>
                                <option value="fullName">Lead: Full Name</option>
                                <option value="firstName">Lead: First Name</option>
                                <option value="lastName">Lead: Last Name</option>
                                <option value="email">Lead: Email</option>
                                <option value="phone">Lead: Phone</option>
                                <option value="companyName">Lead: Company Name</option>
                                <option value="jobTitle">Lead: Job Title</option>
                                <option value="website">Lead: Website</option>
                                <option value="estimatedValue">Lead: Estimated Value</option>
                                <option value="notes">Lead: Notes / Project Info</option>
                                <option value="customField">Lead: Custom Attribute Map</option>
                              </select>
                            </td>
                            <td className="p-3">
                              <select
                                value={field.contactMapping || 'none'}
                                onChange={(e) =>
                                  handleUpdateField(index, { contactMapping: e.target.value as ContactFieldMapping })
                                }
                                className="w-full px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
                              >
                                <option value="none">-- Do Not Map --</option>
                                <option value="name">Contact: Name</option>
                                <option value="email">Contact: Email</option>
                                <option value="phone">Contact: Phone</option>
                              </select>
                            </td>
                            <td className="p-3">
                              {field.leadMapping === 'customField' ? (
                                <input
                                  type="text"
                                  placeholder="e.g. industry_vertical"
                                  value={field.customFieldKey || ''}
                                  onChange={(e) => handleUpdateField(index, { customFieldKey: e.target.value })}
                                  className="w-full px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono"
                                />
                              ) : (
                                <span className="text-zinc-400 italic">N/A</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: SETTINGS & ANTI-SPAM */}
              {activeTab === 'settings' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Form Name *
                      </label>
                      <input
                        type="text"
                        value={editingForm.name || ''}
                        onChange={(e) => setEditingForm({ ...editingForm, name: e.target.value })}
                        placeholder="e.g. Main Landing Page Contact Form"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Submit Button Label
                      </label>
                      <input
                        type="text"
                        value={editingForm.submitButtonLabel || 'Submit'}
                        onChange={(e) => setEditingForm({ ...editingForm, submitButtonLabel: e.target.value })}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Description
                    </label>
                    <textarea
                      rows={2}
                      value={editingForm.description || ''}
                      onChange={(e) => setEditingForm({ ...editingForm, description: e.target.value })}
                      placeholder="Brief note on what this form is used for..."
                      className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Success Message
                      </label>
                      <input
                        type="text"
                        value={editingForm.successMessage || ''}
                        onChange={(e) => setEditingForm({ ...editingForm, successMessage: e.target.value })}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Redirect URL (Optional)
                      </label>
                      <input
                        type="url"
                        placeholder="https://example.com/thank-you"
                        value={editingForm.redirectUrl || ''}
                        onChange={(e) => setEditingForm({ ...editingForm, redirectUrl: e.target.value })}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                  </div>

                  {/* Anti-Spam Protections */}
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-3">
                    <h5 className="text-xs font-bold text-zinc-900 dark:text-zinc-50 uppercase tracking-wider">
                      Anti-Spam & Abuse Protection
                    </h5>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-zinc-500 mb-1">Honeypot Hidden Field</label>
                        <input
                          type="text"
                          value={editingForm.honeypotField || '_hp_website'}
                          onChange={(e) => setEditingForm({ ...editingForm, honeypotField: e.target.value })}
                          className="w-full px-2.5 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono text-xs"
                        />
                        <span className="text-[10px] text-zinc-400 mt-0.5 block">
                          Invisible to human visitors; automated bot submissions get rejected.
                        </span>
                      </div>

                      <div>
                        <label className="block text-zinc-500 mb-1">Allowed Domains (CORS whitelist)</label>
                        <input
                          type="text"
                          placeholder="clientwebsite.com, landing.client.com"
                          value={(editingForm.allowedDomains || []).join(', ')}
                          onChange={(e) =>
                            setEditingForm({
                              ...editingForm,
                              allowedDomains: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                            })
                          }
                          className="w-full px-2.5 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
                        />
                        <span className="text-[10px] text-zinc-400 mt-0.5 block">
                          Leave empty to accept from all authorized domains.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveForm}
                disabled={isSaving}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow transition disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving && <RefreshCw className="w-4 h-4 animate-spin" />}
                {editingForm._id ? 'Update Form' : 'Create & Save Form'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* LIVE FORM PREVIEW MODAL */}
      {/* ============================================================= */}
      {previewForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Interactive Form Preview</h3>
              </div>
              <button onClick={() => setPreviewForm(null)} className="p-1 text-zinc-400 hover:text-zinc-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <h4 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{previewForm.name}</h4>
                {previewForm.description && (
                  <p className="text-xs text-zinc-500 mt-1">{previewForm.description}</p>
                )}
              </div>

              <div className="space-y-3 pt-2">
                {(previewForm.fields || []).map((field) => (
                  <div key={field._id || field.fieldKey}>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </label>

                    {field.type === 'textarea' ? (
                      <textarea
                        rows={3}
                        placeholder={field.placeholder}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                      />
                    ) : field.type === 'select' ? (
                      <select className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800">
                        <option value="">-- Select an option --</option>
                        {(field.options || []).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type || 'text'}
                        placeholder={field.placeholder}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                      />
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => alert(`Preview submit verified: "${previewForm.successMessage}"`)}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow transition mt-4"
                >
                  {previewForm.submitButtonLabel || 'Submit Form'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* EMBED CODE MODAL */}
      {/* ============================================================= */}
      {embedConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 w-full max-w-2xl overflow-hidden">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="w-5 h-5 text-blue-500" />
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                  Embed Form: {embedConfig.formName}
                </h3>
              </div>
              <button onClick={() => setEmbedConfig(null)} className="p-1 text-zinc-400 hover:text-zinc-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Standalone Link */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">Public Direct Form URL</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(embedConfig.standaloneUrl);
                      setCopiedUrl(true);
                      setTimeout(() => setCopiedUrl(false), 2000);
                    }}
                    className="text-blue-600 hover:underline flex items-center gap-1"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedUrl ? 'Copied' : 'Copy URL'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={embedConfig.standaloneUrl}
                    className="w-full px-2.5 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-mono text-xs"
                  />
                  <a
                    href={embedConfig.standaloneUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-zinc-500 hover:text-zinc-800 border rounded"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Responsive Iframe Snippet */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                    Responsive iFrame Embed (Recommended)
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(embedConfig.iframeSnippet);
                      setCopiedIframe(true);
                      setTimeout(() => setCopiedIframe(false), 2000);
                    }}
                    className="text-blue-600 hover:underline flex items-center gap-1"
                  >
                    {copiedIframe ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedIframe ? 'Copied' : 'Copy iFrame Code'}
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={3}
                  value={embedConfig.iframeSnippet}
                  className="w-full p-2.5 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-mono text-xs"
                />
              </div>

              {/* JavaScript Embed Snippet */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                    JavaScript Embed Snippet
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(embedConfig.scriptSnippet);
                      setCopiedScript(true);
                      setTimeout(() => setCopiedScript(false), 2000);
                    }}
                    className="text-blue-600 hover:underline flex items-center gap-1"
                  >
                    {copiedScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedScript ? 'Copied' : 'Copy Script Code'}
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={3}
                  value={embedConfig.scriptSnippet}
                  className="w-full p-2.5 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-mono text-xs"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* SUBMISSIONS HISTORY & TIMELINE DRAWER */}
      {/* ============================================================= */}
      {submissionsForm && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 h-full shadow-2xl flex flex-col border-l border-zinc-200 dark:border-zinc-800">
            {/* Drawer Header */}
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                  Submissions: {submissionsForm.name}
                </h3>
                <p className="text-xs text-zinc-500">
                  Real-time lead intake logs, CRM mappings, and delivery events.
                </p>
              </div>
              <button
                onClick={() => {
                  setSubmissionsForm(null);
                  setSelectedSubmission(null);
                }}
                className="p-1 text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {submissionsLoading ? (
                <div className="flex items-center justify-center p-12">
                  <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
                </div>
              ) : submissions.length === 0 ? (
                <div className="text-center p-8 text-zinc-500 text-sm">
                  No submissions recorded for this form yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {submissions.map((sub) => {
                    const isSelected = selectedSubmission?._id === sub._id;
                    const statusBg =
                      sub.processingStatus === 'processed'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : sub.processingStatus === 'rejected'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300';

                    return (
                      <div
                        key={sub._id}
                        onClick={() => handleSelectSubmission(sub._id)}
                        className={`p-3 rounded-xl border cursor-pointer transition ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-950/20'
                            : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50/50'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-mono text-zinc-400">{sub.submissionId}</span>
                          <span className={`px-2 py-0.5 rounded font-semibold capitalize ${statusBg}`}>
                            {sub.processingStatus}
                          </span>
                        </div>

                        <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 line-clamp-1">
                          {sub.payload?.full_name || sub.payload?.name || sub.payload?.email || 'Anonymous Visitor'}
                        </div>

                        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 flex items-center justify-between">
                          <span>{sub.payload?.email || 'No email provided'}</span>
                          <span>{new Date(sub.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Selected Submission Inspector */}
              {selectedSubmission && (
                <div className="mt-6 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                      Submission Inspector: {selectedSubmission.submissionId}
                    </h4>
                    {selectedSubmission.processingStatus !== 'processed' && (
                      <button
                        onClick={() => handleReprocessSubmission(selectedSubmission._id)}
                        disabled={reprocessingId === selectedSubmission._id}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${reprocessingId === selectedSubmission._id ? 'animate-spin' : ''}`} />
                        Reprocess
                      </button>
                    )}
                  </div>

                  {/* CRM Entity Quick-Jump Badges */}
                  <div className="flex flex-wrap gap-2 text-xs">
                    {selectedSubmission.leadId && (
                      <Link
                        href="/client/leads"
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 rounded-lg hover:underline"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        View CRM Lead
                      </Link>
                    )}
                    {selectedSubmission.conversationId && (
                      <Link
                        href="/client/inbox"
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 rounded-lg hover:underline"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        View Inbox Conversation
                      </Link>
                    )}
                  </div>

                  {/* Raw Submitted Values */}
                  <div>
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Submitted Values
                    </span>
                    <div className="p-3 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700/80 text-xs font-mono space-y-1">
                      {Object.entries(selectedSubmission.payload || {}).map(([k, v]) => (
                        <div key={k} className="flex justify-between">
                          <span className="text-zinc-400">{k}:</span>
                          <span className="text-zinc-800 dark:text-zinc-200 font-sans font-medium">
                            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Event Timeline */}
                  {selectedSubmission.events && selectedSubmission.events.length > 0 && (
                    <div>
                      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-2">
                        Processing Event Trail
                      </span>
                      <div className="space-y-2 border-l-2 border-blue-500 pl-3 text-xs">
                        {selectedSubmission.events.map((ev) => (
                          <div key={ev._id}>
                            <span className="font-semibold text-zinc-800 dark:text-zinc-200 capitalize">
                              {ev.eventType.replace(/_/g, ' ')}
                            </span>
                            <p className="text-zinc-500 dark:text-zinc-400 text-[11px]">{ev.description}</p>
                            <span className="text-[10px] text-zinc-400">
                              {new Date(ev.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
