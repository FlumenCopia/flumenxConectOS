'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  FileText,
  Search,
  Filter,
  Clock,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
  User,
  ShieldCheck,
  ShieldAlert,
  Inbox,
  ArrowUpRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  listStaffCustomerRequestsApi,
  StaffCustomerRequestItem,
  RequestStatus,
  RequestPriority,
} from '@/lib/api/clientPortal';

export default function ClientRequestsPage() {
  const [requests, setRequests] = useState<StaffCustomerRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchRequests = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const response = await listStaffCustomerRequestsApi({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        search: searchQuery ? searchQuery.trim() : undefined,
      });

      if (response.success && response.data) {
        setRequests(response.data.requests || []);
      } else {
        setRequests([]);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load customer service requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, categoryFilter, searchQuery]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Derived filtered requests for client-side search/priority
  const filteredRequests = requests.filter((req) => {
    if (priorityFilter !== 'all' && req.priority !== priorityFilter) return false;
    return true;
  });

  // Calculate high-level summary counts
  const totalCount = requests.length;
  const pendingReviewCount = requests.filter(
    (r) => r.status === 'submitted' || r.status === 'under_review'
  ).length;
  const inProgressCount = requests.filter((r) => r.status === 'in_progress').length;
  const completedCount = requests.filter((r) => r.status === 'completed' || r.status === 'closed').length;

  const getStatusBadge = (status: RequestStatus) => {
    switch (status) {
      case 'submitted':
        return <Badge variant="info">Submitted</Badge>;
      case 'under_review':
        return <Badge variant="warning">Under Review</Badge>;
      case 'in_progress':
        return <Badge variant="brand">In Progress</Badge>;
      case 'completed':
        return <Badge variant="success">Completed</Badge>;
      case 'closed':
        return <Badge variant="neutral">Closed</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: RequestPriority) => {
    switch (priority) {
      case 'urgent':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
            <AlertTriangle className="h-3 w-3" />
            Urgent
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
            High
          </span>
        );
      case 'normal':
        return (
          <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
            Normal
          </span>
        );
      case 'low':
        return (
          <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-200">
            Low
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-brand-50 text-brand-700">
              <FileText className="h-5 w-5" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Customer Service Requests & Support Tickets
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Monitor, prioritize, and respond to inquiries submitted by client contacts through the Customer Portal.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchRequests(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-brand-600' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>

          <Link href="/client/portal-users">
            <Button size="sm" variant="outline" className="flex items-center gap-1.5 text-xs">
              <User className="h-3.5 w-3.5" />
              Manage Portal Users
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <span>Total Requests</span>
              <Inbox className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{totalCount}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">All customer inquiries</div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 shadow-sm bg-amber-50/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-amber-800 text-xs font-semibold uppercase tracking-wider">
              <span>Awaiting Review</span>
              <AlertCircle className="h-4 w-4 text-amber-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-900">{pendingReviewCount}</div>
            <div className="text-[11px] text-amber-700 mt-0.5">Requires staff triage</div>
          </CardContent>
        </Card>

        <Card className="border-brand-200 shadow-sm bg-brand-50/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-brand-800 text-xs font-semibold uppercase tracking-wider">
              <span>In Progress</span>
              <Clock className="h-4 w-4 text-brand-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-brand-900">{inProgressCount}</div>
            <div className="text-[11px] text-brand-700 mt-0.5">Actively being resolved</div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 shadow-sm bg-emerald-50/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-emerald-800 text-xs font-semibold uppercase tracking-wider">
              <span>Completed / Closed</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-900">{completedCount}</div>
            <div className="text-[11px] text-emerald-700 mt-0.5">Resolved requests</div>
          </CardContent>
        </Card>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by subject, request #, or contact..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="all">All Statuses</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under Review</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="closed">Closed</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
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

      {/* Requests Table */}
      <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
            <RefreshCw className="h-6 w-6 animate-spin text-brand-600" />
            <span className="text-xs">Loading customer requests...</span>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <Inbox className="h-10 w-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-800">No requests found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all'
                ? 'No requests match your selected filters.'
                : 'Customer requests and inquiries submitted through the Customer Portal will appear here.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
                  <th className="py-3 px-4">Ticket</th>
                  <th className="py-3 px-4">Subject & Description</th>
                  <th className="py-3 px-4">Customer Contact</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Attachments</th>
                  <th className="py-3 px-4">Submitted</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.map((req) => {
                  const customerName =
                    typeof req.portalUserId === 'object' && req.portalUserId !== null
                      ? req.portalUserId.name
                      : typeof req.contactId === 'object' && req.contactId !== null
                      ? req.contactId.name || 'Customer'
                      : 'Customer';

                  const customerEmail =
                    typeof req.portalUserId === 'object' && req.portalUserId !== null
                      ? req.portalUserId.email
                      : typeof req.contactId === 'object' && req.contactId !== null
                      ? req.contactId.email || '—'
                      : '—';

                  const hasQuarantine = req.attachments?.some((a) => a.scanStatus === 'pending');
                  const hasMalicious = req.attachments?.some((a) => a.scanStatus === 'malicious');

                  return (
                    <tr
                      key={req._id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    >
                      <td className="py-3.5 px-4 font-mono font-semibold text-brand-700 whitespace-nowrap">
                        <Link
                          href={`/client/requests/${req._id}`}
                          className="hover:underline flex items-center gap-1"
                        >
                          {req.requestNumber}
                          <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <Link href={`/client/requests/${req._id}`} className="block">
                          <p className="font-semibold text-slate-900 truncate hover:text-brand-700">
                            {req.subject}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {req.description}
                          </p>
                        </Link>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                            {customerName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-slate-800">{customerName}</p>
                            <p className="text-[10px] text-slate-400">{customerEmail}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="capitalize text-slate-700 font-medium">
                          {req.category.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getPriorityBadge(req.priority)}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getStatusBadge(req.status)}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {req.attachments && req.attachments.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
                            <Paperclip className="h-3 w-3 text-slate-400" />
                            {req.attachments.length}
                            {hasMalicious ? (
                              <span title="Malware detected">
                                <ShieldAlert className="h-3.5 w-3.5 text-rose-500 ml-1" />
                              </span>
                            ) : hasQuarantine ? (
                              <span title="Quarantine scanning">
                                <Clock className="h-3.5 w-3.5 text-amber-500 ml-1" />
                              </span>
                            ) : (
                              <span title="Scanned clean">
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 ml-1" />
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap text-[11px]">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <Link href={`/client/requests/${req._id}`}>
                          <Button variant="outline" size="sm" className="h-7 text-[11px] px-2.5">
                            View Thread
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
