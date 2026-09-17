'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Workflow,
  Plus,
  Play,
  Pause,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  Zap,
  ArrowRight,
  Shield,
  Layers,
  ChevronRight,
  Check,
  Eye,
  Sliders,
  X,
  FileText,
  Mail,
  Bell,
  CheckSquare,
  Tag,
  Loader2,
  Sparkles,
} from 'lucide-react';
import {
  WorkflowItem,
  WorkflowRunItem,
  listWorkflowsApi,
  createWorkflowApi,
  updateWorkflowApi,
  updateWorkflowStatusApi,
  deleteWorkflowApi,
  testWorkflowConditionsApi,
  executeManualWorkflowApi,
  listWorkflowRunsApi,
} from '@/lib/api/workflows';
import { useAuth } from '@/hooks/useAuth';

export default function ClientWorkflowsPage() {
  const { user, activeClient } = useAuth();
  const clientId = activeClient?.clientId;

  // Active Tab
  const [activeTab, setActiveTab] = useState<'workflows' | 'runs'>('workflows');

  // Workflows state
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [workflowsLoading, setWorkflowsLoading] = useState(true);
  const [workflowsTotal, setWorkflowsTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Runs state
  const [runs, setRuns] = useState<WorkflowRunItem[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsTotal, setRunsTotal] = useState(0);
  const [selectedRun, setSelectedRun] = useState<WorkflowRunItem | null>(null);

  // Modals & Drawers
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowItem | null>(null);
  const [builderStep, setBuilderStep] = useState<number>(1);

  // Builder Form State
  const [formData, setFormData] = useState<any>({
    name: '',
    description: '',
    status: 'draft',
    trigger: { eventType: 'lead.created', filters: {} },
    conditions: [],
    actions: [{ id: 'act_1', type: 'create_task', payload: { title: 'Follow up with lead', priority: 'high', dueInHours: 24 }, order: 0 }],
    executionMode: 'immediate',
    maxExecutionsPerHour: 100,
  });

  // Test & Manual Execution State
  const [testModalWorkflow, setTestModalWorkflow] = useState<WorkflowItem | null>(null);
  const [testPayloadText, setTestPayloadText] = useState('{\n  "lead": {\n    "leadScore": 65,\n    "source": "website",\n    "stage": "new"\n  }\n}');
  const [testResult, setTestResult] = useState<any>(null);
  const [executingTest, setExecutingTest] = useState(false);

  // Operation error & feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Permissions
  const canCreate = user?.isSuperAdmin || activeClient?.roleSlug === 'client_admin' || activeClient?.permissions?.includes('workflows.create');
  const canEdit = user?.isSuperAdmin || activeClient?.roleSlug === 'client_admin' || activeClient?.permissions?.includes('workflows.edit');
  const canEnable = user?.isSuperAdmin || activeClient?.roleSlug === 'client_admin' || activeClient?.permissions?.includes('workflows.enable');
  const canExecute = user?.isSuperAdmin || activeClient?.roleSlug === 'client_admin' || activeClient?.permissions?.includes('workflows.execute');
  const canDelete = user?.isSuperAdmin || activeClient?.roleSlug === 'client_admin' || activeClient?.permissions?.includes('workflows.delete');

  const fetchWorkflows = useCallback(async () => {
    setWorkflowsLoading(true);
    setErrorMsg(null);
    try {
      const res = await listWorkflowsApi({
        status: statusFilter || undefined,
        search: searchQuery || undefined,
        clientId,
      });
      setWorkflows(res.data || []);
      setWorkflowsTotal(res.pagination?.total || 0);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to load workflows');
    } finally {
      setWorkflowsLoading(false);
    }
  }, [clientId, statusFilter, searchQuery]);

  const fetchRuns = useCallback(async () => {
    setRunsLoading(true);
    try {
      const res = await listWorkflowRunsApi({ clientId, limit: 30 });
      setRuns(res.data || []);
      setRunsTotal(res.pagination?.total || 0);
    } catch {
      // Non-fatal
    } finally {
      setRunsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  useEffect(() => {
    if (activeTab === 'runs') {
      fetchRuns();
    }
  }, [activeTab, fetchRuns]);

  // Status Toggle
  const handleToggleStatus = async (wf: WorkflowItem) => {
    const nextStatus = wf.status === 'active' ? 'paused' : 'active';
    setActionLoadingId(wf._id);
    try {
      await updateWorkflowStatusApi(wf._id, nextStatus, clientId);
      setWorkflows((prev) =>
        prev.map((item) => (item._id === wf._id ? { ...item, status: nextStatus } : item))
      );
      setSuccessMsg(`Workflow "${wf.name}" is now ${nextStatus}`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to update status');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete
  const handleDelete = async (wf: WorkflowItem) => {
    if (!confirm(`Are you sure you want to delete workflow "${wf.name}"?`)) return;
    setActionLoadingId(wf._id);
    try {
      await deleteWorkflowApi(wf._id, clientId);
      setWorkflows((prev) => prev.filter((item) => item._id !== wf._id));
      setSuccessMsg(`Workflow "${wf.name}" deleted`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to delete workflow');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Open Builder for Create
  const handleOpenCreate = () => {
    setEditingWorkflow(null);
    setFormData({
      name: '',
      description: '',
      status: 'draft',
      trigger: { eventType: 'lead.created', filters: {} },
      conditions: [],
      actions: [
        {
          id: 'act_1',
          type: 'create_task',
          payload: { title: 'Follow up with {{lead.fullName}}', priority: 'high', dueInHours: 24 },
          order: 0,
        },
      ],
      executionMode: 'immediate',
      maxExecutionsPerHour: 100,
    });
    setBuilderStep(1);
    setIsBuilderOpen(true);
  };

  // Open Builder for Edit
  const handleOpenEdit = (wf: WorkflowItem) => {
    setEditingWorkflow(wf);
    setFormData({
      name: wf.name,
      description: wf.description || '',
      status: wf.status,
      trigger: wf.trigger,
      conditions: wf.conditions || [],
      actions: wf.actions || [],
      executionMode: wf.executionMode || 'immediate',
      maxExecutionsPerHour: wf.maxExecutionsPerHour || 100,
    });
    setBuilderStep(1);
    setIsBuilderOpen(true);
  };

  // Save Builder
  const handleSaveWorkflow = async () => {
    if (!formData.name.trim()) {
      alert('Please enter a workflow name');
      return;
    }
    if (!formData.actions || formData.actions.length === 0) {
      alert('Please configure at least one action');
      return;
    }

    try {
      if (editingWorkflow) {
        await updateWorkflowApi(editingWorkflow._id, formData, clientId);
        setSuccessMsg('Workflow updated successfully');
      } else {
        await createWorkflowApi(formData, clientId);
        setSuccessMsg('Workflow created successfully');
      }
      setIsBuilderOpen(false);
      fetchWorkflows();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save workflow');
    }
  };

  // Test Condition Evaluation
  const handleTestConditions = async () => {
    if (!testModalWorkflow) return;
    setExecutingTest(true);
    setTestResult(null);
    try {
      const parsed = JSON.parse(testPayloadText);
      const res = await testWorkflowConditionsApi(testModalWorkflow._id, parsed, clientId);
      setTestResult({ type: 'conditions', ...res });
    } catch (err: any) {
      setTestResult({
        type: 'error',
        message: err.message || 'Invalid JSON or condition testing error',
      });
    } finally {
      setExecutingTest(false);
    }
  };

  // Manual Workflow Execution
  const handleExecuteManual = async () => {
    if (!testModalWorkflow) return;
    setExecutingTest(true);
    setTestResult(null);
    try {
      const parsed = JSON.parse(testPayloadText);
      const res = await executeManualWorkflowApi(testModalWorkflow._id, parsed, undefined, clientId);
      setTestResult({ type: 'execution', run: res });
      fetchRuns();
    } catch (err: any) {
      setTestResult({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Execution failed',
      });
    } finally {
      setExecutingTest(false);
    }
  };

  // KPI Calculations
  const activeCount = workflows.filter((w) => w.status === 'active').length;
  const completedRunsCount = runs.filter((r) => r.status === 'completed').length;
  const successRate = runs.length > 0 ? Math.round((completedRunsCount / runs.length) * 100) : 100;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Workflow Automations</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
              Release 10 Engine
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Trigger operational lead routing, SLA alerts, auto-followups, and notification events.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              if (activeTab === 'workflows') fetchWorkflows();
              else fetchRuns();
            }}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${workflowsLoading || runsLoading ? 'animate-spin' : ''}`} />
          </button>

          {canCreate && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Create Workflow</span>
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
          <XCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Workflows</span>
            <Workflow className="h-4 w-4 text-brand-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{workflowsTotal}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Triggers</span>
            <Zap className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{activeCount}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Recorded Runs</span>
            <Layers className="h-4 w-4 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{runsTotal || runs.length}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Success Rate</span>
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{successRate}%</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('workflows')}
          className={`text-sm font-semibold pb-2 border-b-2 transition-colors ${
            activeTab === 'workflows'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Automations ({workflows.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('runs')}
          className={`text-sm font-semibold pb-2 border-b-2 transition-colors ${
            activeTab === 'runs'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Execution History ({runs.length})
        </button>
      </div>

      {/* Tab 1: Workflows List */}
      {activeTab === 'workflows' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200">
            <div className="relative w-full sm:w-80">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search workflows..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-600"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Filter className="h-3 w-3" /> Status:
              </span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs py-1.5 px-2.5 rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-brand-600"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          {/* List */}
          {workflowsLoading ? (
            <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-brand-600 mb-2" />
              <p className="text-xs">Loading workflows...</p>
            </div>
          ) : workflows.length === 0 ? (
            <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400">
              <Workflow className="h-10 w-10 mx-auto text-slate-300 stroke-[1.5] mb-2" />
              <h3 className="text-sm font-semibold text-slate-800">No workflows found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Create an automated workflow to auto-assign leads, schedule follow-ups, and trigger team notifications.
              </p>
              {canCreate && (
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  className="mt-4 px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold"
                >
                  Create First Workflow
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {workflows.map((wf) => {
                const isActive = wf.status === 'active';
                const isPaused = wf.status === 'paused';

                return (
                  <div
                    key={wf._id}
                    className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-base font-semibold text-slate-900">{wf.name}</h3>
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : isPaused
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          {wf.status.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Limit: {wf.maxExecutionsPerHour}/hr
                        </span>
                      </div>

                      {wf.description && (
                        <p className="text-xs text-slate-500 line-clamp-1">{wf.description}</p>
                      )}

                      {/* Trigger & Steps Summary */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 text-slate-700 text-xs font-mono">
                          <Zap className="h-3 w-3 text-amber-500" />
                          <span>When: {wf.trigger.eventType}</span>
                        </div>

                        {wf.conditions && wf.conditions.length > 0 && (
                          <span className="text-xs text-slate-400">
                            • {wf.conditions.length} condition{wf.conditions.length > 1 ? 's' : ''}
                          </span>
                        )}

                        <ArrowRight className="h-3 w-3 text-slate-300" />

                        <div className="flex items-center gap-1">
                          {wf.actions.map((act, idx) => (
                            <span
                              key={act.id || idx}
                              className="text-[11px] px-2 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200 font-medium"
                            >
                              {act.type.replace('_', ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                      {/* Test Button */}
                      {canExecute && (
                        <button
                          type="button"
                          onClick={() => {
                            setTestModalWorkflow(wf);
                            setTestResult(null);
                          }}
                          className="px-2.5 py-1.5 text-xs text-slate-700 hover:text-brand-600 hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors inline-flex items-center gap-1.5"
                          title="Test conditions or execute manually"
                        >
                          <Play className="h-3.5 w-3.5" />
                          <span>Test & Run</span>
                        </button>
                      )}

                      {/* Enable/Pause Toggle */}
                      {canEnable && (
                        <button
                          type="button"
                          disabled={actionLoadingId === wf._id}
                          onClick={() => handleToggleStatus(wf)}
                          className={`p-1.5 rounded-lg border text-xs font-medium transition-colors ${
                            isActive
                              ? 'text-amber-700 border-amber-200 hover:bg-amber-50'
                              : 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                          }`}
                          title={isActive ? 'Pause Workflow' : 'Activate Workflow'}
                        >
                          {isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </button>
                      )}

                      {/* Edit */}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(wf)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors"
                          title="Edit Workflow"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      )}

                      {/* Delete */}
                      {canDelete && (
                        <button
                          type="button"
                          disabled={actionLoadingId === wf._id}
                          onClick={() => handleDelete(wf)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200 transition-colors"
                          title="Delete Workflow"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Execution Runs */}
      {activeTab === 'runs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Audit trail of automated and manual workflow executions.
            </span>
            <button
              type="button"
              onClick={fetchRuns}
              className="text-xs text-brand-600 hover:underline inline-flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" /> Refresh runs
            </button>
          </div>

          {runsLoading ? (
            <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-brand-600 mb-2" />
              <p className="text-xs">Loading execution history...</p>
            </div>
          ) : runs.length === 0 ? (
            <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400">
              <Clock className="h-8 w-8 mx-auto text-slate-300 stroke-[1.5] mb-2" />
              <h3 className="text-sm font-semibold text-slate-800">No execution runs recorded yet</h3>
              <p className="text-xs text-slate-500 mt-1">
                Runs are automatically recorded when event triggers fire or when manually executed.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="p-3">Status</th>
                    <th className="p-3">Workflow</th>
                    <th className="p-3">Trigger Event</th>
                    <th className="p-3">Actions Executed</th>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {runs.map((run) => {
                    const wfName =
                      typeof run.workflowId === 'object' && run.workflowId
                        ? run.workflowId.name
                        : 'Workflow';
                    const isSuccess = run.status === 'completed';
                    const isFailed = run.status === 'failed';
                    const isSkipped = run.status === 'skipped';

                    return (
                      <tr key={run._id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold text-[10px] border ${
                              isSuccess
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : isFailed
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : isSkipped
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-50 text-slate-700 border-slate-200'
                            }`}
                          >
                            {isSuccess && <CheckCircle2 className="h-3 w-3" />}
                            {isFailed && <XCircle className="h-3 w-3" />}
                            {isSkipped && <AlertTriangle className="h-3 w-3" />}
                            <span>{run.status.toUpperCase()}</span>
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-slate-800">{wfName}</td>
                        <td className="p-3 font-mono text-[11px] text-slate-600">{run.eventType}</td>
                        <td className="p-3">
                          <span className="text-slate-700 font-medium">
                            {run.actionResults?.length || 0} action(s)
                          </span>
                        </td>
                        <td className="p-3 text-slate-500 whitespace-nowrap">
                          {new Date(run.createdAt).toLocaleString()}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedRun(run)}
                            className="text-brand-600 hover:text-brand-700 font-medium text-xs hover:underline"
                          >
                            View Steps
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Workflow Builder Modal */}
      {isBuilderOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingWorkflow ? 'Edit Workflow Automation' : 'Create Workflow Automation'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure the trigger, conditions, and automated operational actions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBuilderOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Step Navigation Bar */}
            <div className="flex border-b border-slate-100 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setBuilderStep(1)}
                className={`flex-1 py-3 text-center border-b-2 transition-colors ${
                  builderStep === 1
                    ? 'border-brand-600 text-brand-600 bg-brand-50/20'
                    : 'border-transparent text-slate-500'
                }`}
              >
                1. General Info & Trigger
              </button>
              <button
                type="button"
                onClick={() => setBuilderStep(2)}
                className={`flex-1 py-3 text-center border-b-2 transition-colors ${
                  builderStep === 2
                    ? 'border-brand-600 text-brand-600 bg-brand-50/20'
                    : 'border-transparent text-slate-500'
                }`}
              >
                2. Conditions ({formData.conditions.length})
              </button>
              <button
                type="button"
                onClick={() => setBuilderStep(3)}
                className={`flex-1 py-3 text-center border-b-2 transition-colors ${
                  builderStep === 3
                    ? 'border-brand-600 text-brand-600 bg-brand-50/20'
                    : 'border-transparent text-slate-500'
                }`}
              >
                3. Automated Actions ({formData.actions.length})
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
              {/* Step 1: General & Trigger */}
              {builderStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Workflow Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Instant High-Value Lead Follow-up"
                      className="w-full p-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-1 focus:ring-brand-600"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Description</label>
                    <textarea
                      rows={2}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Optional details regarding the objective of this automation..."
                      className="w-full p-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-1 focus:ring-brand-600"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Trigger Event *</label>
                      <select
                        value={formData.trigger.eventType}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            trigger: { ...formData.trigger, eventType: e.target.value },
                          })
                        }
                        className="w-full p-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-1 focus:ring-brand-600 bg-white"
                      >
                        <option value="lead.created">lead.created (New lead arrives)</option>
                        <option value="lead.stage_changed">lead.stage_changed (Pipeline stage changed)</option>
                        <option value="lead.updated">lead.updated (Lead details updated)</option>
                        <option value="form.submitted">form.submitted (Website form submitted)</option>
                        <option value="task.created">task.created (Task created)</option>
                        <option value="task.completed">task.completed (Task completed)</option>
                        <option value="task.sla_breached">task.sla_breached (SLA deadline breached)</option>
                        <option value="task.overdue">task.overdue (Task passed due date)</option>
                        <option value="conversation.received">conversation.received (Inbound customer message)</option>
                        <option value="conversation.replied">conversation.replied (Outbound staff reply)</option>
                        <option value="manual.trigger">manual.trigger (On-demand test trigger)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Max Executions Per Hour</label>
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        value={formData.maxExecutionsPerHour}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            maxExecutionsPerHour: Number(e.target.value),
                          })
                        }
                        className="w-full p-2 rounded-lg border border-slate-300 text-slate-800 focus:ring-1 focus:ring-brand-600"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Conditions */}
              {builderStep === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">
                      Specify criteria that must match for the workflow to fire. If no conditions are defined, all triggered events proceed.
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          conditions: [
                            ...formData.conditions,
                            { field: 'lead.leadScore', operator: 'greater_than', value: '50', logicalOperator: 'and' },
                          ],
                        })
                      }
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-xs flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" /> Add Condition
                    </button>
                  </div>

                  {formData.conditions.length === 0 ? (
                    <div className="p-6 text-center border border-dashed border-slate-200 rounded-lg text-slate-400">
                      No conditions set. This workflow will run for every{' '}
                      <span className="font-mono text-slate-600 font-bold">{formData.trigger.eventType}</span> event.
                    </div>
                  ) : (
                    formData.conditions.map((cond: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 relative"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] uppercase font-semibold text-slate-500 mb-0.5">
                              Field (Allowlisted)
                            </label>
                            <input
                              type="text"
                              value={cond.field}
                              onChange={(e) => {
                                const copy = [...formData.conditions];
                                copy[idx].field = e.target.value;
                                setFormData({ ...formData, conditions: copy });
                              }}
                              placeholder="e.g. lead.stage or lead.leadScore"
                              className="w-full p-1.5 border border-slate-300 rounded bg-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] uppercase font-semibold text-slate-500 mb-0.5">
                              Operator
                            </label>
                            <select
                              value={cond.operator}
                              onChange={(e) => {
                                const copy = [...formData.conditions];
                                copy[idx].operator = e.target.value;
                                setFormData({ ...formData, conditions: copy });
                              }}
                              className="w-full p-1.5 border border-slate-300 rounded bg-white"
                            >
                              <option value="equals">equals</option>
                              <option value="not_equals">not equals</option>
                              <option value="contains">contains</option>
                              <option value="starts_with">starts with</option>
                              <option value="greater_than">greater than</option>
                              <option value="less_than">less than</option>
                              <option value="in_list">in list (comma separated)</option>
                              <option value="exists">exists</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] uppercase font-semibold text-slate-500 mb-0.5">
                              Value
                            </label>
                            <input
                              type="text"
                              value={cond.value || ''}
                              onChange={(e) => {
                                const copy = [...formData.conditions];
                                copy[idx].value = e.target.value;
                                setFormData({ ...formData, conditions: copy });
                              }}
                              placeholder="Value to compare"
                              className="w-full p-1.5 border border-slate-300 rounded bg-white"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[10px] text-slate-400">Rule #{idx + 1}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const copy = formData.conditions.filter((_: any, i: number) => i !== idx);
                              setFormData({ ...formData, conditions: copy });
                            }}
                            className="text-red-600 hover:text-red-700 text-[11px] font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Step 3: Actions */}
              {builderStep === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">
                      Sequential actions dispatched automatically when this workflow executes.
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          actions: [
                            ...formData.actions,
                            {
                              id: `act_${formData.actions.length + 1}`,
                              type: 'create_notification',
                              payload: { title: 'Workflow Alert', message: 'Lead requires follow-up' },
                              order: formData.actions.length,
                            },
                          ],
                        })
                      }
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-xs flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" /> Add Action
                    </button>
                  </div>

                  {formData.actions.map((act: any, idx: number) => (
                    <div key={act.id || idx} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-5 w-5 rounded-full bg-brand-600 text-white font-bold text-[10px] flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-slate-800">Action Step</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const copy = formData.actions.filter((_: any, i: number) => i !== idx);
                            setFormData({ ...formData, actions: copy });
                          }}
                          className="text-red-600 hover:text-red-700 text-xs font-medium"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] uppercase font-semibold text-slate-500 mb-0.5">
                            Action Type
                          </label>
                          <select
                            value={act.type}
                            onChange={(e) => {
                              const copy = [...formData.actions];
                              copy[idx].type = e.target.value;
                              setFormData({ ...formData, actions: copy });
                            }}
                            className="w-full p-1.5 border border-slate-300 rounded bg-white font-medium"
                          >
                            <option value="create_task">Create Follow-up Task</option>
                            <option value="update_lead_stage">Update Lead Pipeline Stage</option>
                            <option value="add_crm_note">Add CRM Note to Timeline</option>
                            <option value="add_tag">Add Lead Tag</option>
                            <option value="create_notification">Dispatch In-App Notification</option>
                            <option value="send_email">Send Email (Mock Provider)</option>
                            <option value="pause_workflow">Pause Workflow Execution</option>
                          </select>
                        </div>

                        {/* Action Specific Fields */}
                        {act.type === 'create_task' && (
                          <div>
                            <label className="block text-[10px] uppercase font-semibold text-slate-500 mb-0.5">
                              Task Title
                            </label>
                            <input
                              type="text"
                              value={act.payload?.title || ''}
                              onChange={(e) => {
                                const copy = [...formData.actions];
                                copy[idx].payload = { ...copy[idx].payload, title: e.target.value };
                                setFormData({ ...formData, actions: copy });
                              }}
                              placeholder="e.g. Call {{lead.fullName}}"
                              className="w-full p-1.5 border border-slate-300 rounded bg-white"
                            />
                          </div>
                        )}

                        {act.type === 'update_lead_stage' && (
                          <div>
                            <label className="block text-[10px] uppercase font-semibold text-slate-500 mb-0.5">
                              Target Stage
                            </label>
                            <select
                              value={act.payload?.stage || 'contacted'}
                              onChange={(e) => {
                                const copy = [...formData.actions];
                                copy[idx].payload = { ...copy[idx].payload, stage: e.target.value };
                                setFormData({ ...formData, actions: copy });
                              }}
                              className="w-full p-1.5 border border-slate-300 rounded bg-white"
                            >
                              <option value="new">New</option>
                              <option value="contacted">Contacted</option>
                              <option value="qualified">Qualified</option>
                              <option value="proposal_sent">Proposal Sent</option>
                              <option value="negotiation">Negotiation</option>
                              <option value="won">Won</option>
                              <option value="lost">Lost</option>
                            </select>
                          </div>
                        )}

                        {act.type === 'add_crm_note' && (
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] uppercase font-semibold text-slate-500 mb-0.5">
                              Note Content
                            </label>
                            <input
                              type="text"
                              value={act.payload?.note || ''}
                              onChange={(e) => {
                                const copy = [...formData.actions];
                                copy[idx].payload = { ...copy[idx].payload, note: e.target.value };
                                setFormData({ ...formData, actions: copy });
                              }}
                              placeholder="e.g. High priority lead automatically tagged for immediate contact."
                              className="w-full p-1.5 border border-slate-300 rounded bg-white"
                            />
                          </div>
                        )}

                        {act.type === 'create_notification' && (
                          <div className="sm:col-span-2 space-y-2">
                            <div>
                              <label className="block text-[10px] uppercase font-semibold text-slate-500 mb-0.5">
                                Notification Title
                              </label>
                              <input
                                type="text"
                                value={act.payload?.title || ''}
                                onChange={(e) => {
                                  const copy = [...formData.actions];
                                  copy[idx].payload = { ...copy[idx].payload, title: e.target.value };
                                  setFormData({ ...formData, actions: copy });
                                }}
                                placeholder="Alert title..."
                                className="w-full p-1.5 border border-slate-300 rounded bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase font-semibold text-slate-500 mb-0.5">
                                Message
                              </label>
                              <input
                                type="text"
                                value={act.payload?.message || ''}
                                onChange={(e) => {
                                  const copy = [...formData.actions];
                                  copy[idx].payload = { ...copy[idx].payload, message: e.target.value };
                                  setFormData({ ...formData, actions: copy });
                                }}
                                placeholder="Alert message details..."
                                className="w-full p-1.5 border border-slate-300 rounded bg-white"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                {builderStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setBuilderStep(builderStep - 1)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-semibold text-xs"
                  >
                    Back
                  </button>
                )}
                {builderStep < 3 && (
                  <button
                    type="button"
                    onClick={() => setBuilderStep(builderStep + 1)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-white font-semibold text-xs"
                  >
                    Next: {builderStep === 1 ? 'Conditions' : 'Actions'}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBuilderOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveWorkflow}
                  className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs shadow-sm"
                >
                  {editingWorkflow ? 'Save Changes' : 'Create Automation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test & Manual Run Drawer */}
      {testModalWorkflow && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-sm text-slate-800">
                  Test & Run: {testModalWorkflow.name}
                </h3>
                <span className="text-[11px] font-mono text-slate-500">
                  Trigger: {testModalWorkflow.trigger.eventType}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setTestModalWorkflow(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Sample Event Payload (JSON)
                </label>
                <textarea
                  rows={6}
                  value={testPayloadText}
                  onChange={(e) => setTestPayloadText(e.target.value)}
                  className="w-full font-mono text-[11px] p-2.5 rounded-lg border border-slate-300 bg-slate-900 text-slate-100 focus:ring-1 focus:ring-brand-600"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={executingTest}
                  onClick={handleTestConditions}
                  className="flex-1 py-2 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 font-semibold text-slate-800 transition-colors"
                >
                  Evaluate Conditions Only
                </button>
                <button
                  type="button"
                  disabled={executingTest}
                  onClick={handleExecuteManual}
                  className="flex-1 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-sm transition-colors flex items-center justify-center gap-1.5"
                >
                  {executingTest && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Execute Actions</span>
                </button>
              </div>

              {/* Results View */}
              {testResult && (
                <div className="p-3.5 rounded-lg border bg-slate-50 text-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] uppercase tracking-wider">
                      {testResult.type === 'conditions' ? 'Condition Check Result' : 'Execution Result'}
                    </span>
                    {testResult.passed !== undefined && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          testResult.passed
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {testResult.passed ? 'CONDITIONS PASSED' : 'CONDITIONS FAILED'}
                      </span>
                    )}
                  </div>

                  {testResult.type === 'conditions' && testResult.conditionResults && (
                    <div className="space-y-1 divide-y divide-slate-100 pt-1">
                      {testResult.conditionResults.map((c: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-[11px] pt-1">
                          <span className="font-mono">
                            {c.field} {c.operator}
                          </span>
                          <span className={c.passed ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold'}>
                            {c.passed ? 'Match' : 'Mismatch'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {testResult.type === 'execution' && (
                    <div className="space-y-1 font-mono text-[11px]">
                      <div>Status: <span className="font-bold">{testResult.run?.status}</span></div>
                      <div>Actions: {testResult.run?.actionResults?.length || 0} executed</div>
                      {testResult.run?.error && (
                        <div className="text-red-600">Error: {testResult.run.error}</div>
                      )}
                    </div>
                  )}

                  {testResult.type === 'error' && (
                    <div className="text-red-600 text-xs">{testResult.message}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Selected Run Details Modal */}
      {selectedRun && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-sm text-slate-800">Workflow Run Details</h3>
                <span className="text-[11px] font-mono text-slate-500">ID: {selectedRun._id}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRun(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Status</span>
                  <span className="font-bold text-slate-800">{selectedRun.status.toUpperCase()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Trigger Event</span>
                  <span className="font-mono text-slate-700">{selectedRun.eventType}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Started At</span>
                  <span className="text-slate-700">{new Date(selectedRun.createdAt).toLocaleTimeString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Event ID</span>
                  <span className="font-mono text-slate-700 truncate block">{selectedRun.eventId}</span>
                </div>
              </div>

              {selectedRun.error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700">
                  <span className="font-bold block mb-0.5">Execution Error</span>
                  <p>{selectedRun.error}</p>
                </div>
              )}

              {/* Action Results Timeline */}
              <div>
                <h4 className="font-bold text-slate-800 mb-2">Action Pipeline Execution</h4>
                {selectedRun.actionResults && selectedRun.actionResults.length > 0 ? (
                  <div className="space-y-2">
                    {selectedRun.actionResults.map((act, i) => (
                      <div key={i} className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-800">
                            #{i + 1} {act.actionType}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              act.status === 'success'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {act.status.toUpperCase()} ({act.durationMs}ms)
                          </span>
                        </div>
                        {act.output && (
                          <pre className="text-[10px] font-mono bg-slate-50 p-1.5 rounded overflow-x-auto text-slate-600">
                            {JSON.stringify(act.output, null, 2)}
                          </pre>
                        )}
                        {act.error && (
                          <span className="text-red-600 text-[11px] block">{act.error}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-xs italic">No actions executed for this run.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
