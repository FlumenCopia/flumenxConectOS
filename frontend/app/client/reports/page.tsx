'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  BookmarkPlus,
  RefreshCw,
  Users,
  Target,
  FileText,
  CheckSquare,
  MessageCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  ChevronRight,
  Filter,
  Layers,
  ArrowUpRight,
  Trash2,
  Eye,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  DateRangePreset,
  OverviewReportData,
  LeadAnalyticsData,
  CampaignAnalyticsData,
  FormAnalyticsData,
  TaskAndSlaAnalyticsData,
  TeamProductivityData,
  ConversationAnalyticsData,
  SavedReportItem,
  getOverviewReportApi,
  getLeadAnalyticsApi,
  getCampaignAnalyticsApi,
  getFormAnalyticsApi,
  getTaskAndSlaAnalyticsApi,
  getTeamProductivityApi,
  getConversationAnalyticsApi,
  exportReportCsvApi,
  listSavedReportsApi,
  createSavedReportApi,
  deleteSavedReportApi
} from '@/lib/reports';

export default function ClientReportsPage() {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'leads' | 'campaigns' | 'forms' | 'tasks' | 'team' | 'conversations' | 'saved'
  >('overview');

  // Date Range state
  const [preset, setPreset] = useState<DateRangePreset>('last_30_days');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [showCustomModal, setShowCustomModal] = useState<boolean>(false);
  const [compare, setCompare] = useState<boolean>(true);

  // Data states
  const [overview, setOverview] = useState<OverviewReportData | null>(null);
  const [leadData, setLeadData] = useState<LeadAnalyticsData | null>(null);
  const [campaignData, setCampaignData] = useState<CampaignAnalyticsData | null>(null);
  const [formData, setFormData] = useState<FormAnalyticsData | null>(null);
  const [taskData, setTaskData] = useState<TaskAndSlaAnalyticsData | null>(null);
  const [teamData, setTeamData] = useState<TeamProductivityData | null>(null);
  const [convData, setConvData] = useState<ConversationAnalyticsData | null>(null);
  const [savedReports, setSavedReports] = useState<SavedReportItem[]>([]);

  // Loading & Feedback states
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [teamForbidden, setTeamForbidden] = useState<boolean>(false);

  // Save report modal
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [saveName, setSaveName] = useState<string>('');
  const [saveDesc, setSaveDesc] = useState<string>('');
  const [saveVisibility, setSaveVisibility] = useState<'workspace' | 'private'>('workspace');

  const fetchReportsData = useCallback(async () => {
    try {
      setRefreshing(true);
      setErrorMsg(null);

      const params = {
        preset,
        startDate: preset === 'custom' && customStart ? new Date(customStart).toISOString() : undefined,
        endDate: preset === 'custom' && customEnd ? new Date(customEnd).toISOString() : undefined,
        compare,
      };

      if (activeTab === 'overview') {
        const data = await getOverviewReportApi(params);
        setOverview(data);
      } else if (activeTab === 'leads') {
        const data = await getLeadAnalyticsApi(params);
        setLeadData(data);
      } else if (activeTab === 'campaigns') {
        const data = await getCampaignAnalyticsApi(params);
        setCampaignData(data);
      } else if (activeTab === 'forms') {
        const data = await getFormAnalyticsApi(params);
        setFormData(data);
      } else if (activeTab === 'tasks') {
        const data = await getTaskAndSlaAnalyticsApi(params);
        setTaskData(data);
      } else if (activeTab === 'team') {
        try {
          const data = await getTeamProductivityApi(params);
          setTeamData(data);
          setTeamForbidden(false);
        } catch (err: any) {
          if (err.response?.status === 403) {
            setTeamForbidden(true);
          } else {
            throw err;
          }
        }
      } else if (activeTab === 'conversations') {
        const data = await getConversationAnalyticsApi(params);
        setConvData(data);
      } else if (activeTab === 'saved') {
        const data = await listSavedReportsApi();
        setSavedReports(data);
      }
    } catch (err: any) {
      console.error('Failed to load reports:', err);
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to load report analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, preset, customStart, customEnd, compare]);

  useEffect(() => {
    fetchReportsData();
  }, [fetchReportsData]);

  // CSV Exporter
  const handleExport = async (reportType: string) => {
    try {
      setExporting(true);
      setErrorMsg(null);
      const blob = await exportReportCsvApi({
        reportType,
        preset,
        startDate: preset === 'custom' && customStart ? new Date(customStart).toISOString() : undefined,
        endDate: preset === 'custom' && customEnd ? new Date(customEnd).toISOString() : undefined,
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flumenx-${reportType}-report-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setSuccessMsg(`Successfully exported ${reportType} report CSV`);
    } catch (err: any) {
      console.error('Export error:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to export CSV report');
    } finally {
      setExporting(false);
    }
  };

  // Save Report Handler
  const handleCreateSavedReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveName.trim()) return;

    try {
      await createSavedReportApi({
        name: saveName.trim(),
        description: saveDesc.trim() || undefined,
        reportType: activeTab,
        dateRange: {
          preset,
          startDate: preset === 'custom' && customStart ? customStart : undefined,
          endDate: preset === 'custom' && customEnd ? customEnd : undefined,
        },
        visibility: saveVisibility,
      });

      setShowSaveModal(false);
      setSaveName('');
      setSaveDesc('');
      setSuccessMsg('Report view saved successfully');
      if (activeTab === 'saved') {
        fetchReportsData();
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to save report view');
    }
  };

  const handleDeleteSavedReport = async (id: string) => {
    if (!confirm('Are you sure you want to delete this saved report view?')) return;
    try {
      await deleteSavedReportApi(id);
      setSavedReports((prev) => prev.filter((r) => r._id !== id));
      setSuccessMsg('Saved report view removed');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to delete saved report');
    }
  };

  const applySavedReport = (report: SavedReportItem) => {
    if (report.reportType && report.reportType !== 'custom') {
      setActiveTab(report.reportType as any);
    }
    if (report.dateRange?.preset) {
      setPreset(report.dateRange.preset);
      if (report.dateRange.startDate) setCustomStart(report.dateRange.startDate);
      if (report.dateRange.endDate) setCustomEnd(report.dateRange.endDate);
    }
    setSuccessMsg(`Applied view: "${report.name}"`);
  };

  // Delta Pill renderer
  const renderDelta = (change: number | null | undefined) => {
    if (change === null || change === undefined) return null;
    const isPos = change > 0;
    const isZero = change === 0;

    return (
      <span
        className={`inline-flex items-center text-xs font-semibold px-1.5 py-0.5 rounded ${
          isZero
            ? 'bg-slate-100 text-slate-600'
            : isPos
            ? 'bg-green-100 text-green-700'
            : 'bg-red-100 text-red-700'
        }`}
      >
        {isPos ? (
          <TrendingUp className="w-3 h-3 mr-0.5 inline" />
        ) : isZero ? null : (
          <TrendingDown className="w-3 h-3 mr-0.5 inline" />
        )}
        {isPos ? `+${change}%` : `${change}%`}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link href="/client/dashboard" className="hover:text-brand-600 transition-colors">
              Dashboard
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-slate-900 font-medium">Reporting & Analytics</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-brand-600" />
            Marketing & Operational Intelligence
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Cross-channel performance, conversion attribution, pipeline velocity, and team throughput.
          </p>
        </div>

        {/* Global Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Range Selector */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 shadow-sm text-sm">
            <Calendar className="w-4 h-4 text-slate-400 ml-2 mr-1.5" />
            <select
              value={preset}
              onChange={(e) => {
                const val = e.target.value as DateRangePreset;
                setPreset(val);
                if (val === 'custom') {
                  setShowCustomModal(true);
                }
              }}
              className="bg-transparent border-none text-slate-700 font-medium focus:ring-0 text-xs py-1 pr-7"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last_7_days">Last 7 Days</option>
              <option value="last_30_days">Last 30 Days</option>
              <option value="this_month">This Month</option>
              <option value="previous_month">Previous Month</option>
              <option value="custom">Custom Range...</option>
            </select>
          </div>

          {/* Comparison Toggle */}
          <label className="flex items-center gap-1.5 text-xs text-slate-600 bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg shadow-sm cursor-pointer hover:bg-slate-50">
            <input
              type="checkbox"
              checked={compare}
              onChange={(e) => setCompare(e.target.checked)}
              className="rounded text-brand-600 focus:ring-brand-500 w-3.5 h-3.5"
            />
            <span className="select-none font-medium">Compare</span>
          </label>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchReportsData}
            disabled={refreshing}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          {/* Save Report View Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSaveModal(true)}
            className="flex items-center gap-1.5"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Save View</span>
          </Button>

          {/* Export CSV Dropdown / Button */}
          <Button
            size="sm"
            onClick={() => handleExport(activeTab === 'saved' ? 'overview' : activeTab)}
            disabled={exporting}
            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{exporting ? 'Exporting...' : 'Export CSV'}</span>
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-700 font-bold ml-4">
            ×
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-lg bg-green-50 border border-green-200 text-green-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-green-600 hover:text-green-800 font-bold ml-4">
            ×
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-2 overflow-x-auto pb-px" aria-label="Tabs">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'leads', label: 'Leads & Pipeline', icon: Target },
            { id: 'campaigns', label: 'Campaigns & Attribution', icon: Layers },
            { id: 'forms', label: 'Website Forms', icon: FileText },
            { id: 'tasks', label: 'Tasks & SLA', icon: CheckSquare },
            { id: 'team', label: 'Team Productivity', icon: Users },
            { id: 'conversations', label: 'Inbox & Channels', icon: MessageCircle },
            { id: 'saved', label: 'Saved Views', icon: BookmarkPlus },
          ].map((tab) => {
            const Icon = tab.icon;
            const isCur = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-2.5 px-3.5 font-medium text-xs rounded-t-md whitespace-nowrap border-b-2 transition-all ${
                  isCur
                    ? 'border-brand-600 text-brand-600 bg-white shadow-sm'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Icon className={`w-4 h-4 ${isCur ? 'text-brand-600' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* TAB CONTENT: 1. OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Main KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Leads */}
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                  <span>Total Leads Ingested</span>
                  <Target className="w-4 h-4 text-brand-600" />
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <div className="text-2xl font-bold text-slate-900">
                    {loading ? '...' : overview?.metrics.totalLeads.value?.toLocaleString() ?? 0}
                  </div>
                  {renderDelta(overview?.metrics.totalLeads.changePercentage)}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Prev: {overview?.metrics.totalLeads.previousValue?.toLocaleString() ?? '—'}
                </div>
              </CardContent>
            </Card>

            {/* Won Leads */}
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                  <span>Won / Converted Leads</span>
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <div className="text-2xl font-bold text-slate-900">
                    {loading ? '...' : overview?.metrics.wonLeads.value?.toLocaleString() ?? 0}
                  </div>
                  {renderDelta(overview?.metrics.wonLeads.changePercentage)}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Prev: {overview?.metrics.wonLeads.previousValue?.toLocaleString() ?? '—'}
                </div>
              </CardContent>
            </Card>

            {/* Conversion Rate */}
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                  <span>Lead-to-Deal Conversion</span>
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <div className="text-2xl font-bold text-slate-900">
                    {loading ? '...' : `${overview?.metrics.conversionRate.value ?? 0}%`}
                  </div>
                  {renderDelta(overview?.metrics.conversionRate.changePercentage)}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Prev: {overview?.metrics.conversionRate.previousValue !== undefined ? `${overview?.metrics.conversionRate.previousValue}%` : '—'}
                </div>
              </CardContent>
            </Card>

            {/* SLA Compliance Rate */}
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                  <span>SLA Target Compliance</span>
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <div className="text-2xl font-bold text-slate-900">
                    {loading ? '...' : `${overview?.metrics.slaComplianceRate.value ?? 100}%`}
                  </div>
                  {renderDelta(overview?.metrics.slaComplianceRate.changePercentage)}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Prev: {overview?.metrics.slaComplianceRate.previousValue !== undefined ? `${overview?.metrics.slaComplianceRate.previousValue}%` : '—'}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Secondary KPIs: Forms, Tasks, Conversations, and Financial (if permitted) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Form Submissions */}
            <Card>
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Website Form Submissions</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">
                    {loading ? '...' : overview?.metrics.formSubmissions.value?.toLocaleString() ?? 0}
                  </p>
                </div>
                <div className="text-right">
                  {renderDelta(overview?.metrics.formSubmissions.changePercentage)}
                  <p className="text-xs text-slate-400 mt-1">
                    Prev: {overview?.metrics.formSubmissions.previousValue?.toLocaleString() ?? '—'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Tasks Completed */}
            <Card>
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Tasks & Follow-ups Completed</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">
                    {loading ? '...' : overview?.metrics.tasksCompleted.value?.toLocaleString() ?? 0}
                  </p>
                </div>
                <div className="text-right">
                  {renderDelta(overview?.metrics.tasksCompleted.changePercentage)}
                  <p className="text-xs text-slate-400 mt-1">
                    Prev: {overview?.metrics.tasksCompleted.previousValue?.toLocaleString() ?? '—'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Active Conversations */}
            <Card>
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Active Conversations</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">
                    {loading ? '...' : overview?.metrics.activeConversations.value?.toLocaleString() ?? 0}
                  </p>
                </div>
                <div className="text-right">
                  {renderDelta(overview?.metrics.activeConversations.changePercentage)}
                  <p className="text-xs text-slate-400 mt-1">
                    Prev: {overview?.metrics.activeConversations.previousValue?.toLocaleString() ?? '—'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Financial Metrics Strip (Only rendered if user has financial access) */}
          {overview?.metrics.totalSpend && (
            <div className="bg-slate-900 text-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
                    Financial Performance & Return on Ad Spend (ROAS)
                  </h3>
                </div>
                <Badge variant="brand" className="bg-slate-800 text-slate-300 border-slate-700">
                  Restricted: Financial View
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-xs text-slate-400 font-medium">Total Tracked Ad Spend</p>
                  <p className="text-2xl font-bold mt-1 text-white">
                    {overview.metrics.totalSpend.value !== null
                      ? `$${overview.metrics.totalSpend.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                      : 'Unavailable'}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    {renderDelta(overview.metrics.totalSpend.changePercentage)}
                    <span className="text-xs text-slate-400">
                      Prev: {overview.metrics.totalSpend.previousValue ? `$${overview.metrics.totalSpend.previousValue.toLocaleString()}` : '—'}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-slate-400 font-medium">Closed / Won Deal Revenue</p>
                  <p className="text-2xl font-bold mt-1 text-emerald-400">
                    {overview.metrics.closedRevenue?.value !== null
                      ? `$${overview.metrics.closedRevenue?.value?.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                      : 'Unavailable'}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    {renderDelta(overview.metrics.closedRevenue?.changePercentage)}
                    <span className="text-xs text-slate-400">
                      Prev: {overview.metrics.closedRevenue?.previousValue ? `$${overview.metrics.closedRevenue?.previousValue.toLocaleString()}` : '—'}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-slate-400 font-medium">Blended ROAS</p>
                  <p className="text-2xl font-bold mt-1 text-blue-400">
                    {overview.metrics.roas?.value !== null ? `${overview.metrics.roas?.value}x` : 'Unavailable'}
                  </p>
                  <div className="mt-1">
                    <span className="text-xs text-slate-400">
                      {overview.metrics.roas?.value !== null
                        ? `Return on capital deployed`
                        : `Requires spend & revenue records`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: 2. LEADS & PIPELINE */}
      {activeTab === 'leads' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sources Breakdown */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Leads by Acquisition Source</CardTitle>
                <CardDescription>Attributed volume and deal conversion rate per channel</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 uppercase font-semibold">
                        <th className="pb-3">Source Channel</th>
                        <th className="pb-3 text-right">Lead Count</th>
                        <th className="pb-3 text-right">Share %</th>
                        <th className="pb-3 text-right">Converted (Won)</th>
                        <th className="pb-3 text-right">Conversion Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {leadData?.sources && leadData.sources.length > 0 ? (
                        leadData.sources.map((s) => (
                          <tr key={s.source} className="hover:bg-slate-50">
                            <td className="py-2.5 font-medium text-slate-900 capitalize">
                              {s.source.replace(/_/g, ' ')}
                            </td>
                            <td className="py-2.5 text-right text-slate-700">{s.count}</td>
                            <td className="py-2.5 text-right text-slate-500">{s.percentage}%</td>
                            <td className="py-2.5 text-right text-green-600 font-semibold">{s.wonCount}</td>
                            <td className="py-2.5 text-right font-medium text-slate-900">
                              <Badge variant={s.conversionRate > 20 ? 'success' : 'neutral'}>
                                {s.conversionRate}%
                              </Badge>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="text-center py-6 text-slate-400">
                            No leads recorded for the selected timeframe.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Score Tiers Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Lead Intent & Score Tiers</CardTitle>
                <CardDescription>Distribution by readiness score</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {leadData?.scoreTiers && leadData.scoreTiers.length > 0 ? (
                  leadData.scoreTiers.map((tier) => {
                    const total = leadData.totalLeads || 1;
                    const pct = Math.round((tier.count / total) * 100);
                    return (
                      <div key={tier.tier} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="capitalize text-slate-700">{tier.tier}</span>
                          <span className="text-slate-500">
                            {tier.count} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              tier.tier === 'hot'
                                ? 'bg-red-500'
                                : tier.tier === 'warm'
                                ? 'bg-amber-500'
                                : 'bg-blue-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-400 text-center py-4">No scored leads found</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Pipeline Stage Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Stage Distribution</CardTitle>
              <CardDescription>Progression of active leads across pipeline lifecycle</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {leadData?.stages && leadData.stages.length > 0 ? (
                  leadData.stages.map((st) => (
                    <div
                      key={st.stage}
                      className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 text-center space-y-1"
                    >
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                        {st.stage}
                      </span>
                      <div className="text-xl font-bold text-slate-900">{st.count}</div>
                      <div className="text-xs text-slate-400">{st.percentage}% of total</div>
                      {st.totalValue !== undefined && (
                        <div className="text-xs text-emerald-600 font-semibold pt-1 border-t border-slate-200 mt-1">
                          ${st.totalValue.toLocaleString()}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="col-span-full text-center py-4 text-xs text-slate-400">
                    No pipeline stages found for this period.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB CONTENT: 3. CAMPAIGNS & ATTRIBUTION */}
      {activeTab === 'campaigns' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Platform Share */}
            <Card>
              <CardHeader>
                <CardTitle>Attributed Leads by Platform</CardTitle>
                <CardDescription>Meta Ads vs Google Ads vs Direct intake</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {campaignData?.platforms && campaignData.platforms.length > 0 ? (
                  campaignData.platforms.map((p) => (
                    <div key={p.platform} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-brand-600" />
                        <span className="font-semibold text-xs text-slate-800 capitalize">{p.platform}</span>
                      </div>
                      <Badge variant="brand">{p.attributedLeads} Attributed Leads</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 text-center py-4">No ad platform attribution records found.</p>
                )}
              </CardContent>
            </Card>

            {/* Touchpoint Type Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Attribution Touchpoint Distribution</CardTitle>
                <CardDescription>First Touch vs Last Touch vs Linear Multi-touch</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {campaignData?.touchpoints && campaignData.touchpoints.length > 0 ? (
                  campaignData.touchpoints.map((t) => (
                    <div key={t.type} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50">
                      <span className="font-semibold text-xs text-slate-800 capitalize">
                        {t.type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs font-bold text-slate-700">{t.count} Touchpoints</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 text-center py-4">No touchpoints recorded.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Campaign Performance Table */}
          <Card>
            <CardHeader>
              <CardTitle>Advertising Campaign Performance</CardTitle>
              <CardDescription>Impressions, click-through rates, and cost-per-lead</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase font-semibold">
                      <th className="pb-3">Campaign</th>
                      <th className="pb-3">Platform</th>
                      <th className="pb-3 text-right">Impressions</th>
                      <th className="pb-3 text-right">Clicks</th>
                      <th className="pb-3 text-right">CTR %</th>
                      <th className="pb-3 text-right">Leads</th>
                      <th className="pb-3 text-right">CPL</th>
                      {campaignData?.campaigns.some((c) => c.spend !== undefined) && (
                        <th className="pb-3 text-right">Spend</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {campaignData?.campaigns && campaignData.campaigns.length > 0 ? (
                      campaignData.campaigns.map((c) => (
                        <tr key={c.campaignId} className="hover:bg-slate-50">
                          <td className="py-3 font-medium text-slate-900">{c.name}</td>
                          <td className="py-3 capitalize">
                            <Badge variant={c.platform === 'google' ? 'info' : 'brand'}>{c.platform}</Badge>
                          </td>
                          <td className="py-3 text-right text-slate-600">{c.impressions.toLocaleString()}</td>
                          <td className="py-3 text-right text-slate-600">{c.clicks.toLocaleString()}</td>
                          <td className="py-3 text-right text-slate-900 font-medium">
                            {c.ctr !== null ? `${c.ctr}%` : '—'}
                          </td>
                          <td className="py-3 text-right font-semibold text-brand-600">{c.leads}</td>
                          <td className="py-3 text-right text-slate-900 font-medium">
                            {c.cpl !== null ? `$${c.cpl}` : <span className="text-slate-400 text-xs">N/A</span>}
                          </td>
                          {c.spend !== undefined && (
                            <td className="py-3 text-right font-semibold text-slate-900">
                              {c.spend !== null ? `$${c.spend.toLocaleString()}` : 'N/A'}
                            </td>
                          )}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="text-center py-6 text-slate-400">
                          No advertising performance data found for this date range.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB CONTENT: 4. WEBSITE FORMS */}
      {activeTab === 'forms' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Website Form Performance & Intake Yield</CardTitle>
              <CardDescription>Track submission conversion rates across active lead capture forms</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase font-semibold">
                      <th className="pb-3">Form Title</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3 text-right">Views</th>
                      <th className="pb-3 text-right">Submissions</th>
                      <th className="pb-3 text-right">Conversion Rate</th>
                      <th className="pb-3 text-right">CRM Leads Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {formData?.forms && formData.forms.length > 0 ? (
                      formData.forms.map((f) => (
                        <tr key={f.formId} className="hover:bg-slate-50">
                          <td className="py-3 font-medium text-slate-900">{f.title}</td>
                          <td className="py-3">
                            <Badge variant={f.status === 'published' ? 'success' : 'neutral'}>
                              {f.status}
                            </Badge>
                          </td>
                          <td className="py-3 text-right text-slate-600">{f.views.toLocaleString()}</td>
                          <td className="py-3 text-right font-semibold text-slate-900">{f.submissions}</td>
                          <td className="py-3 text-right font-medium text-slate-900">
                            {f.conversionRate !== null ? (
                              <Badge variant={f.conversionRate > 10 ? 'success' : 'neutral'}>
                                {f.conversionRate}%
                              </Badge>
                            ) : (
                              <span className="text-slate-400">0%</span>
                            )}
                          </td>
                          <td className="py-3 text-right font-semibold text-green-600">
                            {f.leadsGenerated}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="text-center py-6 text-slate-400">
                          No form submissions recorded for this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB CONTENT: 5. TASKS & SLA */}
      {activeTab === 'tasks' && (
        <div className="space-y-6">
          {/* SLA Key Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>SLA Compliance Rate</span>
                  <ShieldCheck className="w-4 h-4 text-green-600" />
                </div>
                <div className="text-2xl font-bold text-slate-900 mt-2">
                  {taskData?.slaComplianceRate ?? 100}%
                </div>
                <p className="text-xs text-slate-400 mt-1">Target adherence across completed follow-ups</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>SLA Breaches</span>
                  <ShieldAlert className="w-4 h-4 text-red-500" />
                </div>
                <div className="text-2xl font-bold text-red-600 mt-2">
                  {taskData?.breachedCount ?? 0}
                </div>
                <p className="text-xs text-slate-400 mt-1">Tasks resolved past SLA target deadline</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Avg. Resolution Time</span>
                  <Clock className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-slate-900 mt-2">
                  {taskData?.avgResolutionMinutes !== null ? `${taskData?.avgResolutionMinutes} mins` : '—'}
                </div>
                <p className="text-xs text-slate-400 mt-1">Mean duration from creation to completion</p>
              </CardContent>
            </Card>
          </div>

          {/* Breakdowns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Status Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Tasks by Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {taskData?.statusBreakdown && taskData.statusBreakdown.length > 0 ? (
                  taskData.statusBreakdown.map((s) => (
                    <div key={s.status} className="flex items-center justify-between text-xs">
                      <span className="capitalize text-slate-700 font-medium">{s.status.replace(/_/g, ' ')}</span>
                      <Badge variant="neutral">{s.count}</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 text-center py-3">No tasks found</p>
                )}
              </CardContent>
            </Card>

            {/* Priority Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Tasks by Priority</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {taskData?.priorityBreakdown && taskData.priorityBreakdown.length > 0 ? (
                  taskData.priorityBreakdown.map((p) => (
                    <div key={p.priority} className="flex items-center justify-between text-xs">
                      <span className="capitalize text-slate-700 font-medium">{p.priority}</span>
                      <Badge
                        variant={
                          p.priority === 'urgent'
                            ? 'danger'
                            : p.priority === 'high'
                            ? 'warning'
                            : 'neutral'
                        }
                      >
                        {p.count}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 text-center py-3">No tasks found</p>
                )}
              </CardContent>
            </Card>

            {/* Dispositions Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Task Dispositions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {taskData?.dispositionBreakdown && taskData.dispositionBreakdown.length > 0 ? (
                  taskData.dispositionBreakdown.map((d) => (
                    <div key={d.disposition} className="flex items-center justify-between text-xs">
                      <span className="capitalize text-slate-700 font-medium">{d.disposition.replace(/_/g, ' ')}</span>
                      <Badge variant="brand">{d.count}</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 text-center py-3">No dispositions recorded</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB CONTENT: 6. TEAM PRODUCTIVITY */}
      {activeTab === 'team' && (
        <div className="space-y-6">
          {teamForbidden ? (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-8 text-center space-y-3">
                <ShieldAlert className="w-8 h-8 text-amber-600 mx-auto" />
                <h3 className="text-base font-semibold text-amber-900">
                  Access Restricted: Team Productivity View
                </h3>
                <p className="text-xs text-amber-700 max-w-md mx-auto">
                  Viewing individual team member productivity and operational workloads requires the{' '}
                  <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">reports.view_team</code>{' '}
                  permission. Contact your workspace administrator for access.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Team Workload & Completion Throughput</CardTitle>
                <CardDescription>Individual task volume, completion rates, and SLA breach tracking</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 uppercase font-semibold">
                        <th className="pb-3">Team Member</th>
                        <th className="pb-3 text-right">Assigned Tasks</th>
                        <th className="pb-3 text-right">Completed</th>
                        <th className="pb-3 text-right">Open / Pending</th>
                        <th className="pb-3 text-right">SLA Breached</th>
                        <th className="pb-3 text-right">Completion Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {teamData?.team && teamData.team.length > 0 ? (
                        teamData.team.map((m) => (
                          <tr key={m.userId} className="hover:bg-slate-50">
                            <td className="py-3">
                              <div className="font-semibold text-slate-900">{m.name}</div>
                              <div className="text-slate-400 text-xs">{m.email}</div>
                            </td>
                            <td className="py-3 text-right font-medium text-slate-700">{m.totalAssigned}</td>
                            <td className="py-3 text-right font-semibold text-green-600">{m.completed}</td>
                            <td className="py-3 text-right text-slate-600">{m.open}</td>
                            <td className="py-3 text-right font-semibold text-red-600">{m.breached}</td>
                            <td className="py-3 text-right font-semibold text-slate-900">
                              <Badge variant={m.completionRate >= 80 ? 'success' : 'neutral'}>
                                {m.completionRate}%
                              </Badge>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="text-center py-6 text-slate-400">
                            No team activity found for this period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* TAB CONTENT: 7. CONVERSATIONS & CHANNELS */}
      {activeTab === 'conversations' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-slate-500 font-medium">Total Inbox Threads</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {convData?.totalConversations ?? 0}
                </p>
                <p className="text-xs text-slate-400 mt-1">Threads updated in period</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-slate-500 font-medium">Inbound Messages</p>
                <p className="text-2xl font-bold text-brand-600 mt-1">
                  {convData?.messages.inbound ?? 0}
                </p>
                <p className="text-xs text-slate-400 mt-1">Client and lead responses</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-slate-500 font-medium">Outbound Messages</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">
                  {convData?.messages.outbound ?? 0}
                </p>
                <p className="text-xs text-slate-400 mt-1">Team replies & notifications</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Channel Breakdown</CardTitle>
                <CardDescription>Conversations by messaging channel</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {convData?.channels && convData.channels.length > 0 ? (
                  convData.channels.map((ch) => (
                    <div key={ch.channel} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50">
                      <span className="font-semibold text-xs text-slate-800 uppercase">{ch.channel}</span>
                      <Badge variant="brand">{ch.count} Conversations</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 text-center py-4">No channels recorded.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Conversation Status</CardTitle>
                <CardDescription>Resolution state of active threads</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {convData?.statuses && convData.statuses.length > 0 ? (
                  convData.statuses.map((st) => (
                    <div key={st.status} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50">
                      <span className="font-semibold text-xs text-slate-800 capitalize">{st.status}</span>
                      <Badge variant="neutral">{st.count} Threads</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 text-center py-4">No conversation statuses found.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB CONTENT: 8. SAVED VIEWS */}
      {activeTab === 'saved' && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Custom & Workspace Saved Reports</CardTitle>
                <CardDescription>Saved filter configurations and date range views</CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowSaveModal(true)}>
                <BookmarkPlus className="w-4 h-4 mr-1.5" />
                Save Current View
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase font-semibold">
                      <th className="pb-3">Report View Name</th>
                      <th className="pb-3">Module Type</th>
                      <th className="pb-3">Date Preset</th>
                      <th className="pb-3">Visibility</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {savedReports && savedReports.length > 0 ? (
                      savedReports.map((r) => (
                        <tr key={r._id} className="hover:bg-slate-50">
                          <td className="py-3">
                            <div className="font-semibold text-slate-900">{r.name}</div>
                            {r.description && <div className="text-slate-400 text-xs">{r.description}</div>}
                          </td>
                          <td className="py-3 capitalize">
                            <Badge variant="neutral">{r.reportType}</Badge>
                          </td>
                          <td className="py-3 text-slate-600 capitalize">
                            {r.dateRange?.preset?.replace(/_/g, ' ') || 'last 30 days'}
                          </td>
                          <td className="py-3 capitalize">
                            <Badge variant={r.visibility === 'workspace' ? 'brand' : 'neutral'}>
                              {r.visibility}
                            </Badge>
                          </td>
                          <td className="py-3 text-right space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => applySavedReport(r)}
                              className="text-xs"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              Apply
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSavedReport(r._id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center py-6 text-slate-400">
                          No saved reports found. Configure filters and click &ldquo;Save View&rdquo;.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* MODAL: Custom Date Range */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-brand-600" />
              Custom Analytics Date Range
            </h3>
            <p className="text-xs text-slate-500">
              Select a custom date range (up to 366 days). Reports will automatically calculate comparative deltas.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full text-xs rounded-lg border-slate-200 focus:border-brand-500 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full text-xs rounded-lg border-slate-200 focus:border-brand-500 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowCustomModal(false);
                  if (!customStart || !customEnd) {
                    setPreset('last_30_days');
                  }
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (customStart && customEnd) {
                    setShowCustomModal(false);
                    fetchReportsData();
                  } else {
                    alert('Please select both start and end dates');
                  }
                }}
                className="bg-brand-600 hover:bg-brand-700 text-white"
              >
                Apply Range
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Save Report View */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateSavedReport}
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4"
          >
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BookmarkPlus className="w-5 h-5 text-brand-600" />
              Save Report View
            </h3>
            <p className="text-xs text-slate-500">
              Save the current date range and tab settings to quickly access or share with your team.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Report View Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q3 Pipeline & Conversion Review"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  className="w-full text-xs rounded-lg border-slate-200 focus:border-brand-500 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description (Optional)</label>
                <textarea
                  placeholder="Brief description of this report view..."
                  value={saveDesc}
                  onChange={(e) => setSaveDesc(e.target.value)}
                  rows={2}
                  className="w-full text-xs rounded-lg border-slate-200 focus:border-brand-500 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Visibility</label>
                <select
                  value={saveVisibility}
                  onChange={(e) => setSaveVisibility(e.target.value as any)}
                  className="w-full text-xs rounded-lg border-slate-200 focus:border-brand-500 focus:ring-brand-500"
                >
                  <option value="workspace">Workspace (All authorized team members)</option>
                  <option value="private">Private (Only me)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setShowSaveModal(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="bg-brand-600 hover:bg-brand-700 text-white">
                Save View
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
