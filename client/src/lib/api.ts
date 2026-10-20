import axios, {
  AxiosError,
  AxiosHeaders,
  type InternalAxiosRequestConfig,
} from 'axios';
import { ApiError, toApiError } from './errors';

const API_ORIGIN = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
export const API_BASE = `${API_ORIGIN}/api/v1`;

interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  _csrfRetry?: boolean;
  _skipRefresh?: boolean;
}

let csrfToken: string | null = null;
let csrfPromise: Promise<string> | null = null;
let refreshPromise: Promise<void> | null = null;
let lastSessionEvent = 0;

function emitSessionExpired() {
  if (Date.now() - lastSessionEvent < 1500) return;
  lastSessionEvent = Date.now();
  window.dispatchEvent(new CustomEvent('qt:session-expired'));
}

async function fetchCsrfToken(): Promise<string> {
  const response = await axios.get<{ data: { csrfToken: string } }>(`${API_BASE}/auth/csrf`, {
    withCredentials: true,
    timeout: 15000,
    headers: { Accept: 'application/json' },
  });
  csrfToken = response.data.data.csrfToken;
  return csrfToken;
}

export async function ensureCsrfToken(force = false): Promise<string> {
  if (csrfToken && !force) return csrfToken;
  if (!csrfPromise) {
    csrfPromise = fetchCsrfToken().finally(() => {
      csrfPromise = null;
    });
  }
  return csrfPromise;
}

export function resetCsrfToken() {
  csrfToken = null;
}

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 30000,
  headers: { Accept: 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const method = (config.method ?? 'get').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    try {
      const token = await ensureCsrfToken();
      if (config.headers instanceof AxiosHeaders) {
        config.headers.set('X-CSRF-Token', token);
      } else {
        config.headers = AxiosHeaders.from(config.headers ?? {});
        config.headers.set('X-CSRF-Token', token);
      }
    } catch {
      // The API will return a clear CSRF error; the caller sees a useful message.
    }
  }
  return config;
});

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      await ensureCsrfToken();
      await axios.post(
        `${API_BASE}/auth/refresh`,
        {},
        {
          withCredentials: true,
          timeout: 15000,
          headers: {
            Accept: 'application/json',
            'X-CSRF-Token': csrfToken ?? '',
          },
        }
      );
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function isRefreshableRequest(url: string | undefined) {
  if (!url) return false;
  return ![
    '/auth/login',
    '/auth/2fa/login',
    '/auth/register',
    '/auth/refresh',
    '/auth/csrf',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/verify-email',
  ].some((path) => url.startsWith(path));
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined;
    const status = error.response?.status;
    const code = (error.response?.data as { error?: { code?: string } } | undefined)?.error?.code;

    if (status === 403 && code === 'CSRF_VALIDATION_FAILED' && config && !config._csrfRetry) {
      config._csrfRetry = true;
      try {
        const token = await ensureCsrfToken(true);
        config.headers = AxiosHeaders.from(config.headers ?? {});
        config.headers.set('X-CSRF-Token', token);
        return api(config);
      } catch {
        return Promise.reject(toApiError(error));
      }
    }

    if (
      status === 401 &&
      config &&
      !config._retry &&
      !config._skipRefresh &&
      isRefreshableRequest(config.url)
    ) {
      config._retry = true;
      try {
        await refreshAccessToken();
        return api(config);
      } catch {
        emitSessionExpired();
        return Promise.reject(toApiError(error));
      }
    }

    if (status === 401 && config && !config._skipRefresh && isRefreshableRequest(config.url)) {
      emitSessionExpired();
    }

    return Promise.reject(toApiError(error));
  }
);

export async function getData<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const response = await api.get<{ data: T }>(url, { params });
  return response.data.data;
}

export async function postData<T>(url: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
  const response = await api.post<{ data: T }>(url, body, { headers });
  return response.data.data;
}

export async function patchData<T>(url: string, body?: unknown): Promise<T> {
  const response = await api.patch<{ data: T }>(url, body);
  return response.data.data;
}

export async function putData<T>(url: string, body?: unknown): Promise<T> {
  const response = await api.put<{ data: T }>(url, body);
  return response.data.data;
}

export async function deleteData<T>(url: string): Promise<T> {
  const response = await api.delete<{ data: T }>(url);
  return response.data.data;
}

export function apiErrorMessage(error: unknown): string {
  return toApiError(error).message;
}

export { ApiError };
