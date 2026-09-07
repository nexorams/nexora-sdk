import { HttpClient } from '../http/client.js';
import { ListPlansQuery, PlanItem, RequestOptions } from '../types';

export class PlansResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List available subscription plans, tiers, and quotas, optionally filtered by sector.
   */
  public async list(
    query?: ListPlansQuery,
    options?: RequestOptions
  ): Promise<PlanItem[]> {
    return this.http.get<PlanItem[]>('/plans', {
      ...options,
      query: {
        organizationType: query?.organizationType || query?.sector,
        ...(options?.query || {}),
      },
    });
  }
}
