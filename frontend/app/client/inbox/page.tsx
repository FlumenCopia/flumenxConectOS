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
  ChevronLeft,
  MoreVertical,
  Paperclip,
  CheckCircle2,
  RefreshCw,
  Radio,
  Sliders,
  Sparkles,
  Zap,
  Trash2,
  FileText,
  Film,
  Music,
  Download,
  Image as ImageIcon,
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
  WhatsAppTemplateItem,
  getWhatsAppTemplatesApi,
  QuickReplyItem,
  getQuickRepliesApi,
  createQuickReplyApi,
  deleteQuickReplyApi,
  uploadConversationAttachmentApi,
  UploadAttachmentResult,
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

  // Mobile view state ('list' or 'thread')
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');

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

  // WhatsApp Templates
  const [availableTemplates, setAvailableTemplates] = useState<WhatsAppTemplateItem[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  const loadTemplates = useCallback(async () => {
    setIsLoadingTemplates(true);
    try {
      const data = await getWhatsAppTemplatesApi();
      setAvailableTemplates(data);
    } catch {
      // keep fallback
    } finally {
      setIsLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Quick Replies (Predefined Messages)
  const [quickReplies, setQuickReplies] = useState<QuickReplyItem[]>([]);
  const [showQuickRepliesPopover, setShowQuickRepliesPopover] = useState(false);
  const [isLoadingQuickReplies, setIsLoadingQuickReplies] = useState(false);
  const [newQuickReplyTitle, setNewQuickReplyTitle] = useState('');
  const [newQuickReplyBody, setNewQuickReplyBody] = useState('');
  const [showAddQuickReplyForm, setShowAddQuickReplyForm] = useState(false);
  const [isSavingQuickReply, setIsSavingQuickReply] = useState(false);

  const loadQuickReplies = useCallback(async () => {
    setIsLoadingQuickReplies(true);
    try {
      const data = await getQuickRepliesApi();
      setQuickReplies(data);
    } catch {
      // fallback
    } finally {
      setIsLoadingQuickReplies(false);
    }
  }, []);

  useEffect(() => {
    loadQuickReplies();
  }, [loadQuickReplies]);

  // Media Attachment Upload
  const [selectedAttachment, setSelectedAttachment] = useState<UploadAttachmentResult | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if ((!replyText.trim() && !selectedAttachment) || !activeConversationId || isSending) return;

    setIsSending(true);
    const bodyToSend = replyText.trim() || (selectedAttachment ? selectedAttachment.name : '');
    const currentAttachment = selectedAttachment;
    setReplyText('');
    setSelectedAttachment(null);

    try {
      const newMsg = await sendMessageApi(activeConversationId, {
        body: bodyToSend,
        channel: replyChannel,
        attachments: currentAttachment
          ? [
              {
                name: currentAttachment.name,
                url: currentAttachment.publicUrl || currentAttachment.url,
                mimeType: currentAttachment.mimeType,
                size: currentAttachment.size,
              },
            ]
          : undefined,
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

  // Handle Media Attachment Upload (Image, Video, Audio, Document)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      alert('File size exceeds the 25MB limit.');
      return;
    }

    setIsUploadingAttachment(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        try {
          const res = await uploadConversationAttachmentApi({
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            base64Data,
          });
          setSelectedAttachment(res);
        } catch (err: any) {
          alert(err?.response?.data?.message || 'Failed to upload media attachment');
        } finally {
          setIsUploadingAttachment(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setIsUploadingAttachment(false);
    }
  };

  // Handle Quick Reply Actions
  const handleSelectQuickReply = (body: string) => {
    setReplyText((prev) => (prev ? `${prev}\n${body}` : body));
    setShowQuickRepliesPopover(false);
  };

  const handleCreateQuickReply = async () => {
    if (!newQuickReplyTitle.trim() || !newQuickReplyBody.trim()) {
      alert('Please fill in both a title and message text for the quick reply.');
      return;
    }
    setIsSavingQuickReply(true);
    try {
      const created = await createQuickReplyApi({
        title: newQuickReplyTitle.trim(),
        body: newQuickReplyBody.trim(),
        channel: replyChannel,
      });
      setQuickReplies((prev) => [...prev, created]);
      setNewQuickReplyTitle('');
      setNewQuickReplyBody('');
      setShowAddQuickReplyForm(false);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to save quick reply');
    } finally {
      setIsSavingQuickReply(false);
    }
  };

  const handleDeleteQuickReply = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this quick reply?')) return;
    try {
      await deleteQuickReplyApi(id);
      setQuickReplies((prev) => prev.filter((r) => r._id !== id));
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to delete quick reply');
    }
  };

  // Handle Send WhatsApp Template
  const handleSendTemplate = async (templateName: string = 'hello_world', templateLanguage: string = 'en_US') => {
    if (!activeConversationId || isSending) return;
    setIsSending(true);
    setShowTemplateModal(false);
    try {
      const newMsg = await sendMessageApi(activeConversationId, {
        body: `[Template: ${templateName}]`,
        channel: 'whatsapp',
        metadata: {
          type: 'template',
          templateName,
          templateLanguage,
        },
      });

      setMessages((prev) => [...prev, newMsg]);

      const updatedActs = await getConversationActivitiesApi(activeConversationId);
      setActivities(updatedActs);

      setConversations((prev) =>
        prev.map((c) =>
          c._id === activeConversationId
            ? { ...c, lastMessageSnippet: `[Template: ${templateName}]`, lastMessageAt: new Date().toISOString() }
            : c
        )
      );
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to dispatch WhatsApp template');
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
    <div className="-m-4 sm:m-0 flex h-[calc(100vh-8.5rem)] md:h-[calc(100vh-6rem)] overflow-hidden bg-white border-y sm:border border-sage-200/90 rounded-none sm:rounded-2xl shadow-none sm:shadow-soft-xs relative">
      {/* ------------------------------------------------------------- */}
      {/* PANE 1: Quick Folders & Channel Filter (Hidden on < lg, 208px on lg+) */}
      {/* ------------------------------------------------------------- */}
      <div className="hidden lg:flex w-52 border-r border-sage-200/90 bg-sage-50/50 flex-col shrink-0">
        <div className="p-3 border-b border-sage-100 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-sage-500">Inbox Hub</span>
          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsNewModalOpen(true)}
            className="h-7 px-2 text-[11px] shadow-forest-sm"
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
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === 'all' && !unreadOnly
                ? 'bg-brand-800 text-white font-semibold shadow-soft-xs'
                : 'text-sage-700 hover:bg-sage-100/70'
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
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              unreadOnly
                ? 'bg-brand-800 text-white font-semibold shadow-soft-xs'
                : 'text-sage-700 hover:bg-sage-100/70'
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
      {/* PANE 2: Conversation Thread List (Full width on mobile, 320px on desktop) */}
      {/* ------------------------------------------------------------- */}
      <div className={`w-full md:w-80 lg:w-80 border-r border-sage-200/90 flex flex-col shrink-0 bg-white ${mobileView === 'thread' ? 'hidden md:flex' : 'flex'}`}>
        {/* Search Header & Mobile Folder Scroller */}
        <div className="p-3 border-b border-sage-200/90 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 shadow-2xs"
              />
            </div>
            <Button
              size="sm"
              variant="primary"
              onClick={() => setIsNewModalOpen(true)}
              className="h-8 px-2.5 text-xs shadow-forest-sm shrink-0"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> New
            </Button>
          </div>

          {/* Mobile/Tablet quick folder & channel pill scroller */}
          <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            <button
              type="button"
              onClick={() => {
                setStatusFilter('all');
                setUnreadOnly(false);
              }}
              className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                statusFilter === 'all' && !unreadOnly
                  ? 'bg-brand-800 text-white shadow-2xs'
                  : 'bg-sage-100 text-sage-700 hover:bg-sage-200'
              }`}
            >
              All ({counts.all})
            </button>
            <button
              type="button"
              onClick={() => setUnreadOnly(!unreadOnly)}
              className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                unreadOnly
                  ? 'bg-brand-800 text-white shadow-2xs'
                  : 'bg-sage-100 text-sage-700 hover:bg-sage-200'
              }`}
            >
              🔴 Unread {counts.unread > 0 ? `(${counts.unread})` : ''}
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('open');
                setUnreadOnly(false);
              }}
              className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                statusFilter === 'open' && !unreadOnly
                  ? 'bg-brand-800 text-white shadow-2xs'
                  : 'bg-sage-100 text-sage-700 hover:bg-sage-200'
              }`}
            >
              Open ({counts.open})
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('resolved');
                setUnreadOnly(false);
              }}
              className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                statusFilter === 'resolved' && !unreadOnly
                  ? 'bg-brand-800 text-white shadow-2xs'
                  : 'bg-sage-100 text-sage-700 hover:bg-sage-200'
              }`}
            >
              Resolved ({counts.resolved})
            </button>
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value as any)}
              className="shrink-0 text-xs bg-sage-100 border-none rounded-full px-2 py-1 font-semibold text-sage-700 cursor-pointer"
            >
              <option value="all">All Channels</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
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
                  onClick={() => {
                    setActiveConversationId(conv._id);
                    setMobileView('thread');
                  }}
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
      {/* PANE 3: Active Thread View & Composer (Flex 1, toggles on mobile) */}
      {/* ------------------------------------------------------------- */}
      <div className={`flex-1 flex flex-col bg-slate-50/40 min-w-0 ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}`}>
        {activeConversation ? (
          <>
            {/* Thread Header */}
            <div className="px-3 sm:px-6 py-2.5 sm:py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setMobileView('list')}
                  className="md:hidden p-1.5 -ml-1 rounded-lg text-sage-700 hover:bg-sage-100 transition-colors"
                  title="Back to conversation list"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-brand-100 text-brand-800 flex items-center justify-center font-bold text-xs shrink-0">
                  {activeConversation.contactId?.name?.slice(0, 2).toUpperCase() || 'CU'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h2 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight truncate max-w-[140px] sm:max-w-none">
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
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] sm:text-[11px] text-slate-500 truncate">
                    {activeConversation.contactId?.phone || activeConversation.contactId?.email || 'Customer'}
                  </div>
                </div>
              </div>

              {/* Thread Action Controls */}
              <div className="flex items-center gap-1.5 ml-auto">
                {/* Status selector */}
                <select
                  value={activeConversation.status}
                  onChange={(e) => handleStatusChange(e.target.value as any)}
                  className="text-[11px] sm:text-xs bg-slate-50 border border-slate-200 rounded px-1.5 sm:px-2 py-1 font-semibold text-slate-800"
                >
                  <option value="open">Open</option>
                  <option value="pending">Pending</option>
                  <option value="resolved">Resolved</option>
                  <option value="archived">Archived</option>
                </select>

                {/* Priority selector (hidden on very small screens) */}
                <select
                  value={activeConversation.priority}
                  onChange={(e) => handlePriorityChange(e.target.value as any)}
                  className="hidden sm:inline-block text-[11px] sm:text-xs bg-slate-50 border border-slate-200 rounded px-1.5 sm:px-2 py-1 font-medium text-slate-800"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">🔥 Urgent</option>
                </select>

                {/* Assignment selector (hidden on mobile) */}
                <select
                  value={activeConversation.assignedTo?._id || ''}
                  onChange={(e) => handleAssignChange(e.target.value)}
                  className="hidden lg:inline-block text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 font-medium text-slate-800 max-w-[110px] truncate"
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
              <div className="flex-1 p-3 sm:p-6 overflow-y-auto space-y-3 sm:space-y-4">
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
                          {/* Attached Media (Image, Audio, Video, Document) */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mb-2 space-y-1.5">
                              {msg.attachments.map((att, idx) => {
                                const mime = (att.mimeType || '').toLowerCase();
                                const isImg = mime.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(att.name || att.url || '');
                                const isVideo = mime.startsWith('video/') || /\.(mp4|mov|3gp)$/i.test(att.name || att.url || '');
                                const isAudio = mime.startsWith('audio/') || /\.(mp3|ogg|wav|m4a|aac)$/i.test(att.name || att.url || '');

                                if (isImg) {
                                  return (
                                    <a key={idx} href={att.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-white/20">
                                      <img src={att.url} alt={att.name || 'Image'} className="max-h-60 w-auto rounded object-contain bg-black/10" />
                                    </a>
                                  );
                                }
                                if (isVideo) {
                                  return (
                                    <div key={idx} className="rounded-lg overflow-hidden border border-white/20 bg-black">
                                      <video src={att.url} controls className="max-h-60 w-full" />
                                    </div>
                                  );
                                }
                                if (isAudio) {
                                  return (
                                    <div key={idx} className="my-1">
                                      <audio src={att.url} controls className="w-full h-8" />
                                    </div>
                                  );
                                }
                                return (
                                  <a
                                    key={idx}
                                    href={att.url}
                                    target="_blank"
                                    download
                                    rel="noreferrer"
                                    className={`flex items-center gap-2 p-2 rounded-lg text-[11px] font-medium transition ${
                                      isOutbound
                                        ? 'bg-white/10 hover:bg-white/20 text-white'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                                    }`}
                                  >
                                    <FileText className="w-4 h-4 shrink-0" />
                                    <span className="truncate flex-1">{att.name || 'Document'}</span>
                                    <Download className="w-3.5 h-3.5 shrink-0 opacity-70" />
                                  </a>
                                );
                              })}
                            </div>
                          )}

                          {msg.body && <p className="whitespace-pre-line">{msg.body}</p>}

                          {/* Failure banner with Retry */}
                          {isFailed && (
                            <div className="mt-2 pt-2 border-t border-rose-200 flex flex-col gap-1.5 text-[11px] text-rose-700">
                              <div className="flex items-start justify-between gap-2">
                                <span className="flex items-start gap-1">
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                  <span>{msg.failureReason || 'Dispatch failed'}</span>
                                </span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRetryMessage(msg._id)}
                                  disabled={retryingMessageId === msg._id}
                                  className="h-5 px-2 text-[10px] bg-white border-rose-300 text-rose-800 hover:bg-rose-100 shrink-0"
                                >
                                  {retryingMessageId === msg._id ? (
                                    <RotateCw className="w-2.5 h-2.5 animate-spin mr-1" />
                                  ) : (
                                    <RotateCw className="w-2.5 h-2.5 mr-1" />
                                  )}
                                  Retry
                                </Button>
                              </div>

                              {(msg.failureReason?.includes('24-Hour') || msg.failureReason?.includes('131047') || msg.failureReason?.includes('template')) && (
                                <button
                                  type="button"
                                  onClick={() => setShowTemplateModal(true)}
                                  disabled={isSending}
                                  className="text-[10px] self-start px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200 font-semibold transition flex items-center gap-1 mt-0.5"
                                >
                                  <Sparkles className="w-2.5 h-2.5 text-emerald-700" />
                                  Choose an approved template to initiate conversation
                                </button>
                              )}
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
            {/* Message Composer Bar */}
            <div className="p-2.5 sm:p-4 bg-white border-t border-slate-200">
              {/* Attachment Preview (if selected) */}
              {selectedAttachment && (
                <div className="mb-2 flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs animate-in fade-in duration-150">
                  <div className="flex items-center gap-2 truncate">
                    {selectedAttachment.mimeType?.startsWith('image/') ? (
                      <ImageIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : selectedAttachment.mimeType?.startsWith('video/') ? (
                      <Film className="w-4 h-4 text-purple-600 shrink-0" />
                    ) : selectedAttachment.mimeType?.startsWith('audio/') ? (
                      <Music className="w-4 h-4 text-amber-600 shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                    )}
                    <span className="font-semibold text-slate-800 truncate">{selectedAttachment.name}</span>
                    <span className="text-[10px] text-slate-400">({Math.round(selectedAttachment.size / 1024)} KB)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedAttachment(null)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded"
                    title="Remove attachment"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Hidden file input for media upload */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xlsx"
                className="hidden"
              />

              <form onSubmit={handleSendMessage} className="space-y-2">
                <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-400 font-medium text-[11px]">Channel:</span>
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

                    {/* Media Attachment Upload Button */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingAttachment || isSending}
                      title="Attach image, video, audio or document"
                      className="text-[11px] font-medium px-2 py-0.5 rounded border border-slate-200 text-slate-700 bg-slate-50 hover:bg-slate-100 transition flex items-center gap-1"
                    >
                      {isUploadingAttachment ? (
                        <RotateCw className="w-3 h-3 animate-spin text-brand-600" />
                      ) : (
                        <Paperclip className="w-3 h-3 text-slate-600" />
                      )}
                      <span>Attach</span>
                    </button>

                    {/* Quick Replies (Predefined Messages) Button with popover */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowQuickRepliesPopover(!showQuickRepliesPopover)}
                        title="Choose predefined canned responses"
                        className="text-[11px] font-medium px-2 py-0.5 rounded border border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-100 transition flex items-center gap-1"
                      >
                        <Zap className="w-3 h-3 text-amber-600" />
                        <span>Quick Replies ({quickReplies.length})</span>
                      </button>

                      {/* Quick Replies Popover */}
                      {showQuickRepliesPopover && (
                        <div className="absolute left-0 bottom-full mb-1.5 w-80 bg-white border border-slate-200 rounded-xl shadow-xl p-3 z-30 animate-in fade-in duration-100 max-h-96 flex flex-col">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                            <span className="font-bold text-xs text-slate-800 flex items-center gap-1">
                              <Zap className="w-3.5 h-3.5 text-amber-500" /> Predefined Quick Replies
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowQuickRepliesPopover(false)}
                              className="text-slate-400 hover:text-slate-600"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-56">
                            {isLoadingQuickReplies ? (
                              <p className="text-[11px] text-slate-400 p-2 text-center">Loading quick replies...</p>
                            ) : quickReplies.length === 0 ? (
                              <p className="text-[11px] text-slate-400 p-2 text-center">No quick replies created yet.</p>
                            ) : (
                              quickReplies.map((qr) => (
                                <div
                                  key={qr._id}
                                  onClick={() => handleSelectQuickReply(qr.body)}
                                  className="p-2 rounded-lg border border-slate-100 hover:border-amber-300 hover:bg-amber-50/50 cursor-pointer transition text-left group flex items-start justify-between gap-1"
                                >
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-semibold text-slate-800">{qr.title}</span>
                                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 font-medium">
                                        {qr.category || 'General'}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{qr.body}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => handleDeleteQuickReply(qr._id, e)}
                                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-600 p-1 transition"
                                    title="Delete quick reply"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>

                          {/* Add Custom Quick Reply Toggle */}
                          <div className="pt-2 border-t border-slate-100 mt-2">
                            {showAddQuickReplyForm ? (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  placeholder="Shortcut / Title (e.g. Price Quote)"
                                  value={newQuickReplyTitle}
                                  onChange={(e) => setNewQuickReplyTitle(e.target.value)}
                                  className="w-full text-xs p-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                                <textarea
                                  rows={2}
                                  placeholder="Predefined message text..."
                                  value={newQuickReplyBody}
                                  onChange={(e) => setNewQuickReplyBody(e.target.value)}
                                  className="w-full text-xs p-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setShowAddQuickReplyForm(false)}
                                    className="px-2 py-0.5 text-[10px] text-slate-500 border border-slate-200 rounded"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleCreateQuickReply}
                                    disabled={isSavingQuickReply}
                                    className="px-2.5 py-0.5 text-[10px] bg-amber-600 text-white font-medium rounded hover:bg-amber-700"
                                  >
                                    {isSavingQuickReply ? 'Saving...' : 'Save Quick Reply'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setShowAddQuickReplyForm(true)}
                                className="w-full py-1 text-center text-xs font-medium text-brand-700 hover:text-brand-900 bg-slate-50 hover:bg-slate-100 rounded border border-slate-200 transition flex items-center justify-center gap-1"
                              >
                                <Plus className="w-3 h-3" /> Add Custom Quick Reply
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* WhatsApp Meta Templates Modal Trigger */}
                    {replyChannel === 'whatsapp' && (
                      <button
                        type="button"
                        onClick={() => setShowTemplateModal(true)}
                        disabled={isSending}
                        title="View and send Meta approved WhatsApp templates"
                        className="text-[11px] font-medium px-2 py-0.5 rounded border border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 transition flex items-center gap-1 shadow-xs"
                      >
                        <Sparkles className="w-3 h-3 text-emerald-600" />
                        <span>Meta Templates ({availableTemplates.length || 1})</span>
                      </button>
                    )}
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
                    placeholder={
                      selectedAttachment
                        ? `Add a caption for ${selectedAttachment.name}... (optional)`
                        : `Reply to ${activeConversation.contactId?.name} via ${replyChannel}...`
                    }
                    className="flex-1 text-xs p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-600 resize-none"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={(!replyText.trim() && !selectedAttachment) || isSending}
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
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">Initial Message</label>
                  {newThreadData.channel === 'whatsapp' && (
                    <button
                      type="button"
                      onClick={() => setNewThreadData({ ...newThreadData, initialMessage: 'hello_world' })}
                      className="text-[11px] text-emerald-700 hover:text-emerald-800 font-medium underline flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-2.5 h-2.5" /> Use "hello_world" starter template
                    </button>
                  )}
                </div>
                <textarea
                  rows={3}
                  value={newThreadData.initialMessage}
                  onChange={(e) => setNewThreadData({ ...newThreadData, initialMessage: e.target.value })}
                  placeholder={
                    newThreadData.channel === 'whatsapp'
                      ? 'Type message or use "hello_world" template for new numbers...'
                      : 'Type the opening message to send to the contact...'
                  }
                  className="w-full text-xs p-3 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-600"
                />
                {newThreadData.channel === 'whatsapp' && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Meta Rule: For contacts outside the 24h window, use <code className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded">hello_world</code> or have the contact message your WhatsApp test number first.
                  </p>
                )}
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

      {/* ------------------------------------------------------------- */}
      {/* WHATSAPP META TEMPLATES MODAL */}
      {/* ------------------------------------------------------------- */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600" /> WhatsApp Meta Message Templates
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                    {availableTemplates.length} Approved
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pre-approved Meta templates can be sent anytime, even outside the 24-hour customer messaging window.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadTemplates}
                  disabled={isLoadingTemplates}
                  title="Refresh templates from Meta"
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTemplates ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick banner with Meta manager link */}
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-900">
              <span className="text-[11px]">
                Want to create a new custom template with buttons or media?
              </span>
              <a
                href="https://business.facebook.com/wa/manage/message-templates/?waba_id=2381123346055633"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-emerald-800 hover:underline flex items-center gap-1 shrink-0 ml-2 text-[11px]"
              >
                <span>Meta Template Manager</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Templates List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {isLoadingTemplates ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  <RotateCw className="w-5 h-5 animate-spin mx-auto text-emerald-600 mb-2" />
                  Fetching approved templates from Meta WhatsApp Cloud API...
                </div>
              ) : availableTemplates.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No approved templates found in Meta. You can use the standard <code>hello_world</code> template.
                </div>
              ) : (
                availableTemplates.map((tmpl) => (
                  <div
                    key={tmpl.id || tmpl.name}
                    className="border border-slate-200 rounded-xl p-4 hover:border-emerald-300 hover:bg-emerald-50/20 transition flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 font-mono">{tmpl.name}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase bg-emerald-100 text-emerald-800">
                            {tmpl.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100">{tmpl.category || 'UTILITY'}</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 uppercase">{tmpl.language || 'en_US'}</span>
                        </div>
                      </div>

                      {/* WhatsApp preview card */}
                      <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-lg text-xs text-slate-700 whitespace-pre-line leading-relaxed font-sans">
                        {tmpl.bodyText || 'Standard Meta approved notification.'}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        disabled={!activeConversationId || isSending}
                        onClick={() => handleSendTemplate(tmpl.name, tmpl.language)}
                        className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs h-8 px-3"
                      >
                        <Send className="w-3 h-3 mr-1" />
                        Send Template to Contact
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <Button variant="outline" size="sm" type="button" onClick={() => setShowTemplateModal(false)}>
                Close
              </Button>
            </div>
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
