'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import {
  FileSpreadsheet,
  Search,
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Shield,
  Clock,
  Eye,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { getAuditLogsApi, AuditLogItem } from '@/lib/clients';
import { getErrorMessage } from '@/lib/api';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [actionFilter, setActionFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected Log Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAuditLogsApi({
        page,
        limit: 15,
        action: actionFilter !== 'all' ? actionFilter : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      setLogs(data.logs);
      setTotalCount(data.pagination.total);
      setTotalPages(data.pagination.totalPages || 1);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [page, actionFilter, startDate, endDate]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="border-b border-sage-200/80 pb-5">
        <h1 className="text-xl font-bold text-charcoal-900 flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-forest-50 border border-forest-100 text-brand-800">
            <FileSpreadsheet className="h-5 w-5" />
          </span>
          Audit Trail & Security Logs
        </h1>
        <p className="text-xs text-sage-500 mt-1">
          Immutable audit log capturing authentication events, workspace switching, client administration, and RBAC actions.
        </p>
      </div>

      {/* Filter Bar */}
      <Card className="border-sage-200/90 shadow-soft-xs rounded-2xl bg-white">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-semibold text-sage-500">Action Filter:</label>
              <select
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full text-xs py-1.5 px-2.5 border border-sage-200 rounded-xl bg-white text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-brand-800/20 focus:border-brand-800"
              >
                <option value="all">All Actions</option>
                <option value="auth.">Authentication Events</option>
                <option value="client.">Client Administration</option>
                <option value="auth.workspace_switch">Workspace Switches</option>
                <option value="auth.client_access.violation">Access Violations</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[11px] font-semibold text-sage-500">From:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="w-full text-xs py-1.5 px-2.5 border border-sage-200 rounded-xl bg-white text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-brand-800/20 focus:border-brand-800"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[11px] font-semibold text-sage-500">To:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="w-full text-xs py-1.5 px-2.5 border border-sage-200 rounded-xl bg-white text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-brand-800/20 focus:border-brand-800"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Audit Log Table */}
      <Card className="border-sage-200/90 overflow-hidden shadow-soft-xs rounded-2xl bg-white">
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center text-sage-400 gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-brand-800" />
            <span className="text-xs font-medium">Loading audit trail...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-20 text-center text-sage-400 space-y-2">
            <Shield className="h-10 w-10 mx-auto text-sage-300 mb-2" />
            <p className="text-sm font-bold text-charcoal-900">No audit logs found</p>
            <p className="text-xs text-sage-500 mt-1">Try broadening your date or action filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#FAFBF9] border-b border-sage-200/80 text-[11px] font-semibold text-sage-600 uppercase">
                  <th className="py-3 px-5">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Client Context</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sage-100">
                {logs.map((log) => {
                  const isViolation = !log.success || log.action.includes('denied') || log.action.includes('violation');
                  return (
                    <tr key={log._id} className="hover:bg-forest-50/40 transition-colors">
                      <td className="py-3 px-5 text-sage-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono font-medium text-charcoal-900 bg-sage-100/70 px-2 py-0.5 rounded-md text-[11px]">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-charcoal-900 font-medium">
                        {log.userId?.name || log.userEmail || <span className="italic text-sage-400">System</span>}
                      </td>
                      <td className="py-3 px-4 text-sage-600">
                        {log.clientId?.name || <span className="text-sage-400 italic">Global</span>}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={isViolation ? 'danger' : 'success'}>
                          {isViolation ? 'Violation' : 'Success'}
                        </Badge>
                      </td>
                      <td className="py-3 px-5 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                          className="h-6 px-2.5 text-[10px] gap-1 border-sage-200/90 rounded-lg hover:bg-sage-50 text-charcoal-900"
                        >
                          <Eye className="h-3 w-3" />
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {logs.length > 0 && (
          <div className="px-5 py-3.5 border-t border-sage-100 bg-[#FAFBF9] flex items-center justify-between text-xs text-sage-600">
            <span>
              Showing {logs.length} of {totalCount} log records
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-7 px-2 border-sage-200/90 rounded-lg"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="px-2 font-semibold text-charcoal-900">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || isLoading}
                onClick={() => setPage((p) => p + 1)}
                className="h-7 px-2 border-sage-200/90 rounded-lg"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Safe Metadata Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-soft-xl max-w-lg w-full border border-sage-200/90 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-sage-100 bg-surface/50">
              <h3 className="text-xs font-bold text-charcoal-900 flex items-center gap-2">
                <span className="p-1 rounded-lg bg-forest-50 text-brand-800">
                  <Shield className="h-4 w-4" />
                </span>
                Audit Record Details
              </h3>
              <button onClick={() => setSelectedLog(null)} className="text-sage-400 hover:text-charcoal-900 p-1">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-sage-400 font-semibold block">Action:</span>
                  <span className="font-mono text-charcoal-900 font-semibold">{selectedLog.action}</span>
                </div>
                <div>
                  <span className="text-sage-400 font-semibold block">IP Address:</span>
                  <span className="font-mono text-charcoal-900">{selectedLog.ipAddress || 'unknown'}</span>
                </div>
              </div>

              <div>
                <span className="text-sage-400 font-semibold block">Timestamp:</span>
                <span className="text-charcoal-900">{new Date(selectedLog.createdAt).toUTCString()}</span>
              </div>

              <div>
                <span className="text-sage-400 font-semibold block mb-1.5">Sanitized Metadata:</span>
                <pre className="bg-charcoal-900 text-sage-100 p-3.5 rounded-xl text-[11px] overflow-x-auto font-mono">
                  {JSON.stringify(selectedLog.metadata || {}, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
