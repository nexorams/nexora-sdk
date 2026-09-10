import { HttpClient } from '../http/client.js';
import {
  DeveloperProjectDetails,
  ProjectModuleCreditsResponse,
  ProjectModulesResponse,
  RequestOptions,
} from '../types/index.js';

/**
 * Developer Project resource: inspect project details, active module selections,
 * role-specific capabilities, and developer account module credit capacity.
 */
export class ProjectResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Retrieve current authenticated developer project details.
   */
  public async get(options?: RequestOptions): Promise<DeveloperProjectDetails> {
    return this.http.get<DeveloperProjectDetails>('/project', options);
  }

  /**
   * List all modules, active statuses, capabilities, and sector bindings
   * for the project authenticated by the API key.
   */
  public async modules(options?: RequestOptions): Promise<ProjectModulesResponse> {
    return this.http.get<ProjectModulesResponse>('/project/modules', options);
  }

  /**
   * Get the developer account module credit allocation, usage, and remaining capacity.
   */
  public async moduleCredits(options?: RequestOptions): Promise<ProjectModuleCreditsResponse> {
    return this.http.get<ProjectModuleCreditsResponse>('/project/module-credits', options);
  }
}
