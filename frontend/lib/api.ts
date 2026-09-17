import axios, { AxiosError } from 'axios';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const apiClient = api;

// Global request interceptor: automatically attach active workspace context
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const activeClientId = localStorage.getItem('activeClientId');
      if (activeClientId) {
        config.headers = config.headers || {};
        if (!config.headers['X-Client-Id'] && !config.headers['x-client-id']) {
          config.headers['X-Client-Id'] = activeClientId;
        }
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  errors?: any;
}

// Global response interceptor
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiResponse>) => {
    // If 401 Unauthorized and not on login page, can handle session redirect
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const isAuthPage = window.location.pathname.startsWith('/login') ||
                         window.location.pathname.startsWith('/forgot-password') ||
                         window.location.pathname.startsWith('/reset-password');
      if (!isAuthPage) {
        // Option to redirect to login
      }
    }
    return Promise.reject(error);
  }
);

export const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const apiError = error.response?.data as ApiResponse;
    if (apiError?.message) {
      if (Array.isArray(apiError.errors) && apiError.errors.length > 0) {
        return `${apiError.message}: ${apiError.errors.map((e) => e.message || e).join(', ')}`;
      }
      return apiError.message;
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
};
