import { HttpClient } from '../http/client';
import { ListModulesQuery, ModuleItem, RequestOptions, UpdateModulesParams } from '../types';

export class ModulesResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List the full system catalog of Nexora extensible modules, optionally filtered by sector.
   */
  public async list(
    query?: ListModulesQuery,
    options?: RequestOptions
  ): Promise<ModuleItem[]> {
    return this.http.get<ModuleItem[]>('/modules', {
      ...options,
      query: {
        organizationType: query?.organizationType,
        ...(options?.query || {}),
      },
    });
  }

  /**
   * Update enabled modules for a specific organization.
   */
  public async update(
    organizationId: string,
    params: UpdateModulesParams,
    options?: RequestOptions
  ): Promise<{ organizationId: string; activeFeatures: string[]; updatedAt: string }> {
    return this.http.patch(`/organizations/${organizationId}/modules`, params, options);
  }
}
