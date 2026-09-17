'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Send,
  Paperclip,
  User,
  ShieldCheck,
  ShieldAlert,
  Download,
  Lock,
  MessageSquare,
  RefreshCw,
  Eye,
  EyeOff,
  UserCheck,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  listStaffCustomerRequestsApi,
  updateStaffCustomerRequestApi,
  addStaffRequestMessageApi,
  downloadStaffAttachmentApi,
  StaffCustomerRequestItem,
  StaffRequestMessage,
  StaffRequestAttachment,
  RequestStatus,
  RequestPriority,
} from '@/lib/api/clientPortal';

export default function ClientRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const requestId = params.id as string;

  const [request, setRequest] = useState<StaffCustomerRequestItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Message Composer State
  const [messageBody, setMessageBody] = useState('');
  const [isCustomerVisible, setIsCustomerVisible] = useState(true);

  const fetchRequest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listStaffCustomerRequestsApi();
      if (response.success && response.data) {
        const found = response.data.requests.find((r) => r._id === requestId);
        if (found) {
          setRequest(found);
        } else {
          setError('Customer request not found or access denied.');
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load request details');
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    if (requestId) {
      fetchRequest();
    }
  }, [requestId, fetchRequest]);

  // Status Change Handler
  const handleStatusChange = async (newStatus: RequestStatus) => {
    if (!request) return;
    setUpdatingStatus(true);
    setError(null);
    try {
      const response = await updateStaffCustomerRequestApi(requestId, {
        status: newStatus,
      });
      if (response.success && response.data?.request) {
        setRequest(response.data.request);
        setSuccess(`Status updated to ${newStatus.replace('_', ' ')}`);
        setTimeout(() => setSuccess(null), 4000);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Priority Change Handler
  const handlePriorityChange = async (newPriority: RequestPriority) => {
    if (!request) return;
    setUpdatingStatus(true);
    setError(null);
    try {
      const response = await updateStaffCustomerRequestApi(requestId, {
        priority: newPriority,
      });
      if (response.success && response.data?.request) {
        setRequest(response.data.request);
        setSuccess(`Priority updated to ${newPriority}`);
        setTimeout(() => setSuccess(null), 4000);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to update priority');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Reply / Note Submission
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageBody.trim() || !request) return;

    setSendingMessage(true);
    setError(null);
    try {
      const response = await addStaffRequestMessageApi(requestId, {
        body: messageBody.trim(),
        isCustomerVisible,
      });

      if (response.success && response.data?.request) {
        setRequest(response.data.request);
        setMessageBody('');
        setSuccess(
          isCustomerVisible
            ? 'Customer reply dispatched successfully.'
            : 'Internal staff note logged successfully.'
        );
        setTimeout(() => setSuccess(null), 4000);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to add message');
    } finally {
      setSendingMessage(false);
    }
  };

  // Attachment Download via Malware Scanning Gate
  const handleDownloadAttachment = async (attachment: StaffRequestAttachment) => {
    if (attachment.scanStatus === 'pending') {
      alert('This attachment is currently undergoing security scanning in quarantine and is not yet available for download (HTTP 423 Locked).');
      return;
    }
    if (attachment.scanStatus === 'malicious') {
      alert('This attachment was flagged as malicious and permanently quarantined. Access is blocked (HTTP 403 Forbidden).');
      return;
    }
    if (attachment.scanStatus === 'scan_failed') {
      alert('Security scanning failed for this attachment. Download is blocked until re-scan completes.');
      return;
    }

    setDownloadingId(attachment.id);
    try {
      const res = await downloadStaffAttachmentApi(requestId, attachment.id);
      if (res.success && res.data?.url) {
        window.open(res.data.url, '_blank');
      } else {
        alert('Failed to retrieve authorized download token.');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Download authorization failed.');
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-2">
        <RefreshCw className="h-6 w-6 animate-spin text-brand-600" />
        <span className="text-xs">Loading customer request thread...</span>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="py-16 text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-slate-300 mx-auto" />
        <h2 className="text-base font-semibold text-slate-900">Request Not Found</h2>
        <p className="text-xs text-slate-500">{error || 'The requested ticket does not exist or has been removed.'}</p>
        <Link href="/client/requests">
          <Button variant="outline" size="sm">
            Back to Customer Requests
          </Button>
        </Link>
      </div>
    );
  }

  const customerName =
    typeof request.portalUserId === 'object' && request.portalUserId !== null
      ? request.portalUserId.name
      : typeof request.contactId === 'object' && request.contactId !== null
      ? request.contactId.name || 'Customer Contact'
      : 'Customer Contact';

  const customerEmail =
    typeof request.portalUserId === 'object' && request.portalUserId !== null
      ? request.portalUserId.email
      : typeof request.contactId === 'object' && request.contactId !== null
      ? request.contactId.email || '—'
      : '—';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/client/requests"
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-brand-700">{request.requestNumber}</span>
              <span className="text-slate-300">•</span>
              <h1 className="text-lg font-bold text-slate-900">{request.subject}</h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Submitted on {new Date(request.createdAt).toLocaleString()} by {customerName}
            </p>
          </div>
        </div>

        {/* Status / Priority Control Dropdowns */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500">Status:</span>
            <select
              value={request.status}
              disabled={updatingStatus}
              onChange={(e) => handleStatusChange(e.target.value as RequestStatus)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="submitted">Submitted</option>
              <option value="under_review">Under Review</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500">Priority:</span>
            <select
              value={request.priority}
              disabled={updatingStatus}
              onChange={(e) => handlePriorityChange(e.target.value as RequestPriority)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid: Main Thread vs Sidebar Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Description & Message Thread */}
        <div className="lg:col-span-2 space-y-6">
          {/* Original Request Details */}
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-brand-100 text-brand-800 flex items-center justify-center font-bold text-xs">
                    {customerName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">{customerName}</p>
                    <p className="text-[10px] text-slate-400">Customer Initial Request</p>
                  </div>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {new Date(request.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                {request.description}
              </div>

              {/* Initial Attachments */}
              {request.attachments && request.attachments.length > 0 && (
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Attached Files ({request.attachments.length})
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {request.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-slate-50/60 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Paperclip className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <div className="truncate">
                            <p className="font-medium text-slate-800 truncate">{att.name}</p>
                            <p className="text-[10px] text-slate-400">{(att.size / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          {att.scanStatus === 'clean' ? (
                            <button
                              type="button"
                              onClick={() => handleDownloadAttachment(att)}
                              disabled={downloadingId === att.id}
                              className="p-1 rounded text-brand-600 hover:bg-brand-50"
                              title="Download clean file"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                          ) : att.scanStatus === 'malicious' ? (
                            <span className="text-[10px] font-semibold text-rose-600 flex items-center gap-0.5">
                              <ShieldAlert className="h-3.5 w-3.5" /> Blocked
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-amber-600 flex items-center gap-0.5">
                              <Clock className="h-3.5 w-3.5" /> Scanning
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Conversation Timeline */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Conversation Trail ({request.messages?.length || 0})
            </h3>

            {request.messages && request.messages.length > 0 ? (
              request.messages.map((msg) => {
                const isInternalNote = !msg.isCustomerVisible || msg.authorType === 'staff' && !msg.isCustomerVisible;
                const isStaffReply = msg.authorType === 'staff' && msg.isCustomerVisible;

                return (
                  <div
                    key={msg.id}
                    className={`rounded-xl border p-4 text-xs transition-all ${
                      isInternalNote
                        ? 'bg-amber-50/60 border-amber-200'
                        : isStaffReply
                        ? 'bg-brand-50/40 border-brand-200'
                        : 'bg-white border-slate-200 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b pb-2 mb-2 border-slate-200/60">
                      <div className="flex items-center gap-2">
                        {isInternalNote ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-200/80 text-amber-900 font-bold text-[10px] uppercase tracking-wider">
                            <Lock className="h-3 w-3" />
                            Internal Staff Note
                          </span>
                        ) : isStaffReply ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-brand-200/80 text-brand-900 font-semibold text-[10px]">
                            <UserCheck className="h-3 w-3" />
                            Staff Response (Customer Visible)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-semibold text-[10px]">
                            <User className="h-3 w-3" />
                            Customer Reply
                          </span>
                        )}
                        <span className="font-semibold text-slate-800">{msg.authorName}</span>
                      </div>

                      <span className="text-[10px] text-slate-400">
                        {new Date(msg.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{msg.body}</p>

                    {/* Message Attachments */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-slate-200/60 flex flex-wrap gap-2">
                        {msg.attachments.map((att) => (
                          <button
                            key={att.id}
                            type="button"
                            onClick={() => handleDownloadAttachment(att)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-[11px]"
                          >
                            <Paperclip className="h-3 w-3 text-slate-400" />
                            <span>{att.name}</span>
                            <Download className="h-3 w-3 ml-1 text-slate-400" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                No replies posted yet. Use the composer below to reply to the customer or leave an internal note.
              </div>
            )}
          </div>

          {/* Reply / Internal Note Composer */}
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardContent className="p-5">
              <form onSubmit={handleSendMessage} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-bold text-slate-700">Compose Message:</span>
                    <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100 text-xs">
                      <button
                        type="button"
                        onClick={() => setIsCustomerVisible(true)}
                        className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                          isCustomerVisible
                            ? 'bg-white text-brand-700 shadow-sm font-semibold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Customer Reply
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsCustomerVisible(false)}
                        className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                          !isCustomerVisible
                            ? 'bg-amber-100 text-amber-900 shadow-sm font-semibold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Lock className="h-3.5 w-3.5" />
                        Internal Staff Note
                      </button>
                    </div>
                  </div>

                  {!isCustomerVisible && (
                    <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-medium">
                      Hidden from Customer Portal
                    </span>
                  )}
                </div>

                <textarea
                  rows={4}
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  placeholder={
                    isCustomerVisible
                      ? 'Type your response to the customer...'
                      : 'Record internal operational notes, tasks, or remarks...'
                  }
                  className="w-full text-xs p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />

                <div className="flex items-center justify-between pt-2">
                  <p className="text-[11px] text-slate-400">
                    {isCustomerVisible
                      ? 'Customer will be notified and can view this message in their portal.'
                      : 'Internal notes are strictly excluded from customer portal API queries.'}
                  </p>

                  <Button
                    type="submit"
                    size="sm"
                    disabled={sendingMessage || !messageBody.trim()}
                    className={
                      isCustomerVisible
                        ? 'bg-brand-600 hover:bg-brand-700 text-white flex items-center gap-1.5'
                        : 'bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5'
                    }
                  >
                    <Send className="h-3.5 w-3.5" />
                    {sendingMessage
                      ? 'Sending...'
                      : isCustomerVisible
                      ? 'Send Customer Reply'
                      : 'Save Internal Note'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Ticket & Customer Metadata */}
        <div className="space-y-6">
          {/* Customer Profile Card */}
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardContent className="p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Customer Information
              </h3>

              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm">
                  {customerName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-xs">{customerName}</p>
                  <p className="text-[11px] text-slate-400">{customerEmail}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Portal Account:</span>
                  <Badge variant="success">Active</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Category:</span>
                  <span className="capitalize font-medium text-slate-700">
                    {request.category.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Current Priority:</span>
                  <span className="capitalize font-semibold text-slate-800">{request.priority}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security & Malware Defense Status */}
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-brand-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Malware Gating & Security
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                All attachments are ingested into isolated quarantine storage and evaluated against ClamAV malware signatures.
                Staff downloads issue 15-minute expiring HMAC tokens.
              </p>
              <div className="text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-mono text-slate-600">
                Gate: Enforced (423 Locked / 403 Blocked)
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
