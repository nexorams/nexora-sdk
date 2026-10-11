import { NexoraError } from '../errors/NexoraError.js';
import { HttpClient } from '../http/client.js';
import type {
  CloudInstallationItem,
  CloudListQuery,
  CloudRecord,
  CloudRecordInput,
  CloudSchema,
  PaginatedResult,
  RequestOptions,
} from '../types';

const ENTITY_KEY = /^[a-z][a-z0-9_]{0,47}$/;
const APPLICATION_ID = /^[a-f0-9]{24}$/i;

/**
 * Generic client for ONE entity of ONE Nexora Cloud application. Nothing here is generated
 * or hard-coded per application: entity keys are data, resolved by the server against the
 * application's schema, the organization's grants and your API key's scopes.
 */
export class CloudEntityClient<T extends Record<string, unknown> = Record<string, unknown>> {
  constructor(
    private readonly http: HttpClient,
    public readonly applicationId: string,
    public readonly entityKey: string,
  ) {
    if (!APPLICATION_ID.test(applicationId)) {
      throw new NexoraError({ message: 'applicationId must be a Nexora Cloud application id.', code: 'INVALID_APPLICATION_ID', status: 400 });
    }
    if (!ENTITY_KEY.test(entityKey)) {
      throw new NexoraError({ message: `Invalid entity key '${entityKey}'. Entity keys are lowercase letters, digits and underscores.`, code: 'INVALID_ENTITY_KEY', status: 400 });
    }
  }

  private get base(): string {
    return `/cloud/apps/${this.applicationId}/entities/${this.entityKey}/records`;
  }

  list(query?: CloudListQuery, options?: RequestOptions): Promise<PaginatedResult<CloudRecord<T>>> {
    return this.http.get<PaginatedResult<CloudRecord<T>>>(this.base, {
      ...options,
      query: { page: query?.page, limit: query?.limit, status: query?.status, ...(options?.query || {}) },
    });
  }

  /** Iterates every page lazily. */
  async *listAll(query?: Omit<CloudListQuery, 'page'>, options?: RequestOptions): AsyncGenerator<CloudRecord<T>> {
    let page = 1;
    for (;;) {
      const result = await this.list({ ...query, page }, options);
      for (const record of result.data) yield record;
      if (page >= (result.pagination?.totalPages ?? 1) || result.data.length === 0) return;
      page += 1;
    }
  }

  get(id: string, options?: RequestOptions): Promise<CloudRecord<T>> {
    return this.http.get<CloudRecord<T>>(`${this.base}/${encodeURIComponent(id)}`, options);
  }

  /** Pass `options.idempotencyKey` to make retries safe. */
  create(input: CloudRecordInput<T>, options?: RequestOptions): Promise<CloudRecord<T>> {
    return this.http.post<CloudRecord<T>>(this.base, input, options);
  }

  update(id: string, input: CloudRecordInput<Partial<T>>, options?: RequestOptions): Promise<CloudRecord<T>> {
    return this.http.patch<CloudRecord<T>>(`${this.base}/${encodeURIComponent(id)}`, input, options);
  }

  /** Archives (soft-deletes) a record; data is never hard-deleted through the API. */
  archive(id: string, options?: RequestOptions): Promise<CloudRecord<T>> {
    return this.http.delete<CloudRecord<T>>(`${this.base}/${encodeURIComponent(id)}`, options);
  }

  /** Webhook event names for this entity, e.g. `cloud.members.created`. */
  events(): { created: string; updated: string; archived: string } {
    return { created: `cloud.${this.entityKey}.created`, updated: `cloud.${this.entityKey}.updated`, archived: `cloud.${this.entityKey}.archived` };
  }
}

export class CloudApplicationClient {
  constructor(private readonly http: HttpClient, public readonly applicationId: string) {}

  schema(options?: RequestOptions): Promise<CloudSchema> {
    return this.http.get<CloudSchema>(`/cloud/apps/${this.applicationId}/schema`, options);
  }

  entity<T extends Record<string, unknown> = Record<string, unknown>>(entityKey: string): CloudEntityClient<T> {
    return new CloudEntityClient<T>(this.http, this.applicationId, entityKey);
  }

  /**
   * Property access resolves entities dynamically: `app.entities.members.list()`.
   * No entity is known to the SDK in advance.
   */
  get entities(): Record<string, CloudEntityClient> {
    return new Proxy({} as Record<string, CloudEntityClient>, {
      get: (_target, prop) => (typeof prop === 'string' ? this.entity(prop) : undefined),
    });
  }
}

export class CloudResource {
  constructor(private readonly http: HttpClient, private readonly defaultApplicationId?: string) {}

  /** Organizations that granted this project access to an installed Cloud application. */
  installations(options?: RequestOptions): Promise<CloudInstallationItem[]> {
    return this.http.get<CloudInstallationItem[]>('/cloud/installations', options);
  }

  app(applicationId: string): CloudApplicationClient {
    return new CloudApplicationClient(this.http, applicationId);
  }

  private requireDefaultApplication(): string {
    if (!this.defaultApplicationId) {
      throw new NexoraError({ message: 'Set `applicationId` in the Nexora client options or use nexora.cloud.app(applicationId).', code: 'APPLICATION_ID_REQUIRED', status: 400 });
    }
    return this.defaultApplicationId;
  }

  entity<T extends Record<string, unknown> = Record<string, unknown>>(entityKey: string, applicationId?: string): CloudEntityClient<T> {
    return new CloudEntityClient<T>(this.http, applicationId || this.requireDefaultApplication(), entityKey);
  }

  schema(options?: RequestOptions): Promise<CloudSchema> {
    return this.app(this.requireDefaultApplication()).schema(options);
  }

  /** `nexora.cloud.entities.members.list()` on the client's default application. */
  get entities(): Record<string, CloudEntityClient> {
    return new Proxy({} as Record<string, CloudEntityClient>, {
      get: (_target, prop) => (typeof prop === 'string' ? this.entity(prop) : undefined),
    });
  }
}
