import { NexoraError } from '../errors/NexoraError.js';
import type { RequestOptions } from '../types/index.js';

export class HttpClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultTimeoutMs: number;

  constructor(apiKey: string, baseUrl: string, timeoutMs: number = 30000) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.defaultTimeoutMs = timeoutMs;
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

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Nexora-Node-SDK/1.0.0',
      ...(options?.headers || {}),
    };

    if (options?.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey.trim();
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
          status: response.status,
          requestId,
          details: errPayload.details || responseData,
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
