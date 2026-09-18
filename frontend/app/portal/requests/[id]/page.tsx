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
      <div className="py-24 text-center text-sage-400">
        <Loader2 className="w-8 h-8 animate-spin text-brand-800 mx-auto mb-3" />
        <p className="text-xs font-semibold text-sage-600">Loading request details...</p>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-charcoal-900">Request Not Found</h2>
        <p className="text-xs text-sage-500">
          The requested ticket does not exist or you do not have permission to access it.
        </p>
        <Link
          href="/portal/requests"
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-white border border-sage-200 text-charcoal-900 text-xs font-semibold hover:bg-sage-50 shadow-soft-xs"
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
          className="inline-flex items-center space-x-2 text-xs font-semibold text-sage-500 hover:text-charcoal-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to all requests</span>
        </Link>
      </div>

      {/* Header Card */}
      <div className="p-6 rounded-2xl bg-white border border-sage-200/90 space-y-4 shadow-soft-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2.5">
              <span className="text-xs font-mono font-bold text-brand-800 bg-forest-50 px-2.5 py-0.5 rounded-full border border-forest-100">
                {request.requestNumber}
              </span>
              <span className="text-[11px] uppercase tracking-wider font-semibold px-2.5 py-0.5 rounded-full bg-sage-50 text-sage-700 border border-sage-200">
                {request.category.replace('_', ' ')}
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize bg-forest-50 text-forest-800 border border-forest-200">
                Priority: {request.priority}
              </span>
            </div>
            <h1 className="text-xl font-bold text-charcoal-900">{request.subject}</h1>
          </div>

          <span
            id="request-status-badge"
            className={`self-start sm:self-center text-xs font-semibold px-3 py-1 rounded-full capitalize ${
              request.status === 'completed'
                ? 'bg-forest-50 text-forest-800 border border-forest-200'
                : request.status === 'in_progress'
                ? 'bg-blue-50 text-blue-800 border border-blue-200'
                : request.status === 'closed'
                ? 'bg-sage-100 text-sage-600 border border-sage-200'
                : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}
          >
            {request.status.replace('_', ' ')}
          </span>
        </div>

        {/* Initial Description */}
        <div className="pt-4 border-t border-sage-100">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-sage-500 mb-2">Original Request</h3>
          <p className="text-xs text-charcoal-900 whitespace-pre-line leading-relaxed">{request.description}</p>

          {request.attachments?.length > 0 && (
            <div className="mt-4 pt-3 border-t border-sage-100">
              <h4 className="text-[11px] font-semibold text-sage-500 mb-2">Request Attachments:</h4>
              <div className="flex flex-wrap gap-2">
                {request.attachments.map((att) => (
                  <a
                    key={att.id}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-surface border border-sage-200 text-xs font-medium text-brand-800 hover:bg-forest-50 transition-colors"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>{att.name}</span>
                    <Download className="w-3 h-3 text-sage-400" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Messages Thread */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-charcoal-900 tracking-tight">Conversation Thread</h2>

        {request.messages.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white border border-sage-200/90 text-center text-sage-500 text-xs shadow-soft-xs">
            No follow-up messages yet. A support agent will respond here shortly.
          </div>
        ) : (
          <div className="space-y-4">
            {request.messages.map((msg) => {
              const isCustomer = msg.authorType === 'customer';
              return (
                <div
                  key={msg.id}
                  className={`p-5 rounded-2xl border shadow-soft-xs ${
                    isCustomer
                      ? 'bg-white border-sage-200/90 ml-4 sm:ml-12'
                      : 'bg-forest-50/50 border-forest-200/80 mr-4 sm:mr-12'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
                          isCustomer
                            ? 'bg-surface border border-sage-200 text-charcoal-900'
                            : 'bg-forest-100 text-brand-800 border border-forest-200'
                        }`}
                      >
                        {isCustomer ? 'You' : 'Staff'}
                      </div>
                      <span className="text-xs font-bold text-charcoal-900">
                        {isCustomer ? 'You' : msg.authorName || 'Support Representative'}
                      </span>
                    </div>
                    <span className="text-[11px] text-sage-400">
                      {new Date(msg.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-xs text-charcoal-900 whitespace-pre-line leading-relaxed pl-9">
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
                          className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-white border border-sage-200 text-xs text-brand-800 hover:bg-forest-50"
                        >
                          <Paperclip className="w-3 h-3 text-sage-400" />
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
        <div className="p-5 rounded-2xl bg-white border border-sage-200 text-center text-xs text-sage-500 shadow-soft-xs">
          This ticket is closed. If you still need help, please submit a new request.
        </div>
      ) : (
        <div className="p-6 rounded-2xl bg-white border border-sage-200/90 shadow-soft-xs space-y-4">
          <h3 className="text-sm font-bold text-charcoal-900">Add a Reply</h3>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 rounded-xl bg-forest-50 border border-forest-200 text-forest-800 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-forest-600" />
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
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-sage-200 text-charcoal-900 placeholder-sage-400 focus:outline-none focus:ring-2 focus:ring-brand-800/20 focus:border-brand-800 text-xs resize-none"
            />

            {/* Attachments for reply */}
            <div>
              <div className="flex items-center justify-between">
                <label className="inline-flex items-center space-x-2 text-xs font-semibold text-brand-800 hover:text-brand-900 cursor-pointer">
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
                      className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-surface border border-sage-200 text-xs text-charcoal-900"
                    >
                      <Paperclip className="w-3 h-3 text-sage-400" />
                      <span className="truncate max-w-[150px]">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(file.id)}
                        className="text-rose-600 hover:bg-rose-50 rounded p-0.5 ml-1"
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
                className="px-5 py-2.5 rounded-xl bg-brand-800 hover:bg-brand-900 disabled:opacity-50 text-white font-semibold text-xs transition-all shadow-forest-sm flex items-center space-x-2"
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
