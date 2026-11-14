import { NexoraError } from './errors/NexoraError.js';
import { WebhooksResource } from './resources/webhooks.js';
import { parseRetryAfter } from './http/retryAfter.js';
import { USER_AGENT } from './version.js';

/**
 * Helpers for Nexora Marketplace apps that run on the developer's own server.
 *
 *   MarketplaceAuth  – the token endpoint: trade the one-time code an organization administrator approved for tokens, and refresh them.
 *   TokenManager     – keeps the tokens, refreshes the access token before it expires (one refresh at a time), and plugs into `new Nexora({ getAccessToken })`.
 *   constructWebhookEvent – verify and parse a webhook delivery.
 *
 * The client secret and the refresh token are SERVER secrets. These helpers refuse to run inside a browser page.
 */

const DEFAULT_BASE_URL = 'https://api.nexoragms.com/api/v1';

export interface MarketplaceAuthOptions {
  clientId: string;
  /** Keep on your server (environment variable / secret manager). Never in front-end code. */
  clientSecret: string;
  /** Marketplace API base, default https://api.nexoragms.com/api/v1 (the token endpoint is not under /developer/v1). */
  baseUrl?: string;
  timeoutMs?: number;
  /** Only for tests that stub `window`. Real browsers must never hold a client secret. */
  allowBrowser?: boolean;
}

/** The claims of an access token. Informational: the API re-checks live state on every request, so a claim never grants anything by itself. */
export interface TokenClaims {
  iss: string;
  /** The app client the token was issued to. */
  aud: string;
  /** The user id when the app was opened from Nexora (launch), otherwise `installation:<id>`. */
  sub: string;
  userId?: string;
  organizationId: string;
  installationId: string;
  appId: string;
  appVersion: string | null;
  environment: 'LIVE' | 'TEST';
  scope: string[];
  iat: number;
  exp: number;
  jti: string;
}

export type TokenIntrospection = ({ active: true } & TokenClaims) | { active: false };

export interface TokenSet {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  /** When the access token stops working (computed from `expiresIn` when it was received). */
  expiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresIn: number;
  /** Permissions currently granted to the installation. */
  scope: string[];
  installationId: string;
  /** Present when the server sent them (Nexora 2026-10-17 and later). */
  claims?: TokenClaims;
}

export interface TokenStore {
  load(): Promise<TokenSet | null> | TokenSet | null;
  save(tokens: TokenSet): Promise<void> | void;
  clear?(): Promise<void> | void;
}

/** A store that keeps tokens in memory only (fine for tests; a real app persists them so a restart does not lose the connection). */
export class MemoryTokenStore implements TokenStore {
  private tokens: TokenSet | null = null;
  load() { return this.tokens; }
  save(tokens: TokenSet) { this.tokens = tokens; }
  clear() { this.tokens = null; }
}

function insideBrowser(): boolean {
  const g = globalThis as any;
  return typeof g.window !== 'undefined' && typeof g.document !== 'undefined';
}

export class MarketplaceAuth {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: MarketplaceAuthOptions) {
    if (!options || !options.clientId || !options.clientSecret) {
      throw new NexoraError({ message: 'clientId and clientSecret are required.', code: 'MISSING_CLIENT_CREDENTIALS', status: 400 });
    }
    if (insideBrowser() && !options.allowBrowser) {
      throw new NexoraError({
        message: 'Marketplace client credentials must stay on your server. Call your own backend from the browser and let it use MarketplaceAuth.',
        code: 'CLIENT_SECRET_IN_BROWSER',
        status: 400,
      });
    }
    this.clientId = options.clientId.trim();
    this.clientSecret = options.clientSecret.trim();
    this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs || 15000;
  }

  /** Trade the one-time `code` from the redirect (valid 60 seconds, single use) for tokens. `redirectUri` must equal the URL the code was sent to. */
  public exchangeCode(input: { code: string; redirectUri: string; codeVerifier?: string }): Promise<TokenSet> {
    if (!input || !input.code || !input.redirectUri) throw new NexoraError({ message: 'code and redirectUri are required.', code: 'INVALID_REQUEST', status: 400 });
    return this.post({ grant_type: 'authorization_code', code: input.code, redirect_uri: input.redirectUri, ...(input.codeVerifier ? { code_verifier: input.codeVerifier } : {}) });
  }

  /** Refresh tokens are single use: the response contains the NEXT one, which you must store before using the new access token. */
  public refresh(refreshToken: string): Promise<TokenSet> {
    if (!refreshToken) throw new NexoraError({ message: 'refreshToken is required.', code: 'INVALID_REQUEST', status: 400 });
    return this.post({ grant_type: 'refresh_token', refresh_token: refreshToken });
  }

  /**
   * Ask Nexora whether an access token is still good, and what it says. Use this on YOUR server for a token a browser handed you: never trust
   * claims copied from a browser. Always resolves; `{ active: false }` means unknown, expired, revoked, issued to another client, or the
   * installation (or the user it was issued for) can no longer act.
   */
  public async introspect(token: string): Promise<TokenIntrospection> {
    if (!token) throw new NexoraError({ message: 'token is required.', code: 'INVALID_REQUEST', status: 400 });
    const json = await this.request('/marketplace/oauth/introspect', { token });
    return json && json.active === true ? (json as TokenIntrospection) : { active: false };
  }

  /**
   * The signing secret for the installation behind an access token from the connection the ORGANIZATION ADMINISTRATOR made (not one issued for a person who
   * launched the app). Call it on your server, keep the secret out of logs and out of the browser, and read it again after the organization rotates it.
   * During a rotation grace window `previousSecret` is also returned; `constructWebhookEvent` accepts either (pass the one you hold).
   */
  public async webhookSecret(token: string): Promise<{ secret: string; version: number; previousSecret?: string; graceEndsAt?: string }> {
    if (!token) throw new NexoraError({ message: 'token is required.', code: 'INVALID_REQUEST', status: 400 });
    const json = await this.request('/marketplace/oauth/webhook-secret', { token });
    return json as { secret: string; version: number; previousSecret?: string; graceEndsAt?: string };
  }

  /**
   * End a token from your server, for example when a user disconnects: a refresh token ends the whole connection, an access token only itself. Resolves for any
   * client that authenticates, whether or not the token existed or was yours (the answer never reveals other tokens).
   */
  public async revoke(token: string): Promise<void> {
    if (!token) throw new NexoraError({ message: 'token is required.', code: 'INVALID_REQUEST', status: 400 });
    await this.request('/marketplace/oauth/revoke', { token });
  }

  private async post(params: Record<string, string>): Promise<TokenSet> {
    const json = await this.request('/marketplace/oauth/token', params);
    const now = Date.now();
    return {
      accessToken: json.access_token, tokenType: 'Bearer', expiresIn: json.expires_in, expiresAt: new Date(now + Number(json.expires_in) * 1000),
      refreshToken: json.refresh_token, refreshTokenExpiresIn: json.refresh_token_expires_in,
      scope: typeof json.scope === 'string' && json.scope ? json.scope.split(' ') : [], installationId: json.installation_id,
      ...(json.claims ? { claims: json.claims as TokenClaims } : {}),
    };
  }

  private async request(path: string, params: Record<string, string>): Promise<any> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': USER_AGENT },
        body: JSON.stringify({ ...params, client_id: this.clientId, client_secret: this.clientSecret }),
        signal: controller.signal,
      });
      let json: any = null;
      try { json = await res.json(); } catch { /* non-JSON */ }
      if (!res.ok) {
        const e = (json && json.error) || {};
        throw new NexoraError({
          message: e.message || `Token request failed with status ${res.status}`,
          code: e.code || `HTTP_${res.status}`,
          alias: typeof e.alias === 'string' ? e.alias : undefined,
          status: res.status,
          requestId: e.requestId || res.headers.get('x-request-id') || undefined,
          retryAfter: parseRetryAfter(res.headers.get('retry-after')),
        });
      }
      return json;
    } catch (err: any) {
      if (err instanceof NexoraError) throw err;
      if (err && err.name === 'AbortError') throw new NexoraError({ message: `Token request timed out after ${this.timeoutMs}ms`, code: 'REQUEST_TIMEOUT', status: 408 });
      throw new NexoraError({ message: (err && err.message) || 'Network connection failed', code: 'NETWORK_ERROR', status: 0 });
    } finally {
      clearTimeout(timer);
    }
  }
}

export interface TokenManagerOptions {
  /** Refresh this many seconds before the access token expires (default 60). */
  skewSeconds?: number;
}

/**
 * Hands out a valid access token for one installation. It refreshes ahead of expiry, and only ONE refresh runs at a time:
 * a refresh token can be used once, so two concurrent refreshes would make Nexora treat the second as a stolen token and cut the connection.
 */
export class TokenManager {
  private cached: TokenSet | null = null;
  private inflight: Promise<TokenSet> | null = null;
  private readonly skewMs: number;

  constructor(private readonly auth: MarketplaceAuth, private readonly store: TokenStore = new MemoryTokenStore(), options: TokenManagerOptions = {}) {
    this.skewMs = (options.skewSeconds ?? 60) * 1000;
  }

  /** Call once with the `code` from the redirect: exchanges it and stores the tokens. */
  public async connect(input: { code: string; redirectUri: string; codeVerifier?: string }): Promise<TokenSet> {
    const tokens = await this.auth.exchangeCode(input);
    this.cached = tokens;
    await this.store.save(tokens);
    return tokens;
  }

  public async getAccessToken(options: { forceRefresh?: boolean } = {}): Promise<string> {
    let tokens = this.cached || (await this.store.load());
    if (!tokens) throw new NexoraError({ message: 'This installation has not been connected yet. Send an organization administrator through "Connect" first.', code: 'NOT_CONNECTED', status: 401 });
    this.cached = tokens;
    const fresh = tokens.expiresAt.getTime() - Date.now() > this.skewMs;
    if (fresh && !options.forceRefresh) return tokens.accessToken;
    tokens = await this.refreshOnce(tokens);
    return tokens.accessToken;
  }

  private refreshOnce(current: TokenSet): Promise<TokenSet> {
    if (this.inflight) return this.inflight;
    this.inflight = (async () => {
      try {
        const next = await this.auth.refresh(current.refreshToken);
        this.cached = next;                                    // keep the new tokens even if persisting them fails: the old refresh token is already spent
        try { await this.store.save(next); } catch (e: any) { throw new NexoraError({ message: `Tokens were refreshed but could not be saved: ${e && e.message}`, code: 'TOKEN_STORE_FAILED', status: 500 }); }
        return next;
      } catch (err) {
        if (err instanceof NexoraError && err.code === 'INVALID_GRANT') {
          this.cached = null;
          try { if (this.store.clear) await this.store.clear(); } catch { /* best effort */ }
          throw new NexoraError({ message: 'The connection is no longer valid. An organization administrator must connect the app again.', code: 'REAUTHORIZATION_REQUIRED', status: 401, requestId: err.requestId });
        }
        throw err;
      } finally {
        this.inflight = null;
      }
    })();
    return this.inflight;
  }
}

export interface WebhookEvent<T = Record<string, unknown>> {
  id: string;
  type: string;
  apiVersion: string;
  /** `live`, or `test` for a sandbox installation. Absent on events queued before the field existed — treat as `live`. */
  environment?: 'live' | 'test';
  createdAt: string;
  data: { installationId: string } & T;
}

/**
 * Verify a webhook delivery and return the parsed event.
 * Pass the RAW request body (the exact bytes, before any JSON parsing) and the request headers. Throws `INVALID_WEBHOOK_SIGNATURE` when the
 * signature is wrong or older than the tolerance (default 5 minutes), which also defeats replay of old deliveries. Delivery is at-least-once:
 * de-duplicate on `event.id`.
 */
export function constructWebhookEvent<T = Record<string, unknown>>(
  rawBody: string | Buffer,
  headers: Record<string, string | string[] | undefined>,
  secret: string,
  toleranceSeconds: number = 300
): WebhookEvent<T> {
  const lower: Record<string, string | string[] | undefined> = {};
  for (const [k, v] of Object.entries(headers || {})) lower[k.toLowerCase()] = v;
  const pick = (name: string): string => { const v = lower[name]; return Array.isArray(v) ? v[0] : v || ''; };
  const signature = pick('x-nexora-signature') || pick('nexora-signature');
  if (!signature || !WebhooksResource.verifySignature(rawBody, signature, secret, toleranceSeconds)) {
    throw new NexoraError({ message: 'The webhook signature is invalid or too old.', code: 'INVALID_WEBHOOK_SIGNATURE', status: 400 });
  }
  let event: any;
  try { event = JSON.parse(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8')); } catch {
    throw new NexoraError({ message: 'The webhook body is not valid JSON.', code: 'INVALID_WEBHOOK_BODY', status: 400 });
  }
  if (!event || typeof event.id !== 'string' || typeof event.type !== 'string' || !event.data || typeof event.data !== 'object') {
    throw new NexoraError({ message: 'The webhook body is not a Nexora event.', code: 'INVALID_WEBHOOK_BODY', status: 400 });
  }
  const headerId = pick('x-nexora-event-id');
  if (headerId && headerId !== event.id) throw new NexoraError({ message: 'The event id header does not match the body.', code: 'INVALID_WEBHOOK_BODY', status: 400 });
  return event as WebhookEvent<T>;
}
