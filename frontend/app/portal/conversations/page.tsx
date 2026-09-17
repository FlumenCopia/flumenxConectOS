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
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Conversations</h1>
        <p className="text-sm text-slate-400 mt-1">
          Direct communication history with the team across email, SMS, and messaging
        </p>
      </div>

      {conversations.length === 0 ? (
        <div className="p-12 rounded-2xl bg-slate-900/50 border border-slate-800 text-center">
          <Inbox className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">No active conversations</h3>
          <p className="text-xs text-slate-400 mt-1">
            When our team reaches out or you reply to an inquiry, message threads will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[720px]">
          {/* Left Panel: Conversation List */}
          <div className="lg:col-span-1 rounded-2xl bg-slate-900/80 border border-slate-800 p-3 overflow-y-auto space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-3 py-2">
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
                      ? 'bg-indigo-600/20 border border-indigo-500/40 text-white shadow-md'
                      : 'bg-slate-800/40 hover:bg-slate-800/80 border border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                      {conv.channel}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold truncate text-white">{conv.subject || 'Conversation'}</h4>
                  {conv.lastMessageSnippet && (
                    <p className="text-xs text-slate-400 truncate mt-1">{conv.lastMessageSnippet}</p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right Panel: Messages View */}
          <div className="lg:col-span-2 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between overflow-hidden">
            {/* Thread Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div>
                <h3 className="text-base font-bold text-white truncate max-w-md">
                  {selectedConv?.subject || 'Direct Support Conversation'}
                </h3>
                <div className="flex items-center space-x-2 text-xs text-slate-400 mt-0.5">
                  <span className="capitalize">Channel: {selectedConv?.channel || 'Web'}</span>
                  <span>•</span>
                  <span className="capitalize">Status: {selectedConv?.status || 'Open'}</span>
                </div>
              </div>
              <div className="flex items-center space-x-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Customer Visible</span>
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              {loadingMessages ? (
                <div className="h-full flex items-center justify-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mr-2" />
                  <span className="text-sm">Loading message history...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs text-center">
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
                        className={`max-w-lg p-4 rounded-2xl text-sm leading-relaxed ${
                          isCustomer
                            ? 'bg-indigo-600 text-white rounded-br-none shadow-md shadow-indigo-600/20'
                            : 'bg-slate-800 border border-slate-700/80 text-slate-200 rounded-bl-none'
                        }`}
                      >
                        <p className="whitespace-pre-line">{msg.body}</p>
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1 px-1">
                        {isCustomer ? 'You' : msg.senderName || 'Staff'} •{' '}
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Send Message Input Box */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center space-x-3">
              <input
                id="conversation-reply-input"
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type a message..."
                disabled={sending}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
              <button
                id="conversation-send-btn"
                type="submit"
                disabled={sending || !replyText.trim()}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm transition-all shadow-md shadow-indigo-600/25 flex items-center space-x-2"
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
