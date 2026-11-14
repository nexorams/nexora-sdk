import { NexoraError } from '../errors/NexoraError.js';
import type { RequestOptions, RetryOptions } from '../types/index.js';
import { parseRetryAfter } from './retryAfter.js';
import { USER_AGENT } from '../version.js';

type TokenSource = string | ((options: { forceRefresh: boolean }) => string | Promise<string>);
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class HttpClient {
  private readonly tokenSource: TokenSource;
  private readonly retry: Required<RetryOptions>;
  private readonly baseUrl: string;
  private readonly defaultTimeoutMs: number;
  public defaultOrganizationId?: string;

  constructor(apiKey: TokenSource, baseUrl: string, timeoutMs: number = 30000, defaultOrganizationId?: string, retry: RetryOptions = {}) {
    this.tokenSource = apiKey;
    this.retry = { maxRetries: 2, baseDelayMs: 500, maxDelayMs: 8000, maxRetryAfterMs: 30000, ...Object.fromEntries(Object.entries(retry).filter(([, v]) => v !== undefined)) } as Required<RetryOptions>;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.defaultTimeoutMs = timeoutMs;
    this.defaultOrganizationId = defaultOrganizationId;
  }

  /**
   * Internal request dispatcher for the Nexora Developer API.
   * Handles Bearer authentication, timeout abort, idempotency headers, query encoding, and error normalization.
   */
  public async request<T = any>(
    path: string,
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    body?: any,
    options?: RequestOptions
  ): Promise<T> {
    const maxRetries = options?.maxRetries ?? this.retry.maxRetries;
    // A retry must never repeat a write the server may already have performed: only reads, and writes that carry an Idempotency-Key, are retried
    // after a network failure, a timeout or a 502/503/504. A 429 is always safe (the request was refused before it ran).
    const replaySafe = method === 'GET' || !!options?.idempotencyKey?.trim();
    let attempt = 0;
    let refreshedToken = false;
    for (;;) {
      try {
        return await this.attemptRequest<T>(path, method, body, options, refreshedToken);
      } catch (err: any) {
        if (!(err instanceof NexoraError)) throw err;
        // an expired short-lived access token: ask the token provider for a fresh one and try once more (refused before it ran, so safe for any method)
        if (err.code === 'INSTALLATION_TOKEN_EXPIRED' && typeof this.tokenSource === 'function' && !refreshedToken) { refreshedToken = true; continue; }
        if (attempt >= maxRetries) throw err;
        const rateLimited = err.status === 429;
        const transient = err.code === 'NETWORK_ERROR' || err.code === 'REQUEST_TIMEOUT' || err.status === 502 || err.status === 503 || err.status === 504;
        if (!(rateLimited || (transient && replaySafe))) throw err;
        const wait = this.backoff(attempt, err.retryAfter);
        if (wait === null) throw err;                         // the server asked for a wait longer than we are willing to block for
        attempt += 1;
        await sleep(wait);
      }
    }
  }

  /** Milliseconds to wait before retry number attempt+1, or null when Retry-After is longer than maxRetryAfterMs. */
  private backoff(attempt: number, retryAfterSeconds?: number): number | null {
    if (retryAfterSeconds !== undefined) {
      const ms = retryAfterSeconds * 1000;
      return ms > this.retry.maxRetryAfterMs ? null : ms + Math.floor(Math.random() * 250);
    }
    const ceiling = Math.min(this.retry.maxDelayMs, this.retry.baseDelayMs * 2 ** attempt);
    return Math.floor(ceiling / 2 + Math.random() * (ceiling / 2));
  }

  private async resolveToken(forceRefresh: boolean): Promise<string> {
    if (typeof this.tokenSource === 'string') return this.tokenSource;
    try {
      const token = await this.tokenSource({ forceRefresh });
      if (typeof token !== 'string' || !token) throw new Error('empty token');
      return token;
    } catch (e: any) {
      if (e instanceof NexoraError) throw e;
      throw new NexoraError({ message: `The access token provider failed: ${e && e.message}`, code: 'TOKEN_PROVIDER_FAILED', status: 401 });
    }
  }

  private async attemptRequest<T>(
    path: string,
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    body: any,
    options: RequestOptions | undefined,
    forceRefresh: boolean
  ): Promise<T> {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const [pathOnly, rawQuery] = cleanPath.split('?');

    const searchParams = new URLSearchParams(rawQuery || '');
    if (options?.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined && value !== null) {
          searchParams.set(key, String(value));
        }
      }
    }

    const queryString = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const url = `${this.baseUrl}${pathOnly}${queryString}`;
    const timeoutMs = options?.timeoutMs || this.defaultTimeoutMs;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const token = await this.resolveToken(forceRefresh);
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': USER_AGENT,
      ...(options?.headers || {}),
    };

    if (options?.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey.trim();
    }

    // Installation tokens carry their organization; the server rejects a conflicting header, so never send one.
    const orgId = token.startsWith('nxi_') ? undefined : (options?.organizationId || this.defaultOrganizationId);
    if (orgId) {
      headers['X-Organization-Id'] = orgId.trim();
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timer);

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');

      let responseData: any = null;
      if (isJson) {
        responseData = await response.json();
      } else {
        const text = await response.text();
        responseData = text ? { message: text } : null;
      }

      if (!response.ok) {
        const errPayload = responseData?.error || responseData || {};
        const message =
          errPayload.message ||
          responseData?.message ||
          `Request failed with status ${response.status}`;
        const code = errPayload.code || responseData?.code || `HTTP_${response.status}`;
        const requestId =
          response.headers.get('x-request-id') ||
          response.headers.get('request-id') ||
          responseData?.requestId ||
          errPayload.requestId;

        throw new NexoraError({
          message,
          code,
          alias: typeof errPayload.alias === 'string' ? errPayload.alias : undefined,
          status: response.status,
          requestId,
          details: errPayload.details || responseData,
          retryAfter: parseRetryAfter(response.headers.get('retry-after')),
        });
      }

      // If paginated response ({ data: [...], pagination: {...} }), return envelope
      if (
        responseData &&
        typeof responseData === 'object' &&
        'data' in responseData &&
        'pagination' in responseData
      ) {
        return responseData as T;
      }

      // If wrapped in { success: true, data: ... } or { data: ... }, unwrap data
      if (
        responseData &&
        typeof responseData === 'object' &&
        'data' in responseData &&
        !('pagination' in responseData)
      ) {
        return responseData.data as T;
      }

      return responseData as T;
    } catch (err: any) {
      clearTimeout(timer);

      if (err instanceof NexoraError) {
        throw err;
      }

      if (err.name === 'AbortError') {
        throw new NexoraError({
          message: `Request timed out after ${timeoutMs}ms`,
          code: 'REQUEST_TIMEOUT',
          status: 408,
        });
      }

      throw new NexoraError({
        message: err.message || 'Network connection failed',
        code: 'NETWORK_ERROR',
        status: 0,
        details: err,
      });
    }
  }

  public get<T = any>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, 'GET', undefined, options);
  }

  public post<T = any>(path: string, body?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, 'POST', body, options);
  }

  public patch<T = any>(path: string, body?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, 'PATCH', body, options);
  }

  public delete<T = any>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, 'DELETE', undefined, options);
  }
}
