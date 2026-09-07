import * as crypto from 'crypto';
import { HttpClient } from '../http/client.js';
import { CreateWebhookParams, RequestOptions, WebhookEndpoint } from '../types/index.js';

export class WebhooksResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Register a new webhook endpoint.
   * In LIVE mode, URLs must use HTTPS and pass SSRF validation.
   * Secret is returned once upon creation.
   */
  public async create(
    params: CreateWebhookParams,
    options?: RequestOptions
  ): Promise<WebhookEndpoint> {
    return this.http.post<WebhookEndpoint>('/webhook-endpoints', params, options);
  }

  /**
   * List registered webhook endpoints for the authenticated project.
   */
  public async list(options?: RequestOptions): Promise<WebhookEndpoint[]> {
    return this.http.get<WebhookEndpoint[]>('/webhook-endpoints', options);
  }

  /**
   * Delete a registered webhook endpoint.
   */
  public async delete(
    id: string,
    options?: RequestOptions
  ): Promise<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`/webhook-endpoints/${id}`, options);
  }

  /**
   * Verify an incoming webhook signature using HMAC-SHA256 and constant-time comparison.
   * Matches the canonical Nexora backend WebhookSigningService algorithm.
   *
   * Supports:
   * 1. Standard Nexora-Signature: "t=1700000000,v1=abcdef..."
   * 2. Direct HMAC hash: "v1=abcdef..." or raw hex
   *
   * @param payload Raw body buffer or string received from the webhook POST request
   * @param header The Nexora-Signature or X-Nexora-Signature header string
   * @param secret The webhook endpoint's HMAC signing secret (whsec_...)
   * @param toleranceSeconds Maximum allowed clock skew in seconds (default 300 = 5 minutes). Pass 0 to disable timestamp check.
   */
  public static verifySignature(
    payload: string | Buffer,
    header: string,
    secret: string,
    toleranceSeconds: number = 300
  ): boolean {
    if (!payload || !header || !secret) {
      return false;
    }

    const payloadString = typeof payload === 'string' ? payload : payload.toString('utf8');

    let timestamp: number | null = null;
    let signatureHash: string | null = null;

    if (header.includes('t=') && header.includes('v1=')) {
      const parts = header.split(',');
      for (const part of parts) {
        const [k, v] = part.trim().split('=');
        if (k === 't') {
          timestamp = parseInt(v, 10);
        } else if (k === 'v1') {
          signatureHash = v;
        }
      }
    } else if (header.startsWith('v1=')) {
      signatureHash = header.slice(3);
    } else {
      signatureHash = header.trim();
    }

    if (!signatureHash) {
      return false;
    }

    // Verify timestamp within tolerance window to prevent replay attacks
    if (timestamp !== null && toleranceSeconds > 0) {
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - timestamp) > toleranceSeconds) {
        return false;
      }
    }

    // Compute expected signature: HMAC-SHA256 over `${timestamp}.${payload}`
    const signaturePayload = timestamp !== null ? `${timestamp}.${payloadString}` : payloadString;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(signaturePayload);
    const expectedHash = hmac.digest('hex');

    // Compute direct fallback in case payload was signed directly without timestamp prefix
    const directHmac = crypto.createHmac('sha256', secret);
    directHmac.update(payloadString);
    const directExpectedHash = directHmac.digest('hex');

    try {
      const actualBuf = Buffer.from(signatureHash, 'hex');
      const expectedBuf = Buffer.from(expectedHash, 'hex');
      if (actualBuf.length === expectedBuf.length && crypto.timingSafeEqual(actualBuf, expectedBuf)) {
        return true;
      }

      const directBuf = Buffer.from(directExpectedHash, 'hex');
      if (actualBuf.length === directBuf.length && crypto.timingSafeEqual(actualBuf, directBuf)) {
        return true;
      }
    } catch {
      return false;
    }

    return false;
  }

  /**
   * Instance helper for verifySignature.
   */
  public verifySignature(
    payload: string | Buffer,
    header: string,
    secret: string,
    toleranceSeconds: number = 300
  ): boolean {
    return WebhooksResource.verifySignature(payload, header, secret, toleranceSeconds);
  }
}
