import { ApiError } from './errors';

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  idempotencyKey?: string;
  skipAuth?: boolean;
}

export interface ApiCallLog {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  status: number;
  durationMs: number;
  correlationId: string;
  error?: string;
}

// In-memory ring buffer for the Developer Panel (last 20 API calls)
const apiCallHistory: ApiCallLog[] = [];
const MAX_LOGS = 20;

export function getApiCallHistory(): ApiCallLog[] {
  return [...apiCallHistory];
}

function recordApiCall(log: ApiCallLog) {
  apiCallHistory.unshift(log);
  if (apiCallHistory.length > MAX_LOGS) {
    apiCallHistory.pop();
  }
}

// Token storage accessor
let inMemoryToken: string | null = null;

export function setApiToken(token: string | null) {
  inMemoryToken = token;
  if (token) {
    sessionStorage.setItem('agrirent_token', token);
  } else {
    sessionStorage.removeItem('agrirent_token');
  }
}

export function getApiToken(): string | null {
  if (inMemoryToken) return inMemoryToken;
  const stored = sessionStorage.getItem('agrirent_token');
  if (stored) {
    inMemoryToken = stored;
  }
  return inMemoryToken;
}

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Robust fetch wrapper with Bearer token injection, correlation tracing,
 * timeouts, typed ApiError parsing, and dev panel logging.
 */
export async function apiFetch<T = unknown>(
  url: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    timeoutMs = 12000,
    idempotencyKey,
    skipAuth = false,
    headers: customHeaders = {},
    ...fetchOptions
  } = options;

  const correlationId = generateUUID();
  const startTime = Date.now();

  const headers = new Headers(customHeaders);
  headers.set('Accept', 'application/json');
  headers.set('X-Correlation-Id', correlationId);

  if (!skipAuth) {
    const token = getApiToken();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  if (idempotencyKey) {
    headers.set('Idempotency-Key', idempotencyKey);
  }

  if (fetchOptions.body && !(fetchOptions.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const durationMs = Date.now() - startTime;
    const isXml = response.headers.get('content-type')?.includes('xml');

    if (!response.ok) {
      let errorCode = `HTTP_${response.status}`;
      let errorMessage = response.statusText || 'Request failed';
      let errorDetails: unknown = null;
      let respCorrelation = response.headers.get('x-correlation-id') || correlationId;

      const retryAfterHeader = response.headers.get('retry-after');
      const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;

      try {
        if (!isXml) {
          const errorJson = await response.json();
          // Support both error structures ({ error: { code, message } } and { success: false, error: { ... } })
          const errPayload = errorJson.error || errorJson;
          if (errPayload.code) errorCode = errPayload.code;
          if (errPayload.message) errorMessage = errPayload.message;
          if (errPayload.details) errorDetails = errPayload.details;
          if (errPayload.correlationId) respCorrelation = errPayload.correlationId;
        } else {
          errorMessage = await response.text();
        }
      } catch {
        // Fallback to generic status text
      }

      recordApiCall({
        id: generateUUID(),
        timestamp: new Date().toISOString(),
        method: fetchOptions.method || 'GET',
        url,
        status: response.status,
        durationMs,
        correlationId: respCorrelation,
        error: `${errorCode}: ${errorMessage}`,
      });

      throw new ApiError(
        response.status,
        errorCode,
        errorMessage,
        respCorrelation,
        errorDetails,
        retryAfter
      );
    }

    recordApiCall({
      id: generateUUID(),
      timestamp: new Date().toISOString(),
      method: fetchOptions.method || 'GET',
      url,
      status: response.status,
      durationMs,
      correlationId,
    });

    if (response.status === 204) {
      return {} as T;
    }

    const data = await response.json();
    return data as T;
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    if (err instanceof ApiError) {
      throw err;
    }

    const durationMs = Date.now() - startTime;
    let message = (err as Error)?.message || 'Network request failed';
    let code = 'NETWORK_ERROR';

    if ((err as Error)?.name === 'AbortError') {
      code = 'UPSTREAM_TIMEOUT';
      message = `Request timed out after ${timeoutMs}ms.`;
    }

    recordApiCall({
      id: generateUUID(),
      timestamp: new Date().toISOString(),
      method: fetchOptions.method || 'GET',
      url,
      status: 0,
      durationMs,
      correlationId,
      error: `${code}: ${message}`,
    });

    throw new ApiError(0, code, message, correlationId);
  }
}
