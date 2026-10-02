import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('spectra_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token if invalid
      localStorage.removeItem('spectra_token');
    }
    return Promise.reject(error);
  }
);

export interface SystemStatus {
  active_workers: number;
  queued_events: number;
  processed_events: number;
  failed_events: number;
  dlq_count: number;
  stream_length: number;
  pending_messages: number;
}

export interface EventItem {
  event_id: string;
  event_type: string;
  timestamp?: string;
  source?: string;
  producer?: string;
  entity_id?: string;
  entity_type?: string;
  action?: string;
  status?: string;
  metadata?: Record<string, any>;
  correlation_key?: string;
  correlation_id?: string;
  schema_version: string;
  processing_status: 'queued' | 'processing' | 'processed' | 'failed' | 'dlq';
  ingested_at: string;
  processed_at?: string;
}

export interface CorrelationItem {
  id: number;
  correlation_id: string;
  correlation_key: string;
  entity_id?: string;
  event_count: number;
  status: string;
  confidence_score: number;
  first_event_at: string;
  last_event_at: string;
  created_at: string;
  updated_at: string;
}

export interface RuleItem {
  id: number;
  rule_id: string;
  name: string;
  description?: string;
  rule_type: string;
  conditions: Record<string, any>;
  window_seconds: number;
  threshold: number;
  severity: string;
  is_active: boolean;
  action: string;
  created_at: string;
}

export interface DLQItem {
  message_id: string;
  event_id?: string;
  failure_reason?: string;
  retry_count: number;
  first_failed_at?: string;
  last_failed_at?: string;
  original_data?: Record<string, any>;
}

export interface HealthStatus {
  status: string;
  services: {
    postgres: { status: string; latency_ms?: number; details?: string };
    redis: { status: string; latency_ms?: number; details?: string };
    opensearch: { status: string; latency_ms?: number; details?: string };
  };
}

// ─── API Methods ─────────────────────────────────────────────────────────────

export const getHealth = async (): Promise<HealthStatus> => {
  const { data } = await api.get('/health');
  return data;
};

export const getProcessingStatus = async (): Promise<SystemStatus> => {
  const { data } = await api.get('/api/processing/status');
  return data;
};

export const getEvents = async (params: {
  page?: number;
  page_size?: number;
  event_type?: string;
  processing_status?: string;
  entity_id?: string;
  source?: string;
}) => {
  const { data } = await api.get('/api/events', { params });
  return data as { items: EventItem[]; total: number; page: number; pages: number };
};

export const searchEvents = async (q: string, limit: number = 30): Promise<EventItem[]> => {
  const { data } = await api.get('/api/events/search', { params: { q, limit } });
  return data;
};

export const getEventById = async (id: string): Promise<EventItem> => {
  const { data } = await api.get(`/api/events/${id}`);
  return data;
};

export const ingestEvent = async (event: Partial<EventItem>) => {
  const { data } = await api.post('/api/events', event);
  return data;
};

export const getCorrelations = async (params: { page?: number; page_size?: number }) => {
  const { data } = await api.get('/api/correlations', { params });
  return data as { items: CorrelationItem[]; total: number; page: number; pages: number };
};

export const getCorrelationById = async (id: string): Promise<CorrelationItem> => {
  const { data } = await api.get(`/api/correlations/${id}`);
  return data;
};

export const getRules = async (): Promise<RuleItem[]> => {
  const { data } = await api.get('/api/rules');
  return data;
};

export const createRule = async (rule: Partial<RuleItem>): Promise<RuleItem> => {
  const { data } = await api.post('/api/rules', rule);
  return data;
};

export const toggleRule = async (ruleId: string, isActive: boolean): Promise<RuleItem> => {
  const { data } = await api.patch(`/api/rules/${ruleId}`, { is_active: isActive });
  return data;
};

export const getDLQ = async (count: number = 50): Promise<DLQItem[]> => {
  const { data } = await api.get('/api/processing/dlq', { params: { count } });
  return data;
};

export const getFailures = async (limit: number = 50) => {
  const { data } = await api.get('/api/processing/failures', { params: { limit } });
  return data;
};

export const login = async (username: string = 'admin', password: string = 'admin123') => {
  const { data } = await api.post('/api/auth/login', { username, password });
  if (data?.access_token) {
    localStorage.setItem('spectra_token', data.access_token);
  }
  return data;
};

export default api;
