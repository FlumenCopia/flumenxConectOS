'use client';

import React, { useEffect, useState } from 'react';
import {
  portalListConversationsApi,
  portalGetConversationMessagesApi,
  portalSendConversationMessageApi,
  PortalConversationItem,
  PortalConversationMessage,
} from '@/lib/api/portal';
import {
  MessageSquare,
  Send,
  Clock,
  User,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Inbox,
  Mail,
  Phone,
} from 'lucide-react';

export default function PortalConversationsPage() {
  const [conversations, setConversations] = useState<PortalConversationItem[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<PortalConversationMessage[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchConversations = async () => {
      try {
        const list = await portalListConversationsApi();
        if (isMounted) {
          setConversations(list);
          if (list.length > 0 && !selectedConvId) {
            setSelectedConvId(list[0]._id);
          }
        }
      } catch (err: any) {
        if (isMounted) setError('Failed to load conversations');
      } finally {
        if (isMounted) setLoadingList(false);
      }
    };

    fetchConversations();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedConvId) return;

    let isMounted = true;
    const fetchMessages = async () => {
      setLoadingMessages(true);
      try {
        const data = await portalGetConversationMessagesApi(selectedConvId);
        if (isMounted) {
          setMessages(data.messages);
        }
      } catch (err: any) {
        if (isMounted) setError('Failed to load messages');
      } finally {
        if (isMounted) setLoadingMessages(false);
      }
    };

    fetchMessages();
    return () => {
      isMounted = false;
    };
  }, [selectedConvId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConvId || !replyText.trim()) return;

    setSending(true);
    setError(null);

    try {
      const idempotencyKey = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const sent = await portalSendConversationMessageApi(selectedConvId, {
        body: replyText.trim(),
        idempotencyKey,
      });

      setMessages((prev) => [...prev, sent]);
      setReplyText('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const selectedConv = conversations.find((c) => c._id === selectedConvId);

  if (loadingList) {
    return (
      <div className="py-24 text-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
        <p className="text-sm">Loading conversations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-sage-200/80 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-charcoal-900">Conversations</h1>
        <p className="text-xs text-sage-500 mt-1">
          Direct communication history with the team across email, SMS, and messaging
        </p>
      </div>

      {conversations.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white border border-sage-200/90 text-center shadow-soft-xs space-y-2">
          <Inbox className="w-12 h-12 text-sage-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-charcoal-900">No active conversations</h3>
          <p className="text-xs text-sage-500">
            When our team reaches out or you reply to an inquiry, message threads will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[720px]">
          {/* Left Panel: Conversation List */}
          <div className="lg:col-span-1 rounded-2xl bg-white border border-sage-200/90 shadow-soft-xs p-3 overflow-y-auto space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-sage-500 px-3 py-2">
              All Threads ({conversations.length})
            </p>
            {conversations.map((conv) => {
              const active = conv._id === selectedConvId;
              return (
                <button
                  key={conv._id}
                  id={`conv-tab-${conv._id}`}
                  onClick={() => setSelectedConvId(conv._id)}
                  className={`w-full text-left p-3.5 rounded-xl transition-all ${
                    active
                      ? 'bg-forest-50 border border-brand-800/30 text-charcoal-900 shadow-soft-xs ring-1 ring-brand-800/20'
                      : 'bg-surface/50 hover:bg-surface border border-sage-200/60 text-charcoal-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-brand-800">
                      {conv.channel}
                    </span>
                    <span className="text-[10px] text-sage-400 font-medium">
                      {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold truncate text-charcoal-900">{conv.subject || 'Conversation'}</h4>
                  {conv.lastMessageSnippet && (
                    <p className="text-xs text-sage-500 truncate mt-1">{conv.lastMessageSnippet}</p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right Panel: Messages View */}
          <div className="lg:col-span-2 rounded-2xl bg-white border border-sage-200/90 shadow-soft-xs flex flex-col justify-between overflow-hidden">
            {/* Thread Header */}
            <div className="px-6 py-4 border-b border-sage-100 flex items-center justify-between bg-surface/50">
              <div>
                <h3 className="text-sm font-bold text-charcoal-900 truncate max-w-md">
                  {selectedConv?.subject || 'Direct Support Conversation'}
                </h3>
                <div className="flex items-center space-x-2 text-xs text-sage-500 mt-0.5">
                  <span className="capitalize">Channel: {selectedConv?.channel || 'Web'}</span>
                  <span>•</span>
                  <span className="capitalize">Status: {selectedConv?.status || 'Open'}</span>
                </div>
              </div>
              <div className="flex items-center space-x-1.5 text-xs text-forest-800 bg-forest-50 px-2.5 py-1 rounded-full border border-forest-200 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-forest-600" />
                <span>Customer Visible</span>
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-[#FAFBF9]/40">
              {loadingMessages ? (
                <div className="h-full flex items-center justify-center text-sage-400">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-800 mr-2" />
                  <span className="text-xs font-medium">Loading message history...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sage-400 text-xs text-center">
                  No visible customer messages in this thread yet.
                </div>
              ) : (
                messages.map((msg) => {
                  const isCustomer = msg.direction === 'inbound' || msg.senderType === 'customer';
                  return (
                    <div
                      key={msg._id}
                      className={`flex flex-col ${isCustomer ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-lg p-4 rounded-2xl text-xs leading-relaxed ${
                          isCustomer
                            ? 'bg-brand-800 text-white rounded-br-none shadow-forest-sm'
                            : 'bg-white border border-sage-200 text-charcoal-900 rounded-bl-none shadow-soft-xs'
                        }`}
                      >
                        <p className="whitespace-pre-line">{msg.body}</p>
                      </div>
                      <span className="text-[10px] text-sage-400 mt-1 px-1">
                        {isCustomer ? 'You' : msg.senderName || 'Staff'} •{' '}
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Send Message Input Box */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-sage-100 bg-white flex items-center space-x-3">
              <input
                id="conversation-reply-input"
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type a message..."
                disabled={sending}
                className="flex-1 px-4 py-2 rounded-xl bg-white border border-sage-200 text-charcoal-900 placeholder-sage-400 text-xs focus:outline-none focus:ring-2 focus:ring-brand-800/20 focus:border-brand-800"
              />
              <button
                id="conversation-send-btn"
                type="submit"
                disabled={sending || !replyText.trim()}
                className="px-4 py-2 rounded-xl bg-brand-800 hover:bg-brand-900 disabled:opacity-50 text-white font-semibold text-xs transition-all shadow-forest-sm flex items-center space-x-1.5"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
