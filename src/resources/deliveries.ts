import { HttpClient } from '../http/client.js';
import { ListDeliveriesQuery, PaginatedResult, RequestOptions, WebhookDelivery } from '../types';

export class WebhookDeliveriesResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List recent webhook deliveries and retry attempts across project endpoints.
   */
  public async list(
    query?: ListDeliveriesQuery,
    options?: RequestOptions
  ): Promise<PaginatedResult<WebhookDelivery>> {
    return this.http.get<PaginatedResult<WebhookDelivery>>('/webhook-deliveries', {
      ...options,
      query: {
        endpointId: query?.endpointId,
        status: query?.status,
        page: query?.page,
        limit: query?.limit,
        ...(options?.query || {}),
      },
    });
  }

  /**
   * Get delivery attempt details by ID, including payload, headers, and error logs.
   */
  public async get(id: string, options?: RequestOptions): Promise<WebhookDelivery> {
    return this.http.get<WebhookDelivery>(`/webhook-deliveries/${id}`, options);
  }

  /**
   * Manually trigger a redelivery of a failed webhook event.
   */
  public async retry(id: string, options?: RequestOptions): Promise<{ data?: WebhookDelivery; [key: string]: unknown }> {
    return this.http.post(`/webhook-deliveries/${id}/retry`, {}, options);
  }
}
