import { NexoraError } from './errors/NexoraError';
import { HttpClient } from './http/client';
import { WebhookDeliveriesResource } from './resources/deliveries';
import { DomainsResource } from './resources/domains';
import { ModulesResource } from './resources/modules';
import { OrganizationsResource } from './resources/organizations';
import { PlansResource } from './resources/plans';
import { SubscriptionsResource } from './resources/subscriptions';
import { UsageResource } from './resources/usage';
import { UsersResource } from './resources/users';
import { WebhooksResource } from './resources/webhooks';
import { Environment, NexoraClientOptions } from './types';

export class Nexora {
  public readonly apiKey: string;
  public readonly environment: Environment;
  public readonly baseUrl: string;

  public readonly organizations: OrganizationsResource;
  public readonly users: UsersResource;
  public readonly modules: ModulesResource;
  public readonly plans: PlansResource;
  public readonly subscriptions: SubscriptionsResource;
  public readonly domains: DomainsResource;
  public readonly webhooks: WebhooksResource;
  public readonly deliveries: WebhookDeliveriesResource;
  public readonly usage: UsageResource;

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

    this.http = new HttpClient(this.apiKey, this.baseUrl, options.timeoutMs || 30000);

    this.organizations = new OrganizationsResource(this.http);
    this.users = new UsersResource(this.http);
    this.modules = new ModulesResource(this.http);
    this.plans = new PlansResource(this.http);
    this.subscriptions = new SubscriptionsResource(this.http);
    this.domains = new DomainsResource(this.http);
    this.webhooks = new WebhooksResource(this.http);
    this.deliveries = new WebhookDeliveriesResource(this.http);
    this.usage = new UsageResource(this.http);
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
