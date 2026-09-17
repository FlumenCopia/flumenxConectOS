'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  portalGetRequestApi,
  portalAddRequestMessageApi,
  CustomerRequestItem,
} from '@/lib/api/portal';
import {
  ArrowLeft,
  Clock,
  Send,
  Paperclip,
  User,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  FileText,
  Download,
  Loader2,
  X,
  UploadCloud,
} from 'lucide-react';

export default function PortalRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const requestId = params.id as string;

  const [request, setRequest] = useState<CustomerRequestItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyBody, setReplyBody] = useState('');
  const [attachments, setAttachments] = useState<
    Array<{ id: string; name: string; url: string; size: number; mimeType: string }>
  >([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchRequest = async () => {
    try {
      const data = await portalGetRequestApi(requestId);
      setRequest(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load request details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (requestId) {
      fetchRequest();
    }
  }, [requestId]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    if (attachments.length + e.target.files.length > 5) {
      setError('Maximum of 5 attachments allowed per message.');
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
        url: URL.createObjectURL(file),
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
      };
    });

    setAttachments([...attachments, ...newItems]);
    setError(null);
  };

  const removeAttachment = (id: string) => {
    setAttachments(attachments.filter((a) => a.id !== id));
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyBody.trim()) return;

    setSending(true);
    setError(null);
    setSuccess(null);

    try {
      const idempotencyKey = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const updated = await portalAddRequestMessageApi(requestId, {
        body: replyBody.trim(),
        attachments,
        idempotencyKey,
      });

      setRequest(updated);
      setReplyBody('');
      setAttachments([]);
      setSuccess('Reply submitted successfully.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send reply.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
        <p className="text-sm">Loading request details...</p>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-white">Request Not Found</h2>
        <p className="text-sm text-slate-400">
          The requested ticket does not exist or you do not have permission to access it.
        </p>
        <Link
          href="/portal/requests"
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-sm hover:bg-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Requests</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Back link */}
      <div>
        <Link
          id="back-to-requests-link"
          href="/portal/requests"
          className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to all requests</span>
        </Link>
      </div>

      {/* Header Card */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <span className="text-sm font-mono font-bold text-indigo-400">{request.requestNumber}</span>
              <span className="text-xs uppercase tracking-wider font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {request.category.replace('_', ' ')}
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Priority: {request.priority}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">{request.subject}</h1>
          </div>

          <span
            id="request-status-badge"
            className={`self-start sm:self-center text-xs font-semibold px-3 py-1.5 rounded-xl capitalize ${
              request.status === 'completed'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : request.status === 'in_progress'
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                : request.status === 'closed'
                ? 'bg-slate-800 text-slate-400 border border-slate-700'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}
          >
            {request.status.replace('_', ' ')}
          </span>
        </div>

        {/* Initial Description */}
        <div className="pt-4 border-t border-slate-800/80">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Original Request</h3>
          <p className="text-sm text-slate-200 whitespace-pre-line leading-relaxed">{request.description}</p>

          {request.attachments?.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-800/60">
              <h4 className="text-xs font-medium text-slate-400 mb-2">Request Attachments:</h4>
              <div className="flex flex-wrap gap-2">
                {request.attachments.map((att) => (
                  <a
                    key={att.id}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-indigo-300 hover:text-indigo-200 hover:bg-slate-700 transition-colors"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>{att.name}</span>
                    <Download className="w-3 h-3 text-slate-400" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Messages Thread */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white tracking-tight">Conversation Thread</h2>

        {request.messages.length === 0 ? (
          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 text-center text-slate-400 text-xs">
            No follow-up messages yet. A support agent will respond here shortly.
          </div>
        ) : (
          <div className="space-y-4">
            {request.messages.map((msg) => {
              const isCustomer = msg.authorType === 'customer';
              return (
                <div
                  key={msg.id}
                  className={`p-5 rounded-2xl border ${
                    isCustomer
                      ? 'bg-slate-900/90 border-slate-800 ml-4 sm:ml-12'
                      : 'bg-indigo-950/20 border-indigo-500/20 mr-4 sm:mr-12'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                          isCustomer
                            ? 'bg-slate-800 text-slate-300'
                            : 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                        }`}
                      >
                        {isCustomer ? 'You' : 'Staff'}
                      </div>
                      <span className="text-xs font-semibold text-white">
                        {isCustomer ? 'You' : msg.authorName || 'Support Representative'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      {new Date(msg.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-sm text-slate-200 whitespace-pre-line leading-relaxed pl-9">
                    {msg.body}
                  </p>

                  {msg.attachments?.length > 0 && (
                    <div className="mt-3 pl-9 flex flex-wrap gap-2">
                      {msg.attachments.map((att: any) => (
                        <a
                          key={att.id}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-800 text-xs text-indigo-300 hover:text-indigo-200"
                        >
                          <Paperclip className="w-3 h-3" />
                          <span>{att.name}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reply Box */}
      {request.status === 'closed' ? (
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-400">
          This ticket is closed. If you still need help, please submit a new request.
        </div>
      ) : (
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <h3 className="text-sm font-semibold text-white">Add a Reply</h3>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSendReply} className="space-y-4">
            <textarea
              id="reply-body-textarea"
              required
              rows={4}
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder="Type your reply or additional information here..."
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm resize-none"
            />

            {/* Attachments for reply */}
            <div>
              <div className="flex items-center justify-between">
                <label className="inline-flex items-center space-x-2 text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer">
                  <UploadCloud className="w-4 h-4" />
                  <span>Attach files (up to 5, max 10MB each)</span>
                  <input
                    id="reply-file-upload"
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {attachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {attachments.map((file) => (
                    <span
                      key={file.id}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300"
                    >
                      <Paperclip className="w-3 h-3 text-slate-400" />
                      <span className="truncate max-w-[150px]">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(file.id)}
                        className="text-rose-400 hover:text-rose-300 ml-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                id="send-reply-btn"
                type="submit"
                disabled={sending || !replyBody.trim()}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/25 flex items-center space-x-2"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Reply</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
