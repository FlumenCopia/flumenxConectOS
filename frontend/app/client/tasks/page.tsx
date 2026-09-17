'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  CheckSquare,
  Clock,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Search,
  Filter,
  Plus,
  RefreshCw,
  X,
  User,
  ExternalLink,
  History,
  Sparkles,
  ShieldAlert,
  PhoneCall,
  Mail,
  Users,
  Check,
  Eye,
  Settings,
  Flame,
  ArrowUpRight,
  UserCheck,
  MessageCircle,
  FileText
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  getTasksApi,
  getTaskKpisApi,
  getAgendaApi,
  getDispositionsApi,
  getSlaPoliciesApi,
  createTaskApi,
  getTaskByIdApi,
  updateTaskApi,
  assignTaskApi,
  startTaskApi,
  completeTaskApi,
  cancelTaskApi,
  snoozeTaskApi,
  applyDispositionApi,
  getTaskEventsApi,
  TaskItem,
  TaskEventItem,
  TaskDispositionItem,
  SlaPolicyItem,
  TaskKpis,
  DailyAgenda,
  TaskType,
  TaskStatus,
  TaskPriority
} from '@/lib/tasks';
import { getWorkspaceTeamApi, ClientMemberItem } from '@/lib/clients';
import { getLeadsApi, LeadItem } from '@/lib/leads';

export default function ClientTasksPage() {
  const [activeTab, setActiveTab] = useState<'list' | 'agenda' | 'sla'>('list');
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [kpis, setKpis] = useState<TaskKpis | null>(null);
  const [agenda, setAgenda] = useState<DailyAgenda | null>(null);
  const [dispositions, setDispositions] = useState<TaskDispositionItem[]>([]);
  const [slaPolicies, setSlaPolicies] = useState<SlaPolicyItem[]>([]);
  const [teamMembers, setTeamMembers] = useState<ClientMemberItem[]>([]);
  const [leadsList, setLeadsList] = useState<LeadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<TaskType | 'all'>('all');
  const [assignedFilter, setAssignedFilter] = useState<string | 'all'>('all');
  const [slaBreachedFilter, setSlaBreachedFilter] = useState<'true' | 'false' | 'all'>('all');

  // Modals & Drawer state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDispositionModal, setShowDispositionModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false);
  const [taskEvents, setTaskEvents] = useState<TaskEventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  // New task form
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTaskType, setNewTaskType] = useState<TaskType>('follow_up');
  const [newPriority, setNewPriority] = useState<TaskPriority>('normal');
  const [newDueAt, setNewDueAt] = useState('');
  const [newAssignedTo, setNewAssignedTo] = useState('');
  const [newLeadId, setNewLeadId] = useState('');

  // Quick disposition form
  const [dispCode, setDispCode] = useState('');
  const [dispNotes, setDispNotes] = useState('');
  const [dispScheduleFollowUp, setDispScheduleFollowUp] = useState(false);
  const [dispFollowUpDueAt, setDispFollowUpDueAt] = useState('');
  const [dispFollowUpTitle, setDispFollowUpTitle] = useState('');
  const [dispLeadStage, setDispLeadStage] = useState('');

  const loadData = useCallback(async () => {
    try {
      setErrorMsg(null);
      const [kpiRes, dispRes, slaRes, teamRes] = await Promise.allSettled([
        getTaskKpisApi(),
        getDispositionsApi(),
        getSlaPoliciesApi(),
        getWorkspaceTeamApi(),
      ]);

      if (kpiRes.status === 'fulfilled') setKpis(kpiRes.value);
      if (dispRes.status === 'fulfilled') setDispositions(dispRes.value);
      if (slaRes.status === 'fulfilled') setSlaPolicies(slaRes.value);
      if (teamRes.status === 'fulfilled') setTeamMembers(teamRes.value.members || []);

      // Fetch leads for selector
      try {
        const leadRes = await getLeadsApi({ limit: 100 });
        if (leadRes?.leads) setLeadsList(leadRes.leads);
      } catch {
        // Non-critical fallback
      }

      if (activeTab === 'list') {
        const taskRes = await getTasksApi({
          search: search || undefined,
          status: statusFilter,
          priority: priorityFilter,
          taskType: typeFilter,
          assignedTo: assignedFilter,
          slaBreached: slaBreachedFilter,
          limit: 50,
        });
        setTasks(taskRes.data?.tasks || []);
      } else if (activeTab === 'agenda') {
        const agendaRes = await getAgendaApi();
        setAgenda(agendaRes);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load task records');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, search, statusFilter, priorityFilter, typeFilter, assignedFilter, slaBreachedFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleOpenTaskDetail = async (task: TaskItem) => {
    setSelectedTask(task);
    setTaskDrawerOpen(true);
    setEventsLoading(true);
    try {
      const freshTask = await getTaskByIdApi(task._id);
      setSelectedTask(freshTask);
      const events = await getTaskEventsApi(task._id);
      setTaskEvents(events);
    } catch (err: any) {
      console.error(err);
    } finally {
      setEventsLoading(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDueAt) {
      setErrorMsg('Task title and due date/time are required.');
      return;
    }
    setActionLoading(true);
    setErrorMsg(null);
    try {
      await createTaskApi({
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        taskType: newTaskType,
        priority: newPriority,
        dueAt: new Date(newDueAt).toISOString(),
        assignedTo: newAssignedTo || undefined,
        leadId: newLeadId || undefined,
      });
      setShowCreateModal(false);
      setNewTitle('');
      setNewDescription('');
      setNewDueAt('');
      setNewAssignedTo('');
      setNewLeadId('');
      setSuccessMsg('Task created and SLA tracking initiated!');
      setTimeout(() => setSuccessMsg(null), 4000);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to create task');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartTask = async (taskId: string) => {
    setActionLoading(true);
    try {
      const updated = await startTaskApi(taskId);
      if (selectedTask && selectedTask._id === taskId) {
        setSelectedTask(updated);
      }
      setSuccessMsg('Task started');
      setTimeout(() => setSuccessMsg(null), 3000);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to start task');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    setActionLoading(true);
    try {
      const updated = await completeTaskApi(taskId, 'Completed manually');
      if (selectedTask && selectedTask._id === taskId) {
        setSelectedTask(updated);
      }
      setSuccessMsg('Task marked as completed!');
      setTimeout(() => setSuccessMsg(null), 3000);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to complete task');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenDisposition = (task: TaskItem) => {
    setSelectedTask(task);
    setDispCode(dispositions[0]?.code || 'contacted');
    setDispNotes('');
    setDispScheduleFollowUp(false);
    setDispFollowUpDueAt('');
    setDispFollowUpTitle(`Follow-up with ${typeof task.leadId === 'object' ? task.leadId?.firstName : 'Lead'}`);
    setDispLeadStage('');
    setShowDispositionModal(true);
  };

  const handleApplyDisposition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !dispCode) return;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      await applyDispositionApi(selectedTask._id, {
        disposition: dispCode,
        notes: dispNotes.trim() || undefined,
        scheduleFollowUp: dispScheduleFollowUp,
        followUpDueAt: dispFollowUpDueAt ? new Date(dispFollowUpDueAt).toISOString() : undefined,
        followUpTitle: dispFollowUpTitle.trim() || undefined,
        updateLeadStage: dispLeadStage || undefined,
      });
      setShowDispositionModal(false);
      if (taskDrawerOpen) setTaskDrawerOpen(false);
      setSuccessMsg('Disposition applied! Task completed and CRM synchronized.');
      setTimeout(() => setSuccessMsg(null), 4000);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to apply outcome disposition');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case 'urgent':
        return <Badge variant="danger" className="gap-1"><Flame className="w-3 h-3" /> Urgent</Badge>;
      case 'high':
        return <Badge variant="warning" className="gap-1"><AlertTriangle className="w-3 h-3" /> High</Badge>;
      case 'normal':
        return <Badge variant="info">Normal</Badge>;
      case 'low':
        return <Badge variant="neutral">Low</Badge>;
      default:
        return <Badge variant="neutral">{priority}</Badge>;
    }
  };

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'open':
        return <Badge variant="neutral">Open</Badge>;
      case 'in_progress':
        return <Badge variant="info">In Progress</Badge>;
      case 'completed':
        return <Badge variant="success" className="gap-1"><Check className="w-3 h-3" /> Completed</Badge>;
      case 'cancelled':
        return <Badge variant="danger">Cancelled</Badge>;
      case 'snoozed':
        return <Badge variant="warning" className="gap-1"><Clock className="w-3 h-3" /> Snoozed</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getTypeIcon = (type: TaskType) => {
    switch (type) {
      case 'call':
        return <PhoneCall className="w-4 h-4 text-emerald-600" />;
      case 'email':
        return <Mail className="w-4 h-4 text-blue-600" />;
      case 'meeting':
        return <Users className="w-4 h-4 text-purple-600" />;
      case 'follow_up':
        return <Clock className="w-4 h-4 text-amber-600" />;
      default:
        return <FileText className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Tasks & Lead Follow-ups</h1>
            <Badge variant="brand">Release 8</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Enforce fast follow-ups with SLA response timers, team assignments, and outcome dispositions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            isLoading={refreshing}
            className="text-slate-600"
          >
            <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Create Task
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-800 text-sm rounded-md flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-green-600 hover:text-green-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="bg-white border-slate-200">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Open Tasks</div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-900">{kpis?.openTasks ?? 0}</span>
              <CheckSquare className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-xs text-slate-500 mt-1">{kpis?.inProgressTasks ?? 0} currently in progress</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Due Today</div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-blue-700">{kpis?.dueToday ?? 0}</span>
              <Calendar className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-xs text-blue-600 mt-1">Pending today&apos;s close</p>
          </CardContent>
        </Card>

        <Card className={`border ${kpis && kpis.overdueTasks > 0 ? 'bg-amber-50/50 border-amber-200' : 'bg-white border-slate-200'}`}>
          <CardContent className="p-4">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Overdue</div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className={`text-2xl font-bold ${kpis && kpis.overdueTasks > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
                {kpis?.overdueTasks ?? 0}
              </span>
              <Clock className={`w-5 h-5 ${kpis && kpis.overdueTasks > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
            </div>
            <p className="text-xs text-slate-500 mt-1">Past due deadline</p>
          </CardContent>
        </Card>

        <Card className={`border ${kpis && kpis.slaBreachedTasks > 0 ? 'bg-red-50/60 border-red-200' : 'bg-white border-slate-200'}`}>
          <CardContent className="p-4">
            <div className="text-xs font-medium text-red-600 uppercase tracking-wider">SLA Breached</div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-red-700">{kpis?.slaBreachedTasks ?? 0}</span>
              <ShieldAlert className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-xs text-red-600 mt-1">Response window exceeded</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Completed Today</div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-emerald-700">{kpis?.completedToday ?? 0}</span>
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-xs text-emerald-600 mt-1">Closed successfully</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Avg Response</div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-900">
                {kpis?.avgResponseMinutes ? `${kpis.avgResponseMinutes}m` : '—'}
              </span>
              <Sparkles className="w-5 h-5 text-brand-500" />
            </div>
            <p className="text-xs text-slate-500 mt-1">From creation to touch</p>
          </CardContent>
        </Card>
      </div>

      {/* View Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('list')}
          className={`pb-3 px-4 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'list'
              ? 'border-brand-800 text-brand-800 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CheckSquare className="w-4 h-4" /> Task Queue
        </button>
        <button
          onClick={() => setActiveTab('agenda')}
          className={`pb-3 px-4 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'agenda'
              ? 'border-brand-800 text-brand-800 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" /> Daily Agenda
        </button>
        <button
          onClick={() => setActiveTab('sla')}
          className={`pb-3 px-4 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'sla'
              ? 'border-brand-800 text-brand-800 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4" /> SLA Targets & Policies
        </button>
      </div>

      {/* TAB 1: Task Queue List */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-wrap gap-3 items-center justify-between">
            <div className="flex flex-1 min-w-[240px] items-center bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5">
              <Search className="w-4 h-4 text-slate-400 mr-2" />
              <input
                type="text"
                placeholder="Search tasks, descriptions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent border-none text-sm text-slate-800 focus:outline-none w-full"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                aria-label="Filter tasks by status"
                className="text-xs bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-700 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="snoozed">Snoozed</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as any)}
                aria-label="Filter tasks by priority"
                className="text-xs bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-700 focus:outline-none"
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                aria-label="Filter tasks by type"
                className="text-xs bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-700 focus:outline-none"
              >
                <option value="all">All Types</option>
                <option value="call">Call</option>
                <option value="email">Email</option>
                <option value="meeting">Meeting</option>
                <option value="follow_up">Follow Up</option>
                <option value="review">Review</option>
                <option value="other">Other</option>
              </select>

              <select
                value={slaBreachedFilter}
                onChange={(e) => setSlaBreachedFilter(e.target.value as any)}
                aria-label="Filter tasks by SLA breach status"
                className="text-xs bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-700 focus:outline-none"
              >
                <option value="all">SLA: All</option>
                <option value="true">SLA: Breached Only</option>
                <option value="false">SLA: Within Target</option>
              </select>

              <select
                value={assignedFilter}
                onChange={(e) => setAssignedFilter(e.target.value)}
                aria-label="Filter tasks by assigned team member"
                className="text-xs bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-700 focus:outline-none"
              >
                <option value="all">Assignee: All</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.userId}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tasks Table */}
          <Card className="bg-white border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Task & Subject</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Priority</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Due Date</th>
                    <th className="py-3 px-3">SLA Status</th>
                    <th className="py-3 px-3">Assignee</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-600" />
                        Loading tasks queue...
                      </td>
                    </tr>
                  ) : tasks.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        <CheckSquare className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        No tasks found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    tasks.map((task) => {
                      const isOverdue =
                        task.status !== 'completed' &&
                        task.status !== 'cancelled' &&
                        new Date(task.dueAt).getTime() < Date.now();

                      return (
                        <tr
                          key={task._id}
                          className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                          onClick={() => handleOpenTaskDetail(task)}
                        >
                          {/* Task & Subject */}
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-900 flex items-center gap-1.5">
                              {task.title}
                              {task.isAutoGenerated && (
                                <span title="Auto-generated follow-up" className="inline-block">
                                  <Sparkles className="w-3 h-3 text-amber-500" />
                                </span>
                              )}
                            </div>
                            {typeof task.leadId === 'object' && task.leadId && (
                              <div className="text-xs text-brand-700 flex items-center gap-1 mt-0.5">
                                <Users className="w-3 h-3" />
                                <span>
                                  Lead: {task.leadId.firstName} {task.leadId.lastName || ''} ({task.leadId.email || 'no email'})
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Type */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5 text-xs text-slate-700 capitalize">
                              {getTypeIcon(task.taskType)}
                              <span>{task.taskType.replace('_', ' ')}</span>
                            </div>
                          </td>

                          {/* Priority */}
                          <td className="py-3 px-3">{getPriorityBadge(task.priority)}</td>

                          {/* Status */}
                          <td className="py-3 px-3">{getStatusBadge(task.status)}</td>

                          {/* Due Date */}
                          <td className="py-3 px-3 text-xs">
                            <div className={isOverdue ? 'text-amber-700 font-medium' : 'text-slate-600'}>
                              {formatDateTime(task.dueAt)}
                            </div>
                            {isOverdue && (
                              <span className="text-[10px] text-amber-600 uppercase font-semibold">Overdue</span>
                            )}
                          </td>

                          {/* SLA Status */}
                          <td className="py-3 px-3 text-xs">
                            {task.slaBreached ? (
                              <span className="inline-flex items-center text-red-600 font-medium gap-1 text-xs">
                                <ShieldAlert className="w-3.5 h-3.5" /> Breached
                              </span>
                            ) : task.status === 'completed' ? (
                              <span className="text-emerald-700 text-xs">Met Target</span>
                            ) : (
                              <span className="text-slate-500 text-xs flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {formatDateTime(task.slaDeadline)}
                              </span>
                            )}
                          </td>

                          {/* Assignee */}
                          <td className="py-3 px-3 text-xs text-slate-700">
                            {task.assignedTo ? (
                              <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-semibold">
                                  {task.assignedTo.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="truncate max-w-[100px]">{task.assignedTo.name}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Unassigned</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              {task.status === 'open' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleStartTask(task._id)}
                                  className="text-xs h-7 px-2 text-slate-600 hover:text-brand-800"
                                  title="Mark In Progress"
                                >
                                  Start
                                </Button>
                              )}

                              {task.status !== 'completed' && task.status !== 'cancelled' && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenDisposition(task)}
                                    className="text-xs h-7 px-2 border-slate-300 text-slate-700 hover:bg-slate-100"
                                    title="Record Outcome & Complete"
                                  >
                                    Disposition
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleCompleteTask(task._id)}
                                    className="text-xs h-7 px-2 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"
                                    title="Quick Complete"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </Button>
                                </>
                              )}

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenTaskDetail(task)}
                                className="text-xs h-7 px-2 text-slate-500 hover:text-slate-800"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: Daily Follow-up Agenda */}
      {activeTab === 'agenda' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Overdue Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-amber-200">
                <span className="font-semibold text-sm text-amber-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" /> Overdue Tasks
                </span>
                <Badge variant="warning">{agenda?.overdue?.length ?? 0}</Badge>
              </div>
              <div className="space-y-2">
                {agenda?.overdue?.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-4 text-center">No overdue tasks</p>
                ) : (
                  agenda?.overdue?.map((task) => (
                    <div
                      key={task._id}
                      onClick={() => handleOpenTaskDetail(task)}
                      className="p-3 bg-amber-50/60 border border-amber-200 rounded-md cursor-pointer hover:bg-amber-100/60 transition-colors"
                    >
                      <div className="font-medium text-xs text-slate-900">{task.title}</div>
                      <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
                        <span>Due: {formatDateTime(task.dueAt)}</span>
                        {getPriorityBadge(task.priority)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Today Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-blue-200">
                <span className="font-semibold text-sm text-blue-800 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-blue-600" /> Due Today
                </span>
                <Badge variant="info">{agenda?.dueToday?.length ?? 0}</Badge>
              </div>
              <div className="space-y-2">
                {agenda?.dueToday?.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-4 text-center">No tasks due today</p>
                ) : (
                  agenda?.dueToday?.map((task) => (
                    <div
                      key={task._id}
                      onClick={() => handleOpenTaskDetail(task)}
                      className="p-3 bg-white border border-slate-200 rounded-md cursor-pointer hover:bg-slate-50 transition-colors shadow-sm"
                    >
                      <div className="font-medium text-xs text-slate-900">{task.title}</div>
                      <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
                        <span>Due: {formatDateTime(task.dueAt)}</span>
                        {getPriorityBadge(task.priority)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Tomorrow Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="font-semibold text-sm text-slate-800 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-500" /> Due Tomorrow
                </span>
                <Badge variant="neutral">{agenda?.dueTomorrow?.length ?? 0}</Badge>
              </div>
              <div className="space-y-2">
                {agenda?.dueTomorrow?.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-4 text-center">No tasks due tomorrow</p>
                ) : (
                  agenda?.dueTomorrow?.map((task) => (
                    <div
                      key={task._id}
                      onClick={() => handleOpenTaskDetail(task)}
                      className="p-3 bg-white border border-slate-200 rounded-md cursor-pointer hover:bg-slate-50 transition-colors shadow-sm"
                    >
                      <div className="font-medium text-xs text-slate-900">{task.title}</div>
                      <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
                        <span>Due: {formatDateTime(task.dueAt)}</span>
                        {getPriorityBadge(task.priority)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Upcoming Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="font-semibold text-sm text-slate-800 flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 text-slate-500" /> Later This Week
                </span>
                <Badge variant="neutral">{agenda?.upcoming?.length ?? 0}</Badge>
              </div>
              <div className="space-y-2">
                {agenda?.upcoming?.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-4 text-center">No upcoming tasks</p>
                ) : (
                  agenda?.upcoming?.map((task) => (
                    <div
                      key={task._id}
                      onClick={() => handleOpenTaskDetail(task)}
                      className="p-3 bg-white border border-slate-200 rounded-md cursor-pointer hover:bg-slate-50 transition-colors shadow-sm"
                    >
                      <div className="font-medium text-xs text-slate-900">{task.title}</div>
                      <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
                        <span>Due: {formatDateTime(task.dueAt)}</span>
                        {getPriorityBadge(task.priority)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SLA Policies & Response Windows */}
      {activeTab === 'sla' && (
        <div className="space-y-6">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-brand-800" /> Service Level Agreement (SLA) Engine
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              SLA response targets guarantee fast follow-ups on newly generated leads from ad campaigns, website forms,
              and inbound webhooks. Breached tasks trigger operational alerts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-red-200 bg-red-50/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <Badge variant="danger">Urgent Priority</Badge>
                  <Flame className="w-4 h-4 text-red-500" />
                </div>
                <div className="text-3xl font-bold text-red-700 mt-3">15 min</div>
                <p className="text-xs text-slate-600 mt-1">
                  Immediate inbound lead follow-up window from live website forms and direct ad conversions.
                </p>
              </CardContent>
            </Card>

            <Card className="border-amber-200 bg-amber-50/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <Badge variant="warning">High Priority</Badge>
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-3xl font-bold text-amber-700 mt-3">60 min</div>
                <p className="text-xs text-slate-600 mt-1">
                  1-hour target for secondary inquiries, email replies, and qualified warm leads.
                </p>
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <Badge variant="info">Normal Priority</Badge>
                  <Clock className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-3xl font-bold text-blue-800 mt-3">4 hours</div>
                <p className="text-xs text-slate-600 mt-1">
                  Half-day business response target for routine check-ins, proposal preparations, and audits.
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-slate-50/40">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <Badge variant="neutral">Low Priority</Badge>
                  <CheckSquare className="w-4 h-4 text-slate-400" />
                </div>
                <div className="text-3xl font-bold text-slate-800 mt-3">24 hours</div>
                <p className="text-xs text-slate-600 mt-1">
                  1 business day window for general reviews, long-term nurturing, and administrative tasks.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="p-5">
              <h4 className="text-sm font-semibold text-slate-900 mb-3">Workspace SLA Policy Configuration</h4>
              <div className="divide-y divide-slate-100 text-sm">
                {slaPolicies.map((p) => (
                  <div key={p._id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-800 flex items-center gap-2">
                        {p.name}
                        {p.isDefault && <Badge variant="brand">Default Policy</Badge>}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Urgent: {p.urgentTargetMinutes}m | High: {p.highTargetMinutes}m | Normal: {p.normalTargetMinutes}m | Low: {p.lowTargetMinutes}m
                      </div>
                    </div>
                    <Badge variant="success">Active</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* CREATE TASK MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-brand-800" />
                <h3 className="font-semibold text-slate-900">Create Follow-up Task</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Call new lead regarding pricing quote"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:ring-1 focus:ring-brand-600 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Task Type
                  </label>
                  <select
                    value={newTaskType}
                    onChange={(e) => setNewTaskType(e.target.value as TaskType)}
                    className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 bg-white focus:outline-none"
                  >
                    <option value="follow_up">Follow Up</option>
                    <option value="call">Phone Call</option>
                    <option value="email">Email</option>
                    <option value="meeting">Meeting</option>
                    <option value="review">Review</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Priority
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                    className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 bg-white focus:outline-none"
                  >
                    <option value="urgent">Urgent (15m SLA)</option>
                    <option value="high">High (1h SLA)</option>
                    <option value="normal">Normal (4h SLA)</option>
                    <option value="low">Low (24h SLA)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Due Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={newDueAt}
                    onChange={(e) => setNewDueAt(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Assignee
                  </label>
                  <select
                    value={newAssignedTo}
                    onChange={(e) => setNewAssignedTo(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 bg-white focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.userId}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Link CRM Lead (Optional)
                </label>
                <select
                  value={newLeadId}
                  onChange={(e) => setNewLeadId(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 bg-white focus:outline-none"
                >
                  <option value="">No linked lead</option>
                  {leadsList.map((l) => (
                    <option key={l._id} value={l._id}>
                      {l.firstName} {l.lastName || ''} ({l.email || l.phone || 'No Contact'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Description / Context
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional context for assignee..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" isLoading={actionLoading}>
                  Create & Schedule
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK DISPOSITION MODAL */}
      {showDispositionModal && selectedTask && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-semibold text-slate-900">Record Follow-up Outcome</h3>
              </div>
              <button
                onClick={() => setShowDispositionModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplyDisposition} className="p-5 space-y-4">
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-xs">
                <span className="font-semibold text-slate-800">Task:</span> {selectedTask.title}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Call / Touch Outcome *
                </label>
                <select
                  value={dispCode}
                  onChange={(e) => {
                    const code = e.target.value;
                    setDispCode(code);
                    if (code === 'rescheduled') {
                      setDispScheduleFollowUp(true);
                      const in24h = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16);
                      setDispFollowUpDueAt(in24h);
                    }
                  }}
                  className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 bg-white focus:outline-none"
                  required
                >
                  {dispositions.map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.name} {d.description ? `(${d.description})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Outcome Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Notes from customer conversation..."
                  value={dispNotes}
                  onChange={(e) => setDispNotes(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none"
                />
              </div>

              <div className="border border-slate-200 rounded-md p-3 space-y-3 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="scheduleFollowUp"
                    checked={dispScheduleFollowUp}
                    onChange={(e) => setDispScheduleFollowUp(e.target.checked)}
                    className="rounded border-slate-300 text-brand-700 focus:ring-brand-600"
                  />
                  <label htmlFor="scheduleFollowUp" className="text-xs font-medium text-slate-700">
                    Schedule Next Follow-up Task
                  </label>
                </div>

                {dispScheduleFollowUp && (
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Follow-up Due Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        value={dispFollowUpDueAt}
                        onChange={(e) => setDispFollowUpDueAt(e.target.value)}
                        className="w-full text-xs border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none"
                        required={dispScheduleFollowUp}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Follow-up Task Title
                      </label>
                      <input
                        type="text"
                        value={dispFollowUpTitle}
                        onChange={(e) => setDispFollowUpTitle(e.target.value)}
                        className="w-full text-xs border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {selectedTask.leadId && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Update Lead Pipeline Stage (Optional)
                  </label>
                  <select
                    value={dispLeadStage}
                    onChange={(e) => setDispLeadStage(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white focus:outline-none"
                  >
                    <option value="">Keep current pipeline stage</option>
                    <option value="contacted">Contacted</option>
                    <option value="qualified">Qualified</option>
                    <option value="proposal">Proposal</option>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                    <option value="unqualified">Unqualified</option>
                  </select>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDispositionModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" isLoading={actionLoading}>
                  Save Outcome & Complete
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TASK DETAIL DRAWER */}
      {taskDrawerOpen && selectedTask && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-brand-800" />
                <span className="text-sm font-semibold text-slate-800">Task Overview</span>
              </div>
              <button
                onClick={() => setTaskDrawerOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-5 flex-1 overflow-y-auto space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {getPriorityBadge(selectedTask.priority)}
                  {getStatusBadge(selectedTask.status)}
                </div>
                <h2 className="text-lg font-bold text-slate-900">{selectedTask.title}</h2>
                {selectedTask.description && (
                  <p className="text-sm text-slate-600 mt-2 bg-slate-50 p-3 rounded border border-slate-200">
                    {selectedTask.description}
                  </p>
                )}
              </div>

              {/* Action Buttons in Drawer */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                {selectedTask.status === 'open' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStartTask(selectedTask._id)}
                    isLoading={actionLoading}
                  >
                    Start Task
                  </Button>
                )}
                {selectedTask.status !== 'completed' && selectedTask.status !== 'cancelled' && (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleOpenDisposition(selectedTask)}
                    >
                      Record Disposition
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleCompleteTask(selectedTask._id)}
                      isLoading={actionLoading}
                    >
                      Quick Complete
                    </Button>
                  </>
                )}
              </div>

              {/* Details List */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Due Date:</span>
                  <span className="font-semibold text-slate-800">{formatDateTime(selectedTask.dueAt)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">SLA Target:</span>
                  <span className="font-semibold text-slate-800">{selectedTask.slaTargetMinutes} mins</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">SLA Deadline:</span>
                  <span className={selectedTask.slaBreached ? 'text-red-600 font-bold' : 'text-slate-800'}>
                    {formatDateTime(selectedTask.slaDeadline)} {selectedTask.slaBreached && '(Breached)'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Assigned To:</span>
                  <span className="text-slate-800 font-semibold">{selectedTask.assignedTo?.name || 'Unassigned'}</span>
                </div>
                {selectedTask.disposition && (
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500 font-medium">Outcome Disposition:</span>
                    <Badge variant="brand">{selectedTask.disposition}</Badge>
                  </div>
                )}
                {selectedTask.completionNotes && (
                  <div className="py-1">
                    <span className="text-slate-500 font-medium block mb-1">Completion Notes:</span>
                    <p className="text-slate-800 bg-white p-2 rounded border border-slate-200">
                      {selectedTask.completionNotes}
                    </p>
                  </div>
                )}
              </div>

              {/* CRM Context Links */}
              {typeof selectedTask.leadId === 'object' && selectedTask.leadId && (
                <div className="p-3 bg-brand-50/60 border border-brand-200 rounded-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-brand-900 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-brand-700" /> CRM Lead Record
                    </span>
                    <Link
                      href={`/client/leads`}
                      className="text-xs text-brand-800 font-semibold hover:underline flex items-center gap-1"
                    >
                      View CRM <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  </div>
                  <div className="mt-2 text-xs text-slate-700 space-y-0.5">
                    <div>
                      <span className="font-semibold">Name:</span> {selectedTask.leadId.firstName} {selectedTask.leadId.lastName || ''}
                    </div>
                    {selectedTask.leadId.email && <div><span className="font-semibold">Email:</span> {selectedTask.leadId.email}</div>}
                    {selectedTask.leadId.phone && <div><span className="font-semibold">Phone:</span> {selectedTask.leadId.phone}</div>}
                  </div>
                </div>
              )}

              {/* Task Timeline / Events */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-slate-500" /> Audit Timeline
                </h4>
                {eventsLoading ? (
                  <div className="text-xs text-slate-400 py-4 text-center">Loading event timeline...</div>
                ) : taskEvents.length === 0 ? (
                  <div className="text-xs text-slate-400 py-2">No event records found.</div>
                ) : (
                  <div className="relative pl-4 border-l-2 border-slate-200 space-y-4">
                    {taskEvents.map((evt) => (
                      <div key={evt._id} className="relative">
                        <div className="absolute -left-[21px] top-0.5 w-2.5 h-2.5 rounded-full bg-brand-600 ring-4 ring-white" />
                        <div className="text-xs font-semibold text-slate-800 capitalize">
                          {evt.eventType.replace(/_/g, ' ')}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {formatDateTime(evt.createdAt)} {evt.actor?.name ? `• by ${evt.actor.name}` : ''}
                        </div>
                        {evt.notes && <p className="text-xs text-slate-600 mt-0.5">{evt.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
