'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Megaphone,
  RefreshCw,
  Plus,
  TrendingUp,
  DollarSign,
  MousePointer,
  Eye,
  Target,
  Layers,
  Sparkles,
  Search,
  Filter,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  X,
  ChevronRight,
  HelpCircle,
  BarChart3,
  Calendar,
  KeyRound,
  Trash2,
  Users,
  Compass
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  getAdConnectionsApi,
  createAdConnectionApi,
  revokeAdConnectionApi,
  syncAdConnectionApi,
  syncAllAdConnectionsApi,
  getReportingSummaryApi,
  getReportingTimeSeriesApi,
  getAdCampaignsApi,
  getAdSetsApi,
  getAdCreativesApi,
  getLeadAttributionsApi,
  getAttributionSummaryApi,
  AdPlatformConnectionItem,
  AdCampaignItem,
  AdSetItem,
  AdCreativeItem,
  ExecutiveSummaryReport,
  DailyTimeSeriesItem,
  LeadAttributionItem,
  AttributionSummaryReport,
  AdPlatform
} from '@/lib/ads';

export default function ClientCampaignsPage() {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'campaigns' | 'attribution' | 'connections'>('overview');

  // Loading & Global States
  const [loading, setLoading] = useState(true);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotification, setSuccessNotification] = useState<string | null>(null);

  // Filter States
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Data States
  const [connections, setConnections] = useState<AdPlatformConnectionItem[]>([]);
  const [summary, setSummary] = useState<ExecutiveSummaryReport | null>(null);
  const [timeSeries, setTimeSeries] = useState<DailyTimeSeriesItem[]>([]);
  const [campaigns, setCampaigns] = useState<AdCampaignItem[]>([]);
  const [attributions, setAttributions] = useState<LeadAttributionItem[]>([]);
  const [attrSummary, setAttrSummary] = useState<AttributionSummaryReport | null>(null);

  // Drilldown Modal
  const [selectedCampaign, setSelectedCampaign] = useState<AdCampaignItem | null>(null);
  const [campaignAdSets, setCampaignAdSets] = useState<AdSetItem[]>([]);
  const [campaignAds, setCampaignAds] = useState<AdCreativeItem[]>([]);
  const [loadingDrilldown, setLoadingDrilldown] = useState(false);

  // Connect Account Modal
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [connectPlatform, setConnectPlatform] = useState<AdPlatform>('meta');
  const [connectAccountName, setConnectAccountName] = useState('');
  const [connectAccountId, setConnectAccountId] = useState('');
  const [connectAccessToken, setConnectAccessToken] = useState('');
  const [isSubmittingConnect, setIsSubmittingConnect] = useState(false);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [connRes, sumRes, timeRes, campRes, attrRes, attrSumRes] = await Promise.all([
        getAdConnectionsApi().catch(() => ({ success: false, data: [] })),
        getReportingSummaryApi({ platform: selectedPlatform }).catch(() => ({ success: false, data: null })),
        getReportingTimeSeriesApi({ platform: selectedPlatform }).catch(() => ({ success: false, data: [] })),
        getAdCampaignsApi({ platform: selectedPlatform, limit: 50 }).catch(() => ({ success: false, data: { campaigns: [], pagination: { total: 0, page: 1, limit: 50, totalPages: 0 } } })),
        getLeadAttributionsApi({ platform: selectedPlatform, limit: 50 }).catch(() => ({ success: false, data: { attributions: [], pagination: { total: 0, page: 1, limit: 50, totalPages: 0 } } })),
        getAttributionSummaryApi().catch(() => ({ success: false, data: null })),
      ]);

      if (connRes.success && connRes.data) {
        setConnections(connRes.data);
      }
      if (sumRes.success && sumRes.data) {
        setSummary(sumRes.data);
      }
      if (timeRes.success && timeRes.data) {
        setTimeSeries(timeRes.data);
      }
      if (campRes.success && campRes.data) {
        setCampaigns(campRes.data.campaigns || []);
      }
      if (attrRes.success && attrRes.data) {
        setAttributions(attrRes.data.attributions || []);
      }
      if (attrSumRes.success && attrSumRes.data) {
        setAttrSummary(attrSumRes.data);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load advertising analytics');
    } finally {
      setLoading(false);
    }
  }, [selectedPlatform]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Sync All Trigger
  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      const res = await syncAllAdConnectionsApi();
      setSuccessNotification(res.message || 'Ad accounts synchronized successfully!');
      await fetchAllData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Sync failed');
    } finally {
      setSyncingAll(false);
      setTimeout(() => setSuccessNotification(null), 5000);
    }
  };

  // Sync Single Connection
  const handleSyncSingle = async (id: string) => {
    setSyncingId(id);
    try {
      await syncAdConnectionApi(id);
      setSuccessNotification('Account synced successfully.');
      await fetchAllData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to sync account');
    } finally {
      setSyncingId(null);
      setTimeout(() => setSuccessNotification(null), 5000);
    }
  };

  // Revoke Connection
  const handleRevoke = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to disconnect ${name}? Data will remain archived.`)) return;
    try {
      await revokeAdConnectionApi(id);
      setSuccessNotification(`${name} disconnected.`);
      await fetchAllData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to disconnect account');
    }
  };

  // Connect Form Submission
  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingConnect(true);
    setErrorMessage(null);

    try {
      await createAdConnectionApi({
        platform: connectPlatform,
        accountName: connectAccountName.trim(),
        accountId: connectAccountId.trim(),
        accessToken: connectAccessToken.trim(),
      });

      setIsConnectModalOpen(false);
      setConnectAccountName('');
      setConnectAccountId('');
      setConnectAccessToken('');
      setSuccessNotification(`${connectPlatform.toUpperCase()} account connected successfully! Synchronizing initial data...`);
      await fetchAllData();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to connect ad account');
    } finally {
      setIsSubmittingConnect(false);
    }
  };

  // Drilldown to AdSets and Creatives
  const handleOpenCampaignDrilldown = async (camp: AdCampaignItem) => {
    setSelectedCampaign(camp);
    setLoadingDrilldown(true);
    try {
      const [setsRes, adsRes] = await Promise.all([
        getAdSetsApi({ externalCampaignId: camp.externalCampaignId }),
        getAdCreativesApi({ externalCampaignId: camp.externalCampaignId }),
      ]);
      if (setsRes.success && setsRes.data) setCampaignAdSets(setsRes.data);
      if (adsRes.success && adsRes.data) setCampaignAds(adsRes.data);
    } catch (err) {
      console.error('Failed to load drilldown metrics', err);
    } finally {
      setLoadingDrilldown(false);
    }
  };

  // Filtered Campaigns
  const filteredCampaigns = campaigns.filter((c) => {
    if (selectedPlatform !== 'all' && c.platform !== selectedPlatform) return false;
    if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-sage-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-forest-50 text-forest-800 border border-forest-100">
              <Megaphone className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-charcoal-900">
              Campaigns & Ad Platform Integrations
            </h1>
          </div>
          <p className="mt-1 text-xs text-sage-500">
            Live cross-platform advertising analytics, verified spend tracking, and multi-touch CRM lead attribution.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncAll}
            disabled={syncingAll || loading}
            className="flex items-center gap-2 rounded-xl border-sage-200 hover:bg-sage-50 text-charcoal-700 shadow-soft-xs"
          >
            <RefreshCw className={`h-4 w-4 ${syncingAll ? 'animate-spin text-brand-800' : ''}`} />
            {syncingAll ? 'Syncing...' : 'Sync Ad Accounts'}
          </Button>

          <Button
            size="sm"
            onClick={() => setIsConnectModalOpen(true)}
            className="bg-brand-800 hover:bg-brand-900 text-white flex items-center gap-2 rounded-xl shadow-soft-xs px-4"
          >
            <Plus className="h-4 w-4" />
            Connect Ad Account
          </Button>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {successNotification && (
        <div className="p-3.5 rounded-xl bg-forest-50/80 border border-forest-200 text-forest-900 flex items-center justify-between shadow-soft-xs text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-forest-600 shrink-0" />
            <span className="font-medium">{successNotification}</span>
          </div>
          <button onClick={() => setSuccessNotification(null)} className="text-forest-700 hover:text-forest-900 p-1">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between shadow-soft-xs text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-700 hover:text-rose-900 p-1">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-sage-200 gap-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3.5 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'overview'
              ? 'border-brand-800 text-brand-900 font-bold'
              : 'border-transparent text-sage-500 hover:text-charcoal-800'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          Performance Overview
        </button>

        <button
          onClick={() => setActiveTab('campaigns')}
          className={`pb-3.5 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'campaigns'
              ? 'border-brand-800 text-brand-900 font-bold'
              : 'border-transparent text-sage-500 hover:text-charcoal-800'
          }`}
        >
          <Layers className="h-4 w-4" />
          Campaigns ({filteredCampaigns.length})
        </button>

        <button
          onClick={() => setActiveTab('attribution')}
          className={`pb-3.5 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'attribution'
              ? 'border-brand-800 text-brand-900 font-bold'
              : 'border-transparent text-sage-500 hover:text-charcoal-800'
          }`}
        >
          <Compass className="h-4 w-4" />
          Lead Attribution ({attributions.length})
        </button>

        <button
          onClick={() => setActiveTab('connections')}
          className={`pb-3.5 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'connections'
              ? 'border-brand-800 text-brand-900 font-bold'
              : 'border-transparent text-sage-500 hover:text-charcoal-800'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          Ad Accounts ({connections.length})
        </button>
      </div>

      {/* TAB 1: EXECUTIVE PERFORMANCE OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Platform Selector Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-sage-200/90 shadow-soft-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-sage-500 uppercase tracking-wider">Platform:</span>
              <div className="inline-flex rounded-xl border border-sage-200 p-0.5 bg-sage-50/50 text-xs">
                {['all', 'meta', 'google'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setSelectedPlatform(p)}
                    className={`px-3 py-1.5 rounded-lg capitalize font-medium transition-all ${
                      selectedPlatform === p
                        ? 'bg-brand-800 text-white shadow-soft-xs font-semibold'
                        : 'text-sage-600 hover:text-charcoal-900'
                    }`}
                  >
                    {p === 'all' ? 'All Channels' : p === 'meta' ? 'Meta Ads' : 'Google Ads'}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-xs text-sage-500 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-sage-400" />
              <span>Reporting window: Last 30 Days</span>
            </div>
          </div>

          {/* Metric KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-sage-200/90 bg-white shadow-soft-xs rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-sage-500 uppercase tracking-wider">Total Ad Spend</span>
                  <span className="p-2 rounded-xl bg-forest-50 text-forest-800 border border-forest-100">
                    <DollarSign className="h-4 w-4" />
                  </span>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold text-charcoal-900">
                    ${summary ? summary.totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}
                  </div>
                  <div className="mt-1 text-xs text-sage-400">Across Meta & Google Ads</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-sage-200/90 bg-white shadow-soft-xs rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-sage-500 uppercase tracking-wider">Traffic & Clicks</span>
                  <span className="p-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-100">
                    <MousePointer className="h-4 w-4" />
                  </span>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold text-charcoal-900">
                    {summary ? summary.totalClicks.toLocaleString() : 0}
                  </div>
                  <div className="mt-1 text-xs text-sage-500 flex items-center gap-2">
                    <span>CTR: {summary?.ctr || 0}%</span>
                    <span>•</span>
                    <span>CPC: ${summary?.cpc || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-sage-200/90 bg-white shadow-soft-xs rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-sage-500 uppercase tracking-wider">Cost Per Lead (CPL)</span>
                  <span className="p-2 rounded-xl bg-forest-50 text-forest-800 border border-forest-100">
                    <Target className="h-4 w-4" />
                  </span>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold text-charcoal-900">
                    ${summary && summary.cpl > 0 ? summary.cpl.toFixed(2) : '0.00'}
                  </div>
                  <div className="mt-1 text-xs text-sage-400">
                    {summary?.totalLeads || 0} Ad platform leads captured
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-sage-200/90 bg-white shadow-soft-xs rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-sage-500 uppercase tracking-wider">Verified ROAS</span>
                  <span className="p-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-100">
                    <Sparkles className="h-4 w-4" />
                  </span>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold text-charcoal-900">
                    {summary?.roas !== null && summary?.roas !== undefined ? `${summary.roas}x` : '—'}
                  </div>
                  <div className="mt-1 text-xs text-sage-400">
                    {summary?.verifiedRevenue && summary.verifiedRevenue > 0
                      ? `$${summary.verifiedRevenue.toLocaleString()} verified pipeline`
                      : 'Requires verified closed revenue'}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Daily Trend / Spend Breakdown */}
          <Card className="border-sage-200/90 bg-white shadow-soft-xs rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-charcoal-900 text-base">
                    Daily Advertising Performance & Trend
                  </h3>
                  <p className="text-xs text-sage-500">Spend, clicks, and captured leads grouped by day</p>
                </div>
              </div>

              {timeSeries.length === 0 ? (
                <div className="py-12 text-center text-sage-400 text-xs">
                  No advertising spend entries recorded for the selected filter.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-sage-200/90 text-[11px] font-semibold text-sage-600 uppercase bg-sage-50/50">
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Spend</th>
                        <th className="py-3 px-4">Impressions</th>
                        <th className="py-3 px-4">Clicks</th>
                        <th className="py-3 px-4">CTR</th>
                        <th className="py-3 px-4">CPC</th>
                        <th className="py-3 px-4">Leads</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sage-100">
                      {timeSeries.slice(-10).reverse().map((item) => (
                        <tr key={item.date} className="hover:bg-sage-50/50 transition">
                          <td className="py-3.5 px-4 font-mono text-xs text-charcoal-700 font-medium">
                            {item.date}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-charcoal-900">
                            ${item.spend.toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4 text-charcoal-700">
                            {item.impressions.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-charcoal-700">
                            {item.clicks.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-charcoal-700">
                            {item.ctr}%
                          </td>
                          <td className="py-3.5 px-4 text-charcoal-700">
                            ${item.cpc.toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold bg-forest-50 text-forest-800 border border-forest-100">
                              {item.leads}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: CAMPAIGNS BREAKDOWN */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3 rounded-2xl border border-sage-200/90 shadow-soft-xs">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-sage-400" />
              <input
                type="text"
                placeholder="Search campaigns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-sage-200 bg-sage-50/50 text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-brand-800/20 focus:border-brand-800 transition"
              />
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <div className="inline-flex rounded-xl border border-sage-200 p-0.5 bg-sage-50/50 text-xs">
                {['all', 'meta', 'google'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setSelectedPlatform(p)}
                    className={`px-3 py-1.5 rounded-lg capitalize font-medium transition-all ${
                      selectedPlatform === p
                        ? 'bg-brand-800 text-white shadow-soft-xs font-semibold'
                        : 'text-sage-600 hover:text-charcoal-900'
                    }`}
                  >
                    {p === 'all' ? 'All Platforms' : p === 'meta' ? 'Meta Ads' : 'Google Ads'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Campaigns Table */}
          <Card className="border-sage-200/90 bg-white shadow-soft-xs rounded-2xl overflow-hidden">
            {filteredCampaigns.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <Megaphone className="h-10 w-10 text-sage-300 mx-auto" />
                <h4 className="text-base font-semibold text-charcoal-900">No campaigns found</h4>
                <p className="text-xs text-sage-500 max-w-sm mx-auto">
                  {connections.length === 0
                    ? 'Connect an ad account from Meta or Google to start syncing campaigns.'
                    : 'No synced campaigns match your active search filters.'}
                </p>
                {connections.length === 0 && (
                  <Button size="sm" onClick={() => setIsConnectModalOpen(true)} className="mt-2 bg-brand-800 hover:bg-brand-900 text-white rounded-xl">
                    Connect Ad Account
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-sage-200/90 text-[11px] font-semibold text-sage-600 uppercase bg-sage-50/60">
                      <th className="py-3 px-4">Campaign Name</th>
                      <th className="py-3 px-4">Platform</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Total Spend</th>
                      <th className="py-3 px-4">Clicks / CTR</th>
                      <th className="py-3 px-4">Leads</th>
                      <th className="py-3 px-4">CPL</th>
                      <th className="py-3 px-4">Attributed Leads</th>
                      <th className="py-3 px-4 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sage-100">
                    {filteredCampaigns.map((camp) => (
                      <tr
                        key={camp._id}
                        className="hover:bg-sage-50/50 cursor-pointer transition-colors"
                        onClick={() => handleOpenCampaignDrilldown(camp)}
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-charcoal-900 hover:text-forest-800 transition">
                            {camp.name}
                          </div>
                          <div className="text-[11px] text-sage-400 font-mono">{camp.externalCampaignId}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase ${
                              camp.platform === 'meta'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {camp.platform}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge
                            variant={
                              camp.status === 'ACTIVE'
                                ? 'success'
                                : camp.status === 'PAUSED'
                                ? 'warning'
                                : 'neutral'
                            }
                          >
                            {camp.status}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-charcoal-900">
                          ${camp.metrics?.spend?.toFixed(2) || '0.00'}
                        </td>
                        <td className="py-3.5 px-4 text-charcoal-700">
                          {camp.metrics?.clicks || 0}{' '}
                          <span className="text-[11px] text-sage-400 font-normal">({camp.metrics?.ctr || 0}%)</span>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-forest-800">
                          {camp.metrics?.leads || 0}
                        </td>
                        <td className="py-3.5 px-4 text-charcoal-700">
                          ${camp.metrics?.cpl?.toFixed(2) || '0.00'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 font-semibold text-forest-800">
                            <Users className="h-3.5 w-3.5" />
                            {camp.metrics?.attributedLeads || 0}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-sage-400 hover:text-charcoal-800">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 3: LEAD ATTRIBUTION ENGINE */}
      {activeTab === 'attribution' && (
        <div className="space-y-6">
          {/* Attribution Breakdown Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-sage-200/90 bg-white shadow-soft-xs rounded-2xl">
              <CardContent className="p-5">
                <span className="text-xs font-semibold text-sage-500 uppercase tracking-wider">Total Attributed Leads</span>
                <div className="mt-2 text-2xl font-bold text-charcoal-900">
                  {attrSummary ? attrSummary.totalAttributedLeads : 0}
                </div>
                <div className="text-xs text-sage-400 mt-1">Unique CRM contacts linked to ad touchpoints</div>
              </CardContent>
            </Card>

            <Card className="border-sage-200/90 bg-white shadow-soft-xs rounded-2xl">
              <CardContent className="p-5">
                <span className="text-xs font-semibold text-sage-500 uppercase tracking-wider">Touch Type Balance</span>
                <div className="mt-2 flex items-center gap-3 text-xs font-semibold">
                  <span className="text-forest-800">First: {attrSummary?.byTouchType?.first_touch || 0}</span>
                  <span className="text-sage-300">•</span>
                  <span className="text-emerald-700">Last: {attrSummary?.byTouchType?.last_touch || 0}</span>
                  <span className="text-sage-300">•</span>
                  <span className="text-purple-700">Multi: {attrSummary?.byTouchType?.multi_touch || 0}</span>
                </div>
                <div className="text-xs text-sage-400 mt-1">Permanent first-touch record preservation</div>
              </CardContent>
            </Card>

            <Card className="border-sage-200/90 bg-white shadow-soft-xs rounded-2xl">
              <CardContent className="p-5">
                <span className="text-xs font-semibold text-sage-500 uppercase tracking-wider">Top Ad Platform</span>
                <div className="mt-2 text-sm font-semibold text-charcoal-900">
                  Meta: {attrSummary?.byPlatform?.meta || 0} | Google: {attrSummary?.byPlatform?.google || 0}
                </div>
                <div className="text-xs text-sage-400 mt-1">Organic: {attrSummary?.byPlatform?.organic || 0} leads</div>
              </CardContent>
            </Card>
          </div>

          {/* Attribution Table */}
          <Card className="border-sage-200/90 bg-white shadow-soft-xs rounded-2xl overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-charcoal-900 text-base">
                    Multi-Touch Attribution Journey
                  </h3>
                  <p className="text-xs text-sage-500">Every touchpoint linked to CRM Leads with click IDs and UTM parameters</p>
                </div>
              </div>

              {attributions.length === 0 ? (
                <div className="py-12 text-center text-sage-400 text-xs">
                  No lead attribution records registered yet. Form submissions with UTMs or Click IDs will appear here.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-sage-200/90 text-[11px] font-semibold text-sage-600 uppercase bg-sage-50/50">
                        <th className="py-3 px-4">CRM Lead</th>
                        <th className="py-3 px-4">Touch Type</th>
                        <th className="py-3 px-4">Platform</th>
                        <th className="py-3 px-4">Campaign / Ad</th>
                        <th className="py-3 px-4">Click ID / Source</th>
                        <th className="py-3 px-4">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sage-100">
                      {attributions.map((attr) => (
                        <tr key={attr._id} className="hover:bg-sage-50/50 transition">
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-charcoal-900">
                              {attr.leadId?.fullName || 'CRM Contact'}
                            </div>
                            <div className="text-[11px] text-sage-400">{attr.leadId?.email || 'No email'}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <Badge
                              variant={
                                attr.touchType === 'first_touch'
                                  ? 'brand'
                                  : attr.touchType === 'last_touch'
                                  ? 'success'
                                  : 'neutral'
                              }
                            >
                              {attr.touchType.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="capitalize font-semibold text-xs text-charcoal-800">
                              {attr.platform}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="text-xs font-medium text-charcoal-900">
                              {attr.campaignName || attr.utmCampaign || '—'}
                            </div>
                            {attr.utmMedium && (
                              <div className="text-[10px] text-sage-400">
                                {attr.utmSource} / {attr.utmMedium}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs text-sage-500">
                            {attr.clickId ? (
                              <span className="text-forest-800 font-medium">
                                {attr.clickId.length > 20 ? `${attr.clickId.substring(0, 20)}...` : attr.clickId}
                              </span>
                            ) : (
                              <span className="text-sage-400">{attr.attributionSource}</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-sage-400">
                            {new Date(attr.timestamp).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 4: AD ACCOUNTS & CONNECTIONS */}
      {activeTab === 'connections' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-charcoal-900">
                Connected Advertising Accounts
              </h3>
              <p className="text-xs text-sage-500">
                Encrypted API integrations with Meta Marketing API and Google Ads API. Read-only sync.
              </p>
            </div>
            <Button size="sm" onClick={() => setIsConnectModalOpen(true)} className="flex items-center gap-2 bg-brand-800 hover:bg-brand-900 text-white rounded-xl shadow-soft-xs">
              <Plus className="h-4 w-4" />
              Connect Account
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {connections.length === 0 ? (
              <div className="col-span-2 py-16 text-center border-2 border-dashed border-sage-200 rounded-2xl bg-white">
                <ShieldCheck className="h-10 w-10 text-sage-300 mx-auto" />
                <h4 className="text-base font-semibold text-charcoal-900 mt-2">No connected ad platforms</h4>
                <p className="text-xs text-sage-500 max-w-sm mx-auto mt-1">
                  Connect Meta or Google Ads with encrypted credentials to ingest campaign spend and lead performance.
                </p>
                <Button size="sm" onClick={() => setIsConnectModalOpen(true)} className="mt-4 bg-brand-800 hover:bg-brand-900 text-white rounded-xl">
                  Connect First Account
                </Button>
              </div>
            ) : (
              connections.map((conn) => (
                <Card key={conn._id} className="border-sage-200/90 bg-white shadow-soft-xs rounded-2xl">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                            conn.platform === 'meta'
                              ? 'bg-blue-600 text-white shadow-soft-xs'
                              : 'bg-amber-500 text-white shadow-soft-xs'
                          }`}
                        >
                          {conn.platform === 'meta' ? 'M' : 'G'}
                        </div>
                        <div>
                          <h4 className="font-semibold text-charcoal-900 text-base">
                            {conn.accountName}
                          </h4>
                          <span className="text-xs text-sage-400 font-mono">ID: {conn.accountId}</span>
                        </div>
                      </div>
                      <Badge
                        variant={
                          conn.status === 'active'
                            ? 'success'
                            : conn.status === 'expired'
                            ? 'warning'
                            : 'danger'
                        }
                      >
                        {conn.status}
                      </Badge>
                    </div>

                    <div className="pt-2 border-t border-sage-100 text-xs space-y-1.5 text-sage-500">
                      <div className="flex justify-between">
                        <span>Platform:</span>
                        <span className="font-semibold uppercase text-charcoal-800">
                          {conn.platform === 'meta' ? 'Meta Marketing API' : 'Google Ads API'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Credential Storage:</span>
                        <span className="text-forest-800 font-medium">AES-256-GCM Encrypted</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Last Synced:</span>
                        <span>{conn.lastSyncAt ? new Date(conn.lastSyncAt).toLocaleString() : 'Never'}</span>
                      </div>
                      {conn.lastSyncError && (
                        <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px] mt-2">
                          Error: {conn.lastSyncError}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-sage-100 flex items-center justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSyncSingle(conn._id)}
                        disabled={syncingId === conn._id || conn.status === 'revoked'}
                        className="text-xs flex items-center gap-1.5 rounded-xl border-sage-200"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${syncingId === conn._id ? 'animate-spin' : ''}`} />
                        {syncingId === conn._id ? 'Syncing...' : 'Sync Now'}
                      </Button>

                      {conn.status !== 'revoked' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevoke(conn._id, conn.accountName)}
                          className="text-rose-600 hover:text-rose-700 text-xs flex items-center gap-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Disconnect
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: DRILLDOWN INTO AD SETS & CREATIVES */}
      {selectedCampaign && (
        <div className="fixed inset-0 z-50 bg-charcoal-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-sage-200/90 rounded-3xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-sage-100 flex items-center justify-between bg-sage-50/40">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                      selectedCampaign.platform === 'meta'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {selectedCampaign.platform}
                  </span>
                  <h3 className="text-lg font-bold text-charcoal-900">
                    {selectedCampaign.name}
                  </h3>
                </div>
                <p className="text-xs text-sage-400 font-mono mt-1">ID: {selectedCampaign.externalCampaignId}</p>
              </div>
              <button
                onClick={() => setSelectedCampaign(null)}
                className="text-sage-400 hover:text-charcoal-700 p-1.5 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs">
              {/* Campaign Performance Highlight */}
              <div className="grid grid-cols-4 gap-3 text-center bg-forest-50/50 border border-forest-100 p-4 rounded-2xl">
                <div>
                  <div className="text-[11px] text-sage-500">Spend</div>
                  <div className="text-base font-bold text-charcoal-900 mt-0.5">
                    ${selectedCampaign.metrics?.spend?.toFixed(2) || '0.00'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-sage-500">Clicks</div>
                  <div className="text-base font-bold text-charcoal-900 mt-0.5">
                    {selectedCampaign.metrics?.clicks || 0}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-sage-500">CTR / CPC</div>
                  <div className="text-base font-bold text-charcoal-900 mt-0.5">
                    {selectedCampaign.metrics?.ctr || 0}% / ${selectedCampaign.metrics?.cpc?.toFixed(2) || '0.00'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-sage-500">Attributed CRM Leads</div>
                  <div className="text-base font-bold text-forest-800 mt-0.5">
                    {selectedCampaign.metrics?.attributedLeads || 0}
                  </div>
                </div>
              </div>

              {/* Ad Sets Section */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-sage-600 mb-2.5">Ad Sets / Ad Groups</h4>
                {loadingDrilldown ? (
                  <div className="py-6 text-center text-xs text-sage-400">Loading ad sets...</div>
                ) : campaignAdSets.length === 0 ? (
                  <div className="py-6 text-center text-xs text-sage-400">No ad sets synced for this campaign.</div>
                ) : (
                  <div className="space-y-2">
                    {campaignAdSets.map((set) => (
                      <div
                        key={set._id}
                        className="p-3 rounded-xl border border-sage-200 bg-sage-50/40 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-semibold text-charcoal-900">{set.name}</div>
                          <div className="text-sage-400 font-mono text-[11px]">{set.externalAdSetId}</div>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-charcoal-900">${set.metrics?.spend?.toFixed(2) || '0.00'} spend</span>
                          <div className="text-sage-400">{set.metrics?.clicks || 0} clicks</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ad Creatives Section */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-sage-600 mb-2.5">Ad Creatives & Copy</h4>
                {loadingDrilldown ? (
                  <div className="py-6 text-center text-xs text-sage-400">Loading ad creatives...</div>
                ) : campaignAds.length === 0 ? (
                  <div className="py-6 text-center text-xs text-sage-400">No ad creatives synced.</div>
                ) : (
                  <div className="space-y-3">
                    {campaignAds.map((ad) => (
                      <div
                        key={ad._id}
                        className="p-3.5 rounded-xl border border-sage-200 bg-sage-50/40 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-charcoal-900">{ad.name}</span>
                          <span className="font-mono text-[11px] text-sage-400">{ad.externalAdId}</span>
                        </div>
                        {ad.headline && (
                          <div className="font-medium text-forest-800">"{ad.headline}"</div>
                        )}
                        {ad.bodyText && <div className="text-charcoal-700">{ad.bodyText}</div>}
                        {ad.destinationUrl && (
                          <div className="text-[11px] text-sage-400 truncate flex items-center gap-1">
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            {ad.destinationUrl}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-sage-100 flex justify-end bg-sage-50/30">
              <Button variant="outline" size="sm" onClick={() => setSelectedCampaign(null)} className="rounded-xl border-sage-200">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CONNECT AD ACCOUNT */}
      {isConnectModalOpen && (
        <div className="fixed inset-0 z-50 bg-charcoal-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-sage-200/90 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-sage-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-forest-50 text-forest-800 border border-forest-100">
                  <KeyRound className="h-5 w-5" />
                </span>
                <h3 className="text-lg font-bold text-charcoal-900">
                  Connect Advertising Account
                </h3>
              </div>
              <button
                onClick={() => setIsConnectModalOpen(false)}
                className="text-sage-400 hover:text-charcoal-700 p-1.5 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleConnectSubmit} className="p-6 space-y-4 text-xs">
              {/* Platform Selector */}
              <div>
                <label className="block text-xs font-semibold text-charcoal-800 uppercase tracking-wider mb-2">
                  Ad Platform
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setConnectPlatform('meta')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      connectPlatform === 'meta'
                        ? 'border-forest-700 bg-forest-50 text-forest-900 shadow-soft-xs font-semibold'
                        : 'border-sage-200 hover:border-sage-300'
                    }`}
                  >
                    <div className="font-semibold text-sm">Meta Marketing API</div>
                    <div className="text-xs text-sage-500 mt-0.5">Facebook & Instagram Ads</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConnectPlatform('google')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      connectPlatform === 'google'
                        ? 'border-forest-700 bg-forest-50 text-forest-900 shadow-soft-xs font-semibold'
                        : 'border-sage-200 hover:border-sage-300'
                    }`}
                  >
                    <div className="font-semibold text-sm">Google Ads API</div>
                    <div className="text-xs text-sage-500 mt-0.5">Search, YouTube & Display</div>
                  </button>
                </div>
              </div>

              {/* Account Name */}
              <div>
                <label className="block text-xs font-semibold text-charcoal-800 uppercase tracking-wider mb-1.5">
                  Account Display Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Corp Main Ad Account"
                  value={connectAccountName}
                  onChange={(e) => setConnectAccountName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-sage-200 bg-white text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-brand-800/20 focus:border-brand-800 transition"
                />
              </div>

              {/* Account ID */}
              <div>
                <label className="block text-xs font-semibold text-charcoal-800 uppercase tracking-wider mb-1.5">
                  External Account ID
                </label>
                <input
                  type="text"
                  required
                  placeholder={connectPlatform === 'meta' ? 'act_123456789' : '123-456-7890'}
                  value={connectAccountId}
                  onChange={(e) => setConnectAccountId(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-sage-200 bg-white text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-brand-800/20 focus:border-brand-800 transition font-mono"
                />
              </div>

              {/* Access Token */}
              <div>
                <label className="block text-xs font-semibold text-charcoal-800 uppercase tracking-wider mb-1.5">
                  Access Token
                </label>
                <input
                  type="password"
                  required
                  placeholder="EAA..."
                  value={connectAccessToken}
                  onChange={(e) => setConnectAccessToken(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-sage-200 bg-white text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-brand-800/20 focus:border-brand-800 transition font-mono"
                />
                <p className="mt-1.5 text-[11px] text-sage-500 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-forest-600" />
                  Tokens are encrypted with AES-256-GCM and never logged or exposed.
                </p>
                <div className="mt-1 text-[11px] text-forest-800">
                  Tip: For testing, you can use mock token{' '}
                  <span className="font-mono bg-sage-100 px-1 rounded">mock_meta_token_dev</span> or{' '}
                  <span className="font-mono bg-sage-100 px-1 rounded">mock_google_token_dev</span>
                </div>
              </div>

              <div className="pt-4 border-t border-sage-100 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsConnectModalOpen(false)}
                  className="rounded-xl border-sage-200"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingConnect}
                  className="bg-brand-800 hover:bg-brand-900 text-white rounded-xl shadow-soft-xs px-4"
                >
                  {isSubmittingConnect ? 'Connecting & Verifying...' : 'Save & Connect'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
