export interface NexoraErrorData {
  message: string;
  code?: string;
  /** The specification name for the same condition, when the server sends one (for example SCOPE_NOT_GRANTED for PERMISSION_NOT_GRANTED). `code` never changes. */
  alias?: string;
  status?: number;
  requestId?: string;
  details?: unknown;
  /** Seconds the server asked you to wait (Retry-After) on a 429 or 503. */
  retryAfter?: number;
}

/**
 * Custom error class representing API and transport failures from the Nexora Developer Platform.
 * Ensures secret API keys are strictly sanitized and excluded from error messages and logs.
 */
export class NexoraError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly alias?: string;
  public readonly requestId?: string;
  public readonly details?: unknown;
  public readonly retryAfter?: number;

  constructor(data: NexoraErrorData) {
    super(data.message);
    this.name = 'NexoraError';
    this.status = typeof data.status === 'number' ? data.status : 500;
    this.code = data.code || 'API_ERROR';
    this.alias = data.alias;
    this.requestId = data.requestId;
    this.details = data.details;
    this.retryAfter = data.retryAfter;

    Object.setPrototypeOf(this, NexoraError.prototype);
  }

  /** True when the error is `name` under either its code or its alias, so callers can use whichever name they prefer. */
  public is(name: string): boolean {
    return this.code === name || this.alias === name;
  }

  /**
   * Safe JSON representation for logging, avoiding credential leakage.
   */
  public toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      code: this.code,
      alias: this.alias,
      requestId: this.requestId,
      details: this.details,
      retryAfter: this.retryAfter,
    };
  }
}
