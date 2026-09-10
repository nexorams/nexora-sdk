import { NexoraError } from './errors/NexoraError.js';
import { HttpClient } from './http/client.js';
import { CompanyResource } from './resources/company.js';
import { WebhookDeliveriesResource } from './resources/deliveries.js';
import { DomainsResource } from './resources/domains.js';
import { HospitalResource } from './resources/hospital.js';
import { HotelResource } from './resources/hotel.js';
import { ModulesResource } from './resources/modules.js';
import { OrganizationsResource } from './resources/organizations.js';
import { PharmacyResource } from './resources/pharmacy.js';
import { PlansResource } from './resources/plans.js';
import { ProjectResource } from './resources/project.js';
import { SchoolResource } from './resources/school.js';
import { SubscriptionsResource } from './resources/subscriptions.js';
import { UsageResource } from './resources/usage.js';
import { UsersResource } from './resources/users.js';
import { WebhooksResource } from './resources/webhooks.js';
import { Environment, NexoraClientOptions } from './types';

export class Nexora {
  public readonly apiKey: string;
  public readonly environment: Environment;
  public readonly baseUrl: string;

  public readonly project: ProjectResource;
  public readonly organizations: OrganizationsResource;
  public readonly users: UsersResource;
  public readonly modules: ModulesResource;
  public readonly plans: PlansResource;
  public readonly subscriptions: SubscriptionsResource;
  public readonly domains: DomainsResource;
  public readonly webhooks: WebhooksResource;
  public readonly deliveries: WebhookDeliveriesResource;
  public readonly usage: UsageResource;

  // Sector Domain Resources
  public readonly school: SchoolResource;
  public readonly hospital: HospitalResource;
  public readonly hotel: HotelResource;
  public readonly pharmacy: PharmacyResource;
  public readonly company: CompanyResource;

  private readonly http: HttpClient;

  constructor(options: NexoraClientOptions) {
    if (!options || !options.apiKey) {
      throw new NexoraError({
        message: 'API key is required to initialize the Nexora SDK.',
        code: 'MISSING_API_KEY',
        status: 400,
      });
    }

    const key = options.apiKey.trim();
    if (!key.startsWith('nx_test_') && !key.startsWith('nx_live_')) {
      throw new NexoraError({
        message: "Invalid API key prefix. Expected 'nx_test_' for sandbox or 'nx_live_' for live.",
        code: 'INVALID_API_KEY_FORMAT',
        status: 400,
      });
    }

    this.apiKey = key;
    this.environment = options.environment || (key.startsWith('nx_live_') ? 'live' : 'sandbox');

    // Default to the authoritative Nexora Developer API base URL
    const defaultBaseUrl = 'https://api.nexoragms.com/developer/v1';

    this.baseUrl = options.baseUrl ? options.baseUrl.replace(/\/+$/, '') : defaultBaseUrl;

    this.http = new HttpClient(
      this.apiKey,
      this.baseUrl,
      options.timeoutMs || 30000,
      options.organizationId
    );

    this.project = new ProjectResource(this.http);
    this.organizations = new OrganizationsResource(this.http);
    this.users = new UsersResource(this.http);
    this.modules = new ModulesResource(this.http);
    this.plans = new PlansResource(this.http);
    this.subscriptions = new SubscriptionsResource(this.http);
    this.domains = new DomainsResource(this.http);
    this.webhooks = new WebhooksResource(this.http);
    this.deliveries = new WebhookDeliveriesResource(this.http);
    this.usage = new UsageResource(this.http);

    // Sector Domain Resources
    this.school = new SchoolResource(this.http);
    this.hospital = new HospitalResource(this.http);
    this.hotel = new HotelResource(this.http);
    this.pharmacy = new PharmacyResource(this.http);
    this.company = new CompanyResource(this.http);
  }

  /**
   * Static helper to cryptographically verify incoming webhook signatures.
   */
  public static verifyWebhookSignature(
    payload: string | Buffer,
    header: string,
    secret: string,
    toleranceSeconds: number = 300
  ): boolean {
    return WebhooksResource.verifySignature(payload, header, secret, toleranceSeconds);
  }
}

// Named alias for convenience
export { Nexora as NexoraClient };
