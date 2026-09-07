import { HttpClient } from '../http/client';
import { RequestOptions, SubscriptionInfo } from '../types';

export class SubscriptionsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Retrieve active subscription, tier, active feature count, limits, and 30-day trial status for an organization.
   * Nexora TrialPolicyService on the backend remains authoritative.
   */
  public async get(
    organizationId: string,
    options?: RequestOptions
  ): Promise<SubscriptionInfo> {
    return this.http.get<SubscriptionInfo>(`/organizations/${organizationId}/subscription`, options);
  }
}
