import { HttpClient } from '../http/client.js';
import { CreateDomainParams, DomainInfo, DomainVerificationResult, RequestOptions } from '../types';

export class DomainsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List custom domains configured for an organization.
   */
  public async list(
    organizationId: string,
    options?: RequestOptions
  ): Promise<DomainInfo[]> {
    return this.http.get<DomainInfo[]>(`/organizations/${organizationId}/domains`, options);
  }

  /**
   * Connect a custom domain to an organization.
   * Returns required DNS verification records (TXT/CNAME).
   */
  public async create(
    organizationId: string,
    params: CreateDomainParams,
    options?: RequestOptions
  ): Promise<DomainInfo> {
    const payload = {
      hostname: params.hostname || params.domain,
      ...params,
    };
    return this.http.post<DomainInfo>(`/organizations/${organizationId}/domains`, payload, options);
  }

  /**
   * Trigger authoritative DNS verification for a domain.
   * Note: Domains cannot be manually marked verified from the client.
   */
  public async verify(
    organizationId: string,
    domainId: string,
    options?: RequestOptions
  ): Promise<DomainVerificationResult> {
    return this.http.post<DomainVerificationResult>(
      `/organizations/${organizationId}/domains/${domainId}/verify`,
      {},
      options
    );
  }
}
