export interface NexoraErrorData {
  message: string;
  code?: string;
  status?: number;
  requestId?: string;
  details?: unknown;
}

/**
 * Custom error class representing API and transport failures from the Nexora Developer Platform.
 * Ensures secret API keys are strictly sanitized and excluded from error messages and logs.
 */
export class NexoraError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly requestId?: string;
  public readonly details?: unknown;

  constructor(data: NexoraErrorData) {
    super(data.message);
    this.name = 'NexoraError';
    this.status = typeof data.status === 'number' ? data.status : 500;
    this.code = data.code || 'API_ERROR';
    this.requestId = data.requestId;
    this.details = data.details;

    Object.setPrototypeOf(this, NexoraError.prototype);
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
      requestId: this.requestId,
      details: this.details,
    };
  }
}
