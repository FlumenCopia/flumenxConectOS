'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  MessageSquare,
  Search,
  Plus,
  Filter,
  Send,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  RotateCw,
  Archive,
  User,
  Phone,
  Mail,
  ExternalLink,
  Flame,
  Building,
  Tag,
  Activity,
  X,
  ChevronRight,
  MoreVertical,
  Paperclip,
  CheckCircle2,
  RefreshCw,
  Radio,
  Sliders,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  getConversationsApi,
  getConversationApi,
  createConversationApi,
  updateConversationStatusApi,
  updateConversationPriorityApi,
  assignConversationApi,
  markConversationReadApi,
  archiveConversationApi,
  reopenConversationApi,
  getMessagesApi,
  sendMessageApi,
  retryMessageApi,
  getConversationActivitiesApi,
  getContactsApi,
  ConversationItem,
  MessageItem,
  ConversationActivityItem,
  ContactItem,
  ConversationChannel,
  ConversationStatus,
  ConversationPriority,
} from '@/lib/conversations';
import { getWorkspaceTeamApi, ClientMemberItem } from '@/lib/clients';

function UnifiedInboxContent() {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [activities, setActivities] = useState<ConversationActivityItem[]>([]);
  const [teamMembers, setTeamMembers] = useState<ClientMemberItem[]>([]);
  const [contacts, setContacts] = useState<ContactItem[]>([]);

  // Loading states
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [retryingMessageId, setRetryingMessageId] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | 'all'>('all');
  const [channelFilter, setChannelFilter] = useState<ConversationChannel | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<ConversationPriority | 'all'>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [counts, setCounts] = useState({ all: 0, unread: 0, open: 0, resolved: 0 });

  // Right sidebar tab
  const [showActivityDrawer, setShowActivityDrawer] = useState(false);

  // Composer
  const [replyText, setReplyText] = useState('');
  const [replyChannel, setReplyChannel] = useState<ConversationChannel>('whatsapp');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // New Thread Modal
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newThreadData, setNewThreadData] = useState({
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    channel: 'whatsapp' as ConversationChannel,
    subject: '',
    priority: 'medium' as ConversationPriority,
    initialMessage: '',
    assignedTo: '',
  });

  // Handle URL Query Parameters (e.g. from Leads CRM "Message" action)
  const searchParams = useSearchParams();
  const leadIdParam = searchParams.get('leadId');
  const contactNameParam = searchParams.get('contactName');
  const phoneParam = searchParams.get('phone');
  const emailParam = searchParams.get('email');
  const channelParam = searchParams.get('channel') as ConversationChannel | null;
  const initialParamsHandled = useRef(false);

  useEffect(() => {
    if (initialParamsHandled.current) return;
    if (contactNameParam || leadIdParam || phoneParam || emailParam) {
      initialParamsHandled.current = true;
      setNewThreadData({
        contactName: contactNameParam || '',
        contactEmail: emailParam || '',
        contactPhone: phoneParam || '',
        channel: channelParam || 'whatsapp',
        subject: `Conversation with ${contactNameParam || 'Lead'}`,
        priority: 'medium',
        initialMessage: '',
        assignedTo: '',
      });
      setIsNewModalOpen(true);
    }
  }, [contactNameParam, leadIdParam, phoneParam, emailParam, channelParam]);

  // Load conversation list
  const loadConversations = useCallback(async (preserveActive = true) => {
    setIsLoadingList(true);
    try {
      const data = await getConversationsApi({
        search: search.trim() || undefined,
        status: statusFilter,
        channel: channelFilter,
        priority: priorityFilter,
        unreadOnly,
      });

      setConversations(data.conversations || []);
      setCounts(data.counts || { all: 0, unread: 0, open: 0, resolved: 0 });

      // Automatically select first conversation if none selected
      if ((!activeConversationId || !preserveActive) && data.conversations?.length > 0) {
        setActiveConversationId(data.conversations[0]._id);
      }
    } catch (err) {
      console.error('Failed to load conversations', err);
    } finally {
      setIsLoadingList(false);
    }
  }, [search, statusFilter, channelFilter, priorityFilter, unreadOnly, activeConversationId]);

  // Initial load
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load team members and contacts
  useEffect(() => {
    const fetchAux = async () => {
      try {
        const [teamData, contactsData] = await Promise.all([
          getWorkspaceTeamApi().catch(() => null),
          getContactsApi().catch(() => null),
        ]);
        if (teamData?.members) setTeamMembers(teamData.members);
        if (contactsData?.contacts) setContacts(contactsData.contacts);
      } catch (e) {
        // Aux load failure non-critical
      }
    };
    fetchAux();
  }, []);

  // Load active thread messages and details
  const loadThread = useCallback(async (convId: string) => {
    setIsLoadingThread(true);
    try {
      const [conv, msgData, actData] = await Promise.all([
        getConversationApi(convId),
        getMessagesApi(convId),
        getConversationActivitiesApi(convId),
      ]);
      setActiveConversation(conv);
      setReplyChannel(conv.channel);
      setMessages(msgData.messages || []);
      setActivities(actData || []);

      // If unread, mark as read
      if (conv.unreadCount > 0) {
        markConversationReadApi(convId).then(() => {
          setConversations((prev) =>
            prev.map((c) => (c._id === convId ? { ...c, unreadCount: 0 } : c))
          );
        });
      }
    } catch (err) {
      console.error('Failed to load thread', err);
    } finally {
      setIsLoadingThread(false);
    }
  }, []);

  useEffect(() => {
    if (activeConversationId) {
      loadThread(activeConversationId);
    }
  }, [activeConversationId, loadThread]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle Send Reply
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!replyText.trim() || !activeConversationId || isSending) return;

    setIsSending(true);
    const bodyToSend = replyText.trim();
    setReplyText('');

    try {
      const newMsg = await sendMessageApi(activeConversationId, {
        body: bodyToSend,
        channel: replyChannel,
      });

      setMessages((prev) => [...prev, newMsg]);

      // Refresh thread activities
      const updatedActs = await getConversationActivitiesApi(activeConversationId);
      setActivities(updatedActs);

      // Update snippet in list
      setConversations((prev) =>
        prev.map((c) =>
          c._id === activeConversationId
            ? { ...c, lastMessageSnippet: bodyToSend, lastMessageAt: new Date().toISOString() }
            : c
        )
      );
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to dispatch message');
      setReplyText(bodyToSend);
    } finally {
      setIsSending(false);
    }
  };

  // Handle Retry Failed Message
  const handleRetryMessage = async (msgId: string) => {
    if (!activeConversationId) return;
    setRetryingMessageId(msgId);
    try {
      const updatedMsg = await retryMessageApi(activeConversationId, msgId);
      setMessages((prev) => prev.map((m) => (m._id === msgId ? updatedMsg : m)));
      const updatedActs = await getConversationActivitiesApi(activeConversationId);
      setActivities(updatedActs);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Retry failed');
    } finally {
      setRetryingMessageId(null);
    }
  };

  // Handle Status Change
  const handleStatusChange = async (status: ConversationStatus) => {
    if (!activeConversationId) return;
    try {
      await updateConversationStatusApi(activeConversationId, status);
      setActiveConversation((prev) => (prev ? { ...prev, status } : null));
      setConversations((prev) =>
        prev.map((c) => (c._id === activeConversationId ? { ...c, status } : c))
      );
      const updatedActs = await getConversationActivitiesApi(activeConversationId);
      setActivities(updatedActs);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to update status');
    }
  };

  // Handle Priority Change
  const handlePriorityChange = async (priority: ConversationPriority) => {
    if (!activeConversationId) return;
    try {
      await updateConversationPriorityApi(activeConversationId, priority);
      setActiveConversation((prev) => (prev ? { ...prev, priority } : null));
      setConversations((prev) =>
        prev.map((c) => (c._id === activeConversationId ? { ...c, priority } : c))
      );
      const updatedActs = await getConversationActivitiesApi(activeConversationId);
      setActivities(updatedActs);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to update priority');
    }
  };

  // Handle Assign Change
  const handleAssignChange = async (assignedTo: string) => {
    if (!activeConversationId) return;
    try {
      const updated = await assignConversationApi(activeConversationId, assignedTo || null);
      setActiveConversation(updated);
      setConversations((prev) =>
        prev.map((c) => (c._id === activeConversationId ? updated : c))
      );
      const updatedActs = await getConversationActivitiesApi(activeConversationId);
      setActivities(updatedActs);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to assign conversation');
    }
  };

  // Handle Archive / Reopen
  const handleArchiveToggle = async () => {
    if (!activeConversationId || !activeConversation) return;
    try {
      if (activeConversation.isArchived) {
        await reopenConversationApi(activeConversationId);
        setActiveConversation((prev) => (prev ? { ...prev, isArchived: false, status: 'open' } : null));
      } else {
        await archiveConversationApi(activeConversationId);
        setActiveConversation((prev) => (prev ? { ...prev, isArchived: true, status: 'archived' } : null));
      }
      loadConversations();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to change archive state');
    }
  };

  // Handle New Conversation Submit
  const handleCreateNewThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newThreadData.contactName.trim()) {
      alert('Contact name is required');
      return;
    }
    if (!newThreadData.contactEmail?.trim() && !newThreadData.contactPhone?.trim()) {
      alert('Please provide an email or phone number for the contact');
      return;
    }

    try {
      const created = await createConversationApi({
        contactName: newThreadData.contactName.trim(),
        contactEmail: newThreadData.contactEmail.trim() || undefined,
        contactPhone: newThreadData.contactPhone.trim() || undefined,
        channel: newThreadData.channel,
        subject: newThreadData.subject.trim() || undefined,
        priority: newThreadData.priority,
        initialMessage: newThreadData.initialMessage.trim() || undefined,
        assignedTo: newThreadData.assignedTo || undefined,
      });

      setIsNewModalOpen(false);
      setNewThreadData({
        contactName: '',
        contactEmail: '',
        contactPhone: '',
        channel: 'whatsapp',
        subject: '',
        priority: 'medium',
        initialMessage: '',
        assignedTo: '',
      });

      setActiveConversationId(created._id);
      loadConversations();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to create conversation');
    }
  };

  const getChannelBadge = (ch: ConversationChannel) => {
    switch (ch) {
      case 'whatsapp':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">WhatsApp</span>;
      case 'email':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">Email</span>;
      case 'sms':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">SMS</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">Internal</span>;
    }
  };

  return (
    <div className="flex h-[calc(100vh-5rem)] overflow-hidden bg-white border border-slate-200 rounded-xl shadow-xs">
      {/* ------------------------------------------------------------- */}
      {/* PANE 1: Quick Folders & Channel Filter (200px) */}
      {/* ------------------------------------------------------------- */}
      <div className="w-52 border-r border-slate-200 bg-slate-50/70 flex flex-col shrink-0">
        <div className="p-3 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Inbox Hub</span>
          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsNewModalOpen(true)}
            className="h-7 px-2 text-[11px] bg-brand-800 text-white"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> New
          </Button>
        </div>

        {/* Standard Folders */}
        <div className="p-2 space-y-0.5">
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setUnreadOnly(false);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              statusFilter === 'all' && !unreadOnly
                ? 'bg-brand-800 text-white font-semibold'
                : 'text-slate-700 hover:bg-slate-200/60'
            }`}
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>All Messages</span>
            </div>
            <span className="text-[10px] font-bold">{counts.all}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setUnreadOnly(!unreadOnly);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              unreadOnly
                ? 'bg-brand-800 text-white font-semibold'
                : 'text-slate-700 hover:bg-slate-200/60'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Unread</span>
            </div>
            {counts.unread > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-bold">
                {counts.unread}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFilter('open');
              setUnreadOnly(false);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              statusFilter === 'open' && !unreadOnly
                ? 'bg-brand-800 text-white font-semibold'
                : 'text-slate-700 hover:bg-slate-200/60'
            }`}
          >
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              <span>Open</span>
            </div>
            <span className="text-[10px]">{counts.open}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFilter('resolved');
              setUnreadOnly(false);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              statusFilter === 'resolved' && !unreadOnly
                ? 'bg-brand-800 text-white font-semibold'
                : 'text-slate-700 hover:bg-slate-200/60'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Resolved</span>
            </div>
            <span className="text-[10px]">{counts.resolved}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFilter('archived');
              setUnreadOnly(false);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              statusFilter === 'archived'
                ? 'bg-brand-800 text-white font-semibold'
                : 'text-slate-700 hover:bg-slate-200/60'
            }`}
          >
            <div className="flex items-center gap-2">
              <Archive className="w-3.5 h-3.5" />
              <span>Archived</span>
            </div>
          </button>
        </div>

        {/* Channel Filter Section */}
        <div className="mt-4 pt-3 border-t border-slate-200 px-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Channels</span>
          <div className="mt-1.5 space-y-1">
            {[
              { id: 'all', label: 'All Channels' },
              { id: 'whatsapp', label: 'WhatsApp' },
              { id: 'email', label: 'Email' },
              { id: 'sms', label: 'SMS' },
            ].map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => setChannelFilter(ch.id as any)}
                className={`w-full text-left px-2 py-1 rounded text-xs font-medium ${
                  channelFilter === ch.id
                    ? 'text-brand-800 font-bold bg-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {ch.label}
              </button>
            ))}
          </div>
        </div>

        {/* Priority Filter */}
        <div className="mt-4 pt-3 border-t border-slate-200 px-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Priority</span>
          <div className="mt-1.5 space-y-1">
            {[
              { id: 'all', label: 'All Priorities' },
              { id: 'urgent', label: '🔥 Urgent' },
              { id: 'high', label: 'High' },
              { id: 'medium', label: 'Medium' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPriorityFilter(p.id as any)}
                className={`w-full text-left px-2 py-1 rounded text-xs font-medium ${
                  priorityFilter === p.id
                    ? 'text-brand-800 font-bold bg-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Channel API Configuration shortcut */}
        <div className="mt-auto p-3 border-t border-slate-200">
          <Link
            href="/client/integrations?tab=messaging"
            className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-brand-800 hover:border-brand-300 text-xs font-semibold shadow-2xs transition-all group"
          >
            <Sliders className="w-4 h-4 text-brand-700 group-hover:rotate-45 transition-transform shrink-0" />
            <div className="flex flex-col">
              <span className="leading-tight">Channel APIs</span>
              <span className="text-[10px] text-slate-400 font-normal">WhatsApp, Meta, Twilio</span>
            </div>
          </Link>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* PANE 2: Conversation Thread List (320px) */}
      {/* ------------------------------------------------------------- */}
      <div className="w-80 border-r border-slate-200 flex flex-col shrink-0 bg-white">
        {/* Search Header */}
        <div className="p-3 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {isLoadingList ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading inbox...</div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">No conversations</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Matching active filters</p>
            </div>
          ) : (
            conversations.map((conv) => {
              const isSelected = activeConversationId === conv._id;
              const contactName = conv.contactId?.name || 'Unknown Contact';
              const hasUnread = conv.unreadCount > 0;

              return (
                <div
                  key={conv._id}
                  onClick={() => setActiveConversationId(conv._id)}
                  className={`p-3.5 cursor-pointer transition-colors border-l-3 select-none ${
                    isSelected
                      ? 'bg-brand-50/50 border-brand-800'
                      : hasUnread
                      ? 'bg-white border-rose-500 hover:bg-slate-50/80 font-medium'
                      : 'border-transparent hover:bg-slate-50/70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`text-xs truncate ${hasUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'}`}>
                        {contactName}
                      </span>
                      {conv.leadId && (
                        <span className="shrink-0 px-1 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Lead
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {new Date(conv.lastMessageAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 truncate mt-1">
                    {conv.lastMessageSnippet || conv.subject}
                  </p>

                  <div className="flex items-center justify-between mt-2 pt-1">
                    <div className="flex items-center gap-1">
                      {getChannelBadge(conv.channel)}
                      {conv.priority === 'urgent' && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Urgent
                        </span>
                      )}
                    </div>

                    {hasUnread && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-bold">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* PANE 3: Active Thread View & Composer (Flex 1) */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 flex flex-col bg-slate-50/40 min-w-0">
        {activeConversation ? (
          <>
            {/* Thread Header */}
            <div className="px-6 py-3 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-800 flex items-center justify-center font-bold text-xs">
                  {activeConversation.contactId?.name?.slice(0, 2).toUpperCase() || 'CU'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900 leading-tight">
                      {activeConversation.contactId?.name}
                    </h2>
                    {getChannelBadge(activeConversation.channel)}
                    {activeConversation.leadId && (
                      <Link
                        href={`/client/leads/${activeConversation.leadId._id || activeConversation.leadId}`}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                      >
                        CRM Lead <ExternalLink className="w-2.5 h-2.5" />
                      </Link>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[11px] text-slate-500">
                    {activeConversation.contactId?.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3 text-slate-400" />
                        {activeConversation.contactId.email}
                      </span>
                    )}
                    {activeConversation.contactId?.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {activeConversation.contactId.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Thread Action Controls */}
              <div className="flex items-center gap-2">
                {/* Status selector */}
                <select
                  value={activeConversation.status}
                  onChange={(e) => handleStatusChange(e.target.value as any)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 font-semibold text-slate-800"
                >
                  <option value="open">Status: Open</option>
                  <option value="pending">Status: Pending</option>
                  <option value="resolved">Status: Resolved</option>
                  <option value="archived">Status: Archived</option>
                </select>

                {/* Priority selector */}
                <select
                  value={activeConversation.priority}
                  onChange={(e) => handlePriorityChange(e.target.value as any)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 font-medium text-slate-800"
                >
                  <option value="low">Priority: Low</option>
                  <option value="medium">Priority: Medium</option>
                  <option value="high">Priority: High</option>
                  <option value="urgent">🔥 Urgent</option>
                </select>

                {/* Assignment selector */}
                <select
                  value={activeConversation.assignedTo?._id || ''}
                  onChange={(e) => handleAssignChange(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 font-medium text-slate-800"
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name}
                    </option>
                  ))}
                </select>

                {/* Activity Trail toggle */}
                <button
                  type="button"
                  onClick={() => setShowActivityDrawer(!showActivityDrawer)}
                  className={`p-1.5 rounded border text-xs flex items-center gap-1 ${
                    showActivityDrawer
                      ? 'bg-brand-50 border-brand-300 text-brand-800 font-semibold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                  title="Toggle conversation activity history"
                >
                  <Activity className="w-3.5 h-3.5" />
                </button>

                {/* Archive toggle */}
                <button
                  type="button"
                  onClick={handleArchiveToggle}
                  className="p-1.5 rounded border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                  title={activeConversation.isArchived ? 'Reopen Conversation' : 'Archive Conversation'}
                >
                  <Archive className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Main Chat Area with Activity Drawer */}
            <div className="flex-1 flex overflow-hidden">
              {/* Message Bubbles Container */}
              <div className="flex-1 p-6 overflow-y-auto space-y-4">
                {isLoadingThread ? (
                  <div className="p-8 text-center text-xs text-slate-500">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="p-12 text-center text-xs text-slate-400">
                    No messages in this thread yet. Send a reply below.
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isOutbound = msg.direction === 'outbound';
                    const isFailed = msg.deliveryStatus === 'failed';

                    return (
                      <div
                        key={msg._id}
                        className={`flex flex-col ${isOutbound ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 px-1">
                          <span className="text-[10px] font-semibold text-slate-600">
                            {msg.senderName}
                          </span>
                          <span className="text-[9px] text-slate-400">
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        <div
                          className={`max-w-md p-3.5 rounded-2xl text-xs leading-relaxed break-words shadow-xs ${
                            isOutbound
                              ? isFailed
                                ? 'bg-rose-50 border border-rose-300 text-rose-900 rounded-tr-none'
                                : 'bg-brand-800 text-white rounded-tr-none'
                              : 'bg-white border border-slate-200 text-slate-900 rounded-tl-none'
                          }`}
                        >
                          <p className="whitespace-pre-line">{msg.body}</p>

                          {/* Failure banner with Retry */}
                          {isFailed && (
                            <div className="mt-2 pt-2 border-t border-rose-200 flex items-center justify-between text-[11px] text-rose-700">
                              <span className="flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {msg.failureReason || 'Dispatch failed'}
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRetryMessage(msg._id)}
                                disabled={retryingMessageId === msg._id}
                                className="h-5 px-2 text-[10px] bg-white border-rose-300 text-rose-800 hover:bg-rose-100"
                              >
                                {retryingMessageId === msg._id ? (
                                  <RotateCw className="w-2.5 h-2.5 animate-spin mr-1" />
                                ) : (
                                  <RotateCw className="w-2.5 h-2.5 mr-1" />
                                )}
                                Retry
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Delivery Status Indicator for outbound messages */}
                        {isOutbound && !isFailed && (
                          <div className="flex items-center gap-1 mt-0.5 px-1 text-[10px] text-slate-400">
                            {msg.deliveryStatus === 'pending' && <Clock className="w-2.5 h-2.5" />}
                            {msg.deliveryStatus === 'sent' && <Check className="w-2.5 h-2.5" />}
                            {msg.deliveryStatus === 'delivered' && (
                              <CheckCheck className="w-2.5 h-2.5 text-slate-500" />
                            )}
                            {msg.deliveryStatus === 'read' && (
                              <CheckCheck className="w-2.5 h-2.5 text-blue-600 font-bold" />
                            )}
                            <span className="capitalize">{msg.deliveryStatus}</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Activity Trail Drawer */}
              {showActivityDrawer && (
                <div className="w-72 border-l border-slate-200 bg-white p-4 overflow-y-auto flex flex-col shrink-0 animate-in slide-in-from-right-10 duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Thread Audit History
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowActivityDrawer(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {activities.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">No activity recorded yet.</p>
                    ) : (
                      activities.map((act) => (
                        <div key={act._id} className="text-xs border-l-2 border-brand-700 pl-2.5 py-0.5">
                          <p className="font-semibold text-slate-800 text-[11px]">{act.title}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {new Date(act.createdAt).toLocaleString(undefined, {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Message Composer Bar */}
            <div className="p-4 bg-white border-t border-slate-200">
              <form onSubmit={handleSendMessage} className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-medium">Channel:</span>
                    <select
                      value={replyChannel}
                      onChange={(e) => setReplyChannel(e.target.value as any)}
                      className="text-xs font-semibold px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-slate-800"
                    >
                      <option value="whatsapp">WhatsApp</option>
                      <option value="email">Email</option>
                      <option value="sms">SMS</option>
                      <option value="internal">Internal Note</option>
                    </select>
                  </div>

                  <span className="text-[11px] text-slate-400">
                    Press <kbd className="px-1 py-0.5 bg-slate-100 rounded text-[10px]">Enter</kbd> to send
                  </span>
                </div>

                <div className="flex items-end gap-2">
                  <textarea
                    rows={2}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={`Reply to ${activeConversation.contactId?.name} via ${replyChannel}...`}
                    className="flex-1 text-xs p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-600 resize-none"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={!replyText.trim() || isSending}
                    isLoading={isSending}
                    className="h-10 px-4 bg-brand-800 hover:bg-brand-700 text-white rounded-lg shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <MessageSquare className="w-12 h-12 text-slate-300 mb-3" />
            <h3 className="text-base font-semibold text-slate-800">Unified Conversation Inbox</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Select a thread from the list or start a new conversation to communicate with clients and prospects.
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsNewModalOpen(true)}
              className="mt-4 bg-brand-800 text-white"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Start Conversation
            </Button>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* NEW CONVERSATION MODAL */}
      {/* ------------------------------------------------------------- */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Start New Conversation</h3>
                <p className="text-xs text-slate-500">Initiate outbound communication with a client or contact</p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewThread} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Name *</label>
                  <input
                    type="text"
                    required
                    value={newThreadData.contactName}
                    onChange={(e) => setNewThreadData({ ...newThreadData, contactName: e.target.value })}
                    placeholder="e.g. Jonathan Smith"
                    className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Channel *</label>
                  <select
                    value={newThreadData.channel}
                    onChange={(e) => setNewThreadData({ ...newThreadData, channel: e.target.value as any })}
                    className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-brand-600"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                    <option value="internal">Internal Thread</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={newThreadData.contactEmail}
                    onChange={(e) => setNewThreadData({ ...newThreadData, contactEmail: e.target.value })}
                    placeholder="jonathan@company.com"
                    className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={newThreadData.contactPhone}
                    onChange={(e) => setNewThreadData({ ...newThreadData, contactPhone: e.target.value })}
                    placeholder="+1 555-0199"
                    className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
                  <input
                    type="text"
                    value={newThreadData.subject}
                    onChange={(e) => setNewThreadData({ ...newThreadData, subject: e.target.value })}
                    placeholder="Discussion about project deliverables"
                    className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={newThreadData.priority}
                    onChange={(e) => setNewThreadData({ ...newThreadData, priority: e.target.value as any })}
                    className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-brand-600"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Message</label>
                <textarea
                  rows={3}
                  value={newThreadData.initialMessage}
                  onChange={(e) => setNewThreadData({ ...newThreadData, initialMessage: e.target.value })}
                  placeholder="Type the opening message to send to the contact..."
                  className="w-full text-xs p-3 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsNewModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" className="bg-brand-800 text-white">
                  Send &amp; Create Thread
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function UnifiedInboxPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Loading inbox...</div>}>
      <UnifiedInboxContent />
    </Suspense>
  );
}
