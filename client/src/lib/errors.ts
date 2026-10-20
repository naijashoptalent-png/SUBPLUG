import axios from 'axios';
import { toast } from 'sonner';

export interface ApiErrorDetail {
  path: string;
  message: string;
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: ApiErrorDetail[];
  requestId?: string;

  constructor(status: number, code: string, message: string, details?: ApiErrorDetail[], requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }

  get isNetworkError() {
    return this.status === 0;
  }

  fieldError(path: string) {
    return this.details?.find((detail) => detail.path === path)?.message;
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return new ApiError(
        0,
        'NETWORK_ERROR',
        'We could not reach SubPlug. Check your connection and try again.'
      );
    }
    const data = error.response.data as
      | { error?: { code?: string; message?: string; details?: ApiErrorDetail[] }; requestId?: string }
      | undefined;
    return new ApiError(
      error.response.status,
      data?.error?.code ?? 'REQUEST_FAILED',
      data?.error?.message ?? 'Something went wrong. Please try again.',
      data?.error?.details,
      data?.requestId
    );
  }
  if (error instanceof Error) return new ApiError(0, 'CLIENT_ERROR', error.message);
  return new ApiError(0, 'CLIENT_ERROR', 'Something went wrong. Please try again.');
}

export function getErrorMessage(error: unknown) {
  return toApiError(error).message;
}

export function toastApiError(error: unknown, fallback?: string) {
  const parsed = toApiError(error);
  toast.error(fallback ?? parsed.message, {
    description: parsed.status === 429 ? 'Please wait a moment before trying again.' : undefined,
  });
  return parsed;
}

export function isUnauthenticated(error: unknown) {
  const parsed = toApiError(error);
  return parsed.status === 401 && ['UNAUTHENTICATED', 'SESSION_EXPIRED'].includes(parsed.code);
}
