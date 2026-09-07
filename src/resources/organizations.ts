import { HttpClient } from '../http/client';
import {
  CreateOrganizationParams,
  DomainInfo,
  DomainVerificationResult,
  ListOrganizationsQuery,
  Organization,
  PaginatedResult,
  RequestOptions,
  SubscriptionInfo,
  UpdateModulesParams,
  UpdateOrganizationParams,
} from '../types';

export class OrganizationsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Provision a new tenant organization (School, Hospital, Hotel, Pharmacy, or Enterprise).
   * Backend strictly validates sector types, country, and owner details.
   */
  public async create(
    params: CreateOrganizationParams,
    options?: RequestOptions
  ): Promise<Organization> {
    return this.http.post<Organization>('/organizations', params, options);
  }

  /**
   * List organizations authorized under the authenticated developer project.
   */
  public async list(
    query?: ListOrganizationsQuery,
    options?: RequestOptions
  ): Promise<PaginatedResult<Organization>> {
    return this.http.get<PaginatedResult<Organization>>('/organizations', {
      ...options,
      query: {
        page: query?.page,
        limit: query?.limit,
        search: query?.search,
        status: query?.status,
        type: query?.type,
        environment: query?.environment,
        ...(options?.query || {}),
      },
    });
  }

  /**
   * Retrieve organization details by ID.
   */
  public async get(id: string, options?: RequestOptions): Promise<Organization> {
    return this.http.get<Organization>(`/organizations/${id}`, options);
  }

  /**
   * Update organization branding, address, phone, currency, or theme.
   */
  public async update(
    id: string,
    params: UpdateOrganizationParams,
    options?: RequestOptions
  ): Promise<Organization> {
    return this.http.patch<Organization>(`/organizations/${id}`, params, options);
  }

  /**
   * Update enabled feature modules for an organization.
   */
  public async updateModules(
    id: string,
    params: UpdateModulesParams,
    options?: RequestOptions
  ): Promise<{ organizationId: string; activeFeatures: string[]; updatedAt: string }> {
    return this.http.patch(`/organizations/${id}/modules`, params, options);
  }

  /**
   * Retrieve subscription and 30-day trial status for an organization.
   */
  public async getSubscription(
    id: string,
    options?: RequestOptions
  ): Promise<SubscriptionInfo> {
    return this.http.get<SubscriptionInfo>(`/organizations/${id}/subscription`, options);
  }

  /**
   * List custom domains configured for an organization.
   */
  public async getDomains(
    id: string,
    options?: RequestOptions
  ): Promise<DomainInfo[]> {
    return this.http.get<DomainInfo[]>(`/organizations/${id}/domains`, options);
  }

  /**
   * Add a custom domain to an organization.
   */
  public async addDomain(
    id: string,
    params: { hostname?: string; domain?: string; isPrimary?: boolean },
    options?: RequestOptions
  ): Promise<DomainInfo> {
    const payload = {
      hostname: params.hostname || params.domain,
      ...params,
    };
    return this.http.post<DomainInfo>(`/organizations/${id}/domains`, payload, options);
  }

  /**
   * Trigger DNS verification for an organization's custom domain.
   */
  public async verifyDomain(
    id: string,
    domainId: string,
    options?: RequestOptions
  ): Promise<DomainVerificationResult> {
    return this.http.post<DomainVerificationResult>(
      `/organizations/${id}/domains/${domainId}/verify`,
      {},
      options
    );
  }
}
