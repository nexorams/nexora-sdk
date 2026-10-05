import { HttpClient } from '../http/client.js';
import { ProjectInfo, RequestOptions, UsageSummary, UsageSummaryQuery } from '../types';

export class UsageResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Retrieve API call volume, successful requests, rate limit hits, and endpoint breakdowns.
   */
  public async summary(
    query?: UsageSummaryQuery,
    options?: RequestOptions
  ): Promise<UsageSummary> {
    return this.http.get<UsageSummary>('/usage', {
      ...options,
      query: {
        period: query?.period,
        ...(options?.query || {}),
      },
    });
  }

  /**
   * Retrieve authenticated developer project metadata, environment, status, and sector binding.
   */
  public async getProject(options?: RequestOptions): Promise<ProjectInfo> {
    return this.http.get<ProjectInfo>('/project', options);
  }
}
