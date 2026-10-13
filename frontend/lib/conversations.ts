import { apiClient, ApiResponse } from './api';

export type ConversationChannel = 'email' | 'sms' | 'whatsapp' | 'internal' | 'other';
export type ConversationStatus = 'open' | 'pending' | 'resolved' | 'archived';
export type ConversationPriority = 'low' | 'medium' | 'high' | 'urgent';
export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'read';

export interface ContactItem {
  _id: string;
  clientId: string;
  name: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  leadId?: { _id: string; stage: string; leadScore: number; source: string; company?: string };
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface ConversationItem {
  _id: string;
  clientId: string;
  contactId: ContactItem;
  leadId?: { _id: string; stage: string; leadScore: number; source: string; company?: string };
  subject: string;
  channel: ConversationChannel;
  status: ConversationStatus;
  priority: ConversationPriority;
  assignedTo?: { _id: string; name: string; email: string; avatarUrl?: string };
  lastMessageAt: string;
  lastMessageSnippet: string;
  unreadCount: number;
  tags: string[];
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MessageItem {
  _id: string;
  clientId: string;
  conversationId: string;
  senderType: 'user' | 'contact' | 'system' | 'bot';
  senderId?: string;
  senderName: string;
  senderEmail?: string;
  senderPhone?: string;
  channel: ConversationChannel;
  direction: 'inbound' | 'outbound';
  body: string;
  deliveryStatus: DeliveryStatus;
  failureReason?: string;
  retryCount: number;
  externalMessageId?: string;
  attachments?: Array<{ name: string; url: string; size?: number; mimeType?: string }>;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  createdAt: string;
}

export interface ConversationActivityItem {
  _id: string;
  clientId: string;
  conversationId: string;
  userId?: { _id: string; name: string; email: string; avatarUrl?: string };
  action: string;
  title: string;
  details?: Record<string, any>;
  createdAt: string;
}

export interface ConversationFilters {
  status?: ConversationStatus | 'all';
  priority?: ConversationPriority | 'all';
  channel?: ConversationChannel | 'all';
  assignedTo?: string | 'all';
  search?: string;
  unreadOnly?: boolean;
  isArchived?: boolean;
  page?: number;
  limit?: number;
}

// -------------------------------------------------------------
// Conversation APIs
// -------------------------------------------------------------

export const getConversationsApi = async (filters: ConversationFilters = {}) => {
  const query = new URLSearchParams();
  if (filters.status && filters.status !== 'all') query.set('status', filters.status);
  if (filters.priority && filters.priority !== 'all') query.set('priority', filters.priority);
  if (filters.channel && filters.channel !== 'all') query.set('channel', filters.channel);
  if (filters.assignedTo && filters.assignedTo !== 'all') query.set('assignedTo', filters.assignedTo);
  if (filters.search) query.set('search', filters.search);
  if (filters.unreadOnly) query.set('unreadOnly', 'true');
  if (filters.isArchived) query.set('isArchived', 'true');
  if (filters.page) query.set('page', filters.page.toString());
  if (filters.limit) query.set('limit', filters.limit.toString());

  const res = await apiClient.get<
    ApiResponse<{
      conversations: ConversationItem[];
      pagination: { total: number; page: number; limit: number; totalPages: number };
      counts: { all: number; unread: number; open: number; resolved: number };
    }>
  >(`/conversations?${query.toString()}`);
  return res.data.data!;
};

export const getConversationApi = async (conversationId: string) => {
  const res = await apiClient.get<ApiResponse<ConversationItem>>(`/conversations/${conversationId}`);
  return res.data.data!;
};

export const createConversationApi = async (data: {
  contactId?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  leadId?: string;
  subject?: string;
  channel: ConversationChannel;
  priority?: ConversationPriority;
  tags?: string[];
  assignedTo?: string;
  initialMessage?: string;
}) => {
  const res = await apiClient.post<ApiResponse<ConversationItem>>('/conversations', data);
  return res.data.data!;
};

export const updateConversationStatusApi = async (conversationId: string, status: ConversationStatus) => {
  const res = await apiClient.patch<ApiResponse<ConversationItem>>(`/conversations/${conversationId}/status`, { status });
  return res.data.data!;
};

export const updateConversationPriorityApi = async (conversationId: string, priority: ConversationPriority) => {
  const res = await apiClient.patch<ApiResponse<ConversationItem>>(`/conversations/${conversationId}/priority`, { priority });
  return res.data.data!;
};

export const assignConversationApi = async (conversationId: string, assignedTo: string | null) => {
  const res = await apiClient.patch<ApiResponse<ConversationItem>>(`/conversations/${conversationId}/assign`, { assignedTo });
  return res.data.data!;
};

export const updateConversationTagsApi = async (conversationId: string, tags: string[]) => {
  const res = await apiClient.patch<ApiResponse<ConversationItem>>(`/conversations/${conversationId}/tags`, { tags });
  return res.data.data!;
};

export const markConversationReadApi = async (conversationId: string) => {
  const res = await apiClient.post<ApiResponse<ConversationItem>>(`/conversations/${conversationId}/read`);
  return res.data.data!;
};

export const archiveConversationApi = async (conversationId: string) => {
  const res = await apiClient.delete<ApiResponse<ConversationItem>>(`/conversations/${conversationId}`);
  return res.data.data!;
};

export const reopenConversationApi = async (conversationId: string) => {
  const res = await apiClient.post<ApiResponse<ConversationItem>>(`/conversations/${conversationId}/reopen`);
  return res.data.data!;
};

// -------------------------------------------------------------
// Message APIs
// -------------------------------------------------------------

export const getMessagesApi = async (conversationId: string, page = 1, limit = 50) => {
  const res = await apiClient.get<
    ApiResponse<{
      messages: MessageItem[];
      pagination: { total: number; page: number; limit: number; totalPages: number };
    }>
  >(`/conversations/${conversationId}/messages?page=${page}&limit=${limit}`);
  return res.data.data!;
};

export const sendMessageApi = async (
  conversationId: string,
  data: {
    body: string;
    channel?: ConversationChannel;
    attachments?: Array<{ name: string; url: string; size?: number; mimeType?: string }>;
    idempotencyKey?: string;
    metadata?: Record<string, any>;
  }
) => {
  const res = await apiClient.post<ApiResponse<MessageItem>>(`/conversations/${conversationId}/messages`, data);
  return res.data.data!;
};

export const retryMessageApi = async (conversationId: string, messageId: string) => {
  const res = await apiClient.post<ApiResponse<MessageItem>>(`/conversations/${conversationId}/messages/${messageId}/retry`);
  return res.data.data!;
};

export const getConversationActivitiesApi = async (conversationId: string) => {
  const res = await apiClient.get<ApiResponse<ConversationActivityItem[]>>(`/conversations/${conversationId}/activities`);
  return res.data.data!;
};

// -------------------------------------------------------------
// Contact APIs
// -------------------------------------------------------------

export const getContactsApi = async (params: { search?: string; page?: number; limit?: number } = {}) => {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.page) query.set('page', params.page.toString());
  if (params.limit) query.set('limit', params.limit.toString());

  const res = await apiClient.get<
    ApiResponse<{
      contacts: ContactItem[];
      pagination: { total: number; page: number; limit: number; totalPages: number };
    }>
  >(`/contacts?${query.toString()}`);
  return res.data.data!;
};

// -------------------------------------------------------------
// Communication Provider & Channel APIs
// -------------------------------------------------------------

export type ProviderType =
  | 'mock'
  | 'resend'
  | 'twilio'
  | 'whatsapp'
  | 'meta_instagram'
  | 'meta_messenger'
  | 'custom_webhook';

export interface CommunicationProviderItem {
  _id: string;
  clientId: string;
  providerType: ProviderType;
  displayName: string;
  status: 'active' | 'inactive' | 'error';
  configuration: Record<string, any>;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export const getCommunicationProvidersApi = async () => {
  const res = await apiClient.get<ApiResponse<CommunicationProviderItem[]>>('/conversations/providers');
  return res.data.data || [];
};

export const saveCommunicationProviderApi = async (data: {
  providerType: ProviderType;
  displayName: string;
  configuration: Record<string, any>;
  isDefault?: boolean;
  status?: 'active' | 'inactive' | 'error';
}) => {
  const res = await apiClient.post<ApiResponse<CommunicationProviderItem>>('/conversations/providers', data);
  return res.data.data!;
};

export const deleteCommunicationProviderApi = async (providerId: string) => {
  const res = await apiClient.delete<ApiResponse<{ deletedId: string }>>(`/conversations/providers/${providerId}`);
  return res.data.data!;
};

export const testCommunicationProviderApi = async (data: {
  providerType: ProviderType;
  configuration: Record<string, any>;
}) => {
  const res = await apiClient.post<ApiResponse<any>>('/conversations/providers/test', data);
  return res.data;
};

export interface WhatsAppTemplateItem {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  bodyText?: string;
  components?: any[];
}

export const getWhatsAppTemplatesApi = async (): Promise<WhatsAppTemplateItem[]> => {
  const res = await apiClient.get<ApiResponse<{ templates: WhatsAppTemplateItem[]; count: number }>>('/conversations/templates');
  return res.data.data?.templates || [];
};

export interface QuickReplyItem {
  _id: string;
  title: string;
  category: string;
  body: string;
  channel: string;
  tags: string[];
  createdAt: string;
}

export const getQuickRepliesApi = async (): Promise<QuickReplyItem[]> => {
  const res = await apiClient.get<ApiResponse<{ quickReplies: QuickReplyItem[]; count: number }>>('/conversations/quick-replies');
  return res.data.data?.quickReplies || [];
};

export const createQuickReplyApi = async (data: {
  title: string;
  body: string;
  category?: string;
  channel?: string;
}): Promise<QuickReplyItem> => {
  const res = await apiClient.post<ApiResponse<QuickReplyItem>>('/conversations/quick-replies', data);
  return res.data.data!;
};

export const deleteQuickReplyApi = async (id: string): Promise<string> => {
  const res = await apiClient.delete<ApiResponse<{ deletedId: string }>>(`/conversations/quick-replies/${id}`);
  return res.data.data!.deletedId;
};

export interface UploadAttachmentResult {
  url: string;
  publicUrl: string;
  name: string;
  mimeType: string;
  size: number;
}

export const uploadConversationAttachmentApi = async (file: {
  name: string;
  mimeType: string;
  base64Data: string;
}): Promise<UploadAttachmentResult> => {
  const res = await apiClient.post<ApiResponse<UploadAttachmentResult>>('/conversations/upload', file);
  return res.data.data!;
};



