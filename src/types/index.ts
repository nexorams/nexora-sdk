/**
 * Nexora Developer Platform Types & Interfaces
 * Canonical definitions aligned with OpenAPI 3.1.0 specification and backend services.
 */

export type Environment = 'sandbox' | 'live' | 'TEST' | 'LIVE';

export type OrganizationType =
  | 'SCHOOL'
  | 'HOSPITAL'
  | 'HOTEL'
  | 'PHARMACY'
  | 'ENTERPRISE'
  | 'school'
  | 'hospital'
  | 'hotel'
  | 'pharmacy'
  | 'enterprise';

export interface NexoraClientOptions {
  apiKey: string;
  environment?: 'sandbox' | 'live';
  baseUrl?: string;
  timeoutMs?: number;
  apiVersion?: string;
}

export interface RequestOptions {
  idempotencyKey?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined | null>;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: Pagination;
}

export interface OwnerInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

export interface LocationInfo {
  country?: string;
  state?: string;
  city?: string;
  address?: string;
  timezone?: string;
}

export interface BrandingInfo {
  primaryColor?: string;
  secondaryColor?: string;
  logo?: string;
  banner?: string;
  theme?: 'light' | 'dark';
  description?: string;
}

export interface CreateOrganizationParams {
  name: string;
  type: OrganizationType;
  owner: OwnerInfo;
  country?: string;
  state?: string;
  city?: string;
  address?: string;
  timezone?: string;
  currency?: string;
  location?: LocationInfo;
  modules?: string[];
  branding?: BrandingInfo;
  [key: string]: unknown;
}

export interface UpdateOrganizationParams {
  name?: string;
  phone?: string;
  address?:
    | {
        street?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
        [key: string]: unknown;
      }
    | string;
  primaryColor?: string;
  secondaryColor?: string;
  theme?: 'light' | 'dark' | string;
  currency?: string;
  timezone?: string;
  [key: string]: unknown;
}

export interface OrganizationDomain {
  hostname?: string;
  primary?: string;
  custom?: string | null;
}

export interface Organization {
  id: string;
  name: string;
  slug?: string;
  type: string;
  environment: string;
  status: string;
  domain?: OrganizationDomain;
  portalUrl?: string;
  owner?: OwnerInfo | null;
  totalUsers?: number;
  currency?: string;
  timezone?: string;
  address?: unknown;
  subscription?: SubscriptionInfo | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface ListOrganizationsQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  type?: string;
  environment?: 'TEST' | 'LIVE' | 'sandbox' | 'live';
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
  organizationId?: string;
  invitationExpiresAt?: string;
  createdAt?: string;
  lastLoginAt?: string;
  [key: string]: unknown;
}

export interface CreateUserParams {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  phone?: string;
  [key: string]: unknown;
}

export interface ListUsersQuery {
  role?: string;
  page?: number;
  limit?: number;
}

export interface ModuleItem {
  key: string;
  name: string;
  description?: string;
  category?: string;
  organizationTypes?: string[];
  dependencies?: string[];
  [key: string]: unknown;
}

export interface ListModulesQuery {
  organizationType?: string;
}

export interface UpdateModulesParams {
  modules: string[];
}

export interface PlanItem {
  id?: string;
  name: string;
  slug?: string;
  code?: string;
  description?: string;
  organizationType?: string;
  organizationTypes?: string[];
  tier?: string;
  monthlyPrice?: number;
  yearlyPrice?: number;
  currency?: string;
  limits?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ListPlansQuery {
  organizationType?: string;
  sector?: string;
}

export interface SubscriptionInfo {
  organizationId?: string;
  planName?: string;
  planCode?: string;
  status: string;
  trialStartsAt?: string | null;
  trialEndsAt?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  currency?: string;
  activeFeatures?: string[];
  limits?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface DomainDnsRecord {
  type: string;
  name: string;
  value: string;
}

export interface DomainInfo {
  id?: string;
  domain?: string;
  hostname?: string;
  subdomain?: string;
  verified?: boolean;
  status?: string;
  dnsRecords?: DomainDnsRecord[];
  verificationRecords?: DomainDnsRecord[];
  createdAt?: string;
  [key: string]: unknown;
}

export interface CreateDomainParams {
  hostname?: string;
  domain?: string;
  isPrimary?: boolean;
  [key: string]: unknown;
}

export interface DomainVerificationResult {
  verified: boolean;
  status: string;
  domain?: string;
  hostname?: string;
  message?: string;
  [key: string]: unknown;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  environment?: 'TEST' | 'LIVE' | string;
  status: 'active' | 'disabled' | string;
  secret?: string;
  signingSecret?: string;
  secretMasked?: string;
  lastDeliveryAt?: string | null;
  lastDeliveryStatus?: string | null;
  lastDeliveryStatusCode?: number | null;
  createdAt?: string;
  [key: string]: unknown;
}

export interface CreateWebhookParams {
  url: string;
  events?: string[];
  description?: string;
}

export interface WebhookDelivery {
  id: string;
  eventId?: string;
  eventType: string;
  endpointId: string;
  endpointUrl: string;
  payload?: unknown;
  attempt?: number;
  httpStatus?: number;
  status: 'SUCCESS' | 'FAILED' | 'PENDING_RETRY' | string;
  deliveredAt?: string;
  nextRetryAt?: string | null;
  errorMessage?: string | null;
  createdAt?: string;
  [key: string]: unknown;
}

export interface ListDeliveriesQuery {
  endpointId?: string;
  status?: 'SUCCESS' | 'FAILED' | 'PENDING_RETRY' | string;
  page?: number;
  limit?: number;
}

export interface ProjectInfo {
  id: string;
  name: string;
  slug?: string;
  environment: 'TEST' | 'LIVE' | string;
  tier?: string;
  limits?: Record<string, unknown>;
  createdAt?: string;
  [key: string]: unknown;
}

export interface UsageSummaryQuery {
  period?: string; // Format YYYY-MM
}

export interface UsageSummary {
  period?: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rateLimitHits?: number;
  byEndpoint?: Record<string, number>;
  [key: string]: unknown;
}
