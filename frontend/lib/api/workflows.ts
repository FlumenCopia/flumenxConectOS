import { apiClient } from '../api';

export interface WorkflowCondition {
  field: string;
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'starts_with'
    | 'greater_than'
    | 'less_than'
    | 'in_list'
    | 'exists';
  value?: any;
  logicalOperator?: 'and' | 'or';
}

export interface WorkflowAction {
  id: string;
  type:
    | 'create_task'
    | 'assign_task'
    | 'update_lead_stage'
    | 'add_crm_note'
    | 'add_tag'
    | 'create_notification'
    | 'send_email'
    | 'schedule_follow_up'
    | 'pause_workflow';
  payload: Record<string, any>;
  order: number;
}

export interface WorkflowTrigger {
  eventType: string;
  filters?: Record<string, any>;
}

export interface WorkflowItem {
  _id: string;
  clientId: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
  trigger: WorkflowTrigger;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  executionMode: 'immediate' | 'async';
  maxExecutionsPerHour: number;
  lastExecutedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowRunItem {
  _id: string;
  clientId: string;
  workflowId: string | { _id: string; name: string; status: string; trigger?: any };
  eventType: string;
  eventId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  error?: string;
  actionResults: Array<{
    actionId: string;
    actionType: string;
    status: 'success' | 'failed' | 'skipped';
    output?: any;
    error?: string;
    executedAt: string;
    durationMs: number;
  }>;
  createdAt: string;
}

export const listWorkflowsApi = async (params: {
  status?: string;
  eventType?: string;
  search?: string;
  page?: number;
  limit?: number;
  clientId?: string;
} = {}) => {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.eventType) query.set('eventType', params.eventType);
  if (params.search) query.set('search', params.search);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const headers: Record<string, string> = {};
  if (params.clientId) headers['x-client-id'] = params.clientId;

  const res = await apiClient.get(`/workflows?${query.toString()}`, { headers });
  return res.data;
};

export const getWorkflowApi = async (id: string, clientId?: string) => {
  const headers: Record<string, string> = {};
  if (clientId) headers['x-client-id'] = clientId;

  const res = await apiClient.get(`/workflows/${id}`, { headers });
  return res.data.data;
};

export const createWorkflowApi = async (data: any, clientId?: string) => {
  const headers: Record<string, string> = {};
  if (clientId) headers['x-client-id'] = clientId;

  const res = await apiClient.post('/workflows', data, { headers });
  return res.data.data;
};

export const updateWorkflowApi = async (id: string, data: any, clientId?: string) => {
  const headers: Record<string, string> = {};
  if (clientId) headers['x-client-id'] = clientId;

  const res = await apiClient.put(`/workflows/${id}`, data, { headers });
  return res.data.data;
};

export const updateWorkflowStatusApi = async (
  id: string,
  status: 'draft' | 'active' | 'paused' | 'archived',
  clientId?: string
) => {
  const headers: Record<string, string> = {};
  if (clientId) headers['x-client-id'] = clientId;

  const res = await apiClient.patch(`/workflows/${id}/status`, { status }, { headers });
  return res.data.data;
};

export const deleteWorkflowApi = async (id: string, clientId?: string) => {
  const headers: Record<string, string> = {};
  if (clientId) headers['x-client-id'] = clientId;

  const res = await apiClient.delete(`/workflows/${id}`, { headers });
  return res.data;
};

export const testWorkflowConditionsApi = async (id: string, payload: Record<string, any>, clientId?: string) => {
  const headers: Record<string, string> = {};
  if (clientId) headers['x-client-id'] = clientId;

  const res = await apiClient.post(`/workflows/${id}/test-conditions`, { payload }, { headers });
  return res.data.data;
};

export const executeManualWorkflowApi = async (
  id: string,
  payload: Record<string, any> = {},
  eventId?: string,
  clientId?: string
) => {
  const headers: Record<string, string> = {};
  if (clientId) headers['x-client-id'] = clientId;

  const res = await apiClient.post(`/workflows/${id}/execute`, { payload, eventId }, { headers });
  return res.data.data;
};

export const listWorkflowRunsApi = async (params: {
  workflowId?: string;
  status?: string;
  page?: number;
  limit?: number;
  clientId?: string;
} = {}) => {
  const query = new URLSearchParams();
  if (params.workflowId) query.set('workflowId', params.workflowId);
  if (params.status) query.set('status', params.status);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const headers: Record<string, string> = {};
  if (params.clientId) headers['x-client-id'] = params.clientId;

  const res = await apiClient.get(`/workflows/runs?${query.toString()}`, { headers });
  return res.data;
};

export const getWorkflowRunApi = async (runId: string, clientId?: string) => {
  const headers: Record<string, string> = {};
  if (clientId) headers['x-client-id'] = clientId;

  const res = await apiClient.get(`/workflows/runs/${runId}`, { headers });
  return res.data.data;
};
