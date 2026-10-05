import { HttpClient } from '../http/client.js';
import { CreateUserParams, ListUsersQuery, PaginatedResult, RequestOptions, User } from '../types';

export class UsersResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Provision a staff member, practitioner, or client user inside a tenant organization.
   * Generates an invitation token for password setup. Note: Platform administration roles are forbidden.
   */
  public async create(
    organizationId: string,
    params: CreateUserParams,
    options?: RequestOptions
  ): Promise<User> {
    return this.http.post<User>(`/organizations/${organizationId}/users`, params, options);
  }

  /**
   * List safe user memberships in a tenant organization.
   */
  public async list(
    organizationId: string,
    query?: ListUsersQuery,
    options?: RequestOptions
  ): Promise<PaginatedResult<User>> {
    return this.http.get<PaginatedResult<User>>(`/organizations/${organizationId}/users`, {
      ...options,
      query: {
        role: query?.role,
        page: query?.page,
        limit: query?.limit,
        ...(options?.query || {}),
      },
    });
  }
}
