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
  organizationId?: string;
}

export interface RequestOptions {
  idempotencyKey?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined | null>;
  organizationId?: string;
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

export interface LimitSummary {
  limit: number | null;
  used?: number;
  remaining: number | null;
  unlimited: boolean;
  overLimit?: boolean;
}

export interface PlanLimits {
  moduleCreditLimit?: number | null;
  moduleCreditUnlimited?: boolean;
  monthlyApiRequests?: number | null;
  monthlyApiRequestsUnlimited?: boolean;
  maxProjects?: number | null;
  maxWorkspaces?: number | null;
  maxLiveOrganizations?: number | null;
  maxSandboxOrganizations?: number | null;
  maxApiKeys?: number | null;
  maxWebhooks?: number | null;
  [key: string]: unknown;
}

export interface ModuleCreditSummary {
  limit: number | null;
  used: number;
  remaining: number | null;
  unlimited: boolean;
  overLimit: boolean;
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
  limits?: PlanLimits;
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
  limits?: PlanLimits;
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
  status: 'ACTIVE' | 'DISABLED' | 'active' | 'disabled' | string;
  secret?: string;
  signingSecret?: string;
  secretMasked?: string;
  secretVersion?: number;
  lastDeliveryAt?: string | null;
  lastDeliveryStatus?: string | null;
  lastDeliveryStatusCode?: number | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface CreateWebhookParams {
  url: string;
  events?: string[];
  description?: string;
}

export interface UpdateWebhookParams {
  url?: string;
  events?: string[];
  description?: string;
  status?: 'ACTIVE' | 'DISABLED' | 'active' | 'disabled' | string;
  [key: string]: unknown;
}

export interface RotateSecretResult {
  secret: string;
  signingSecret?: string;
  secretVersion?: number;
  [key: string]: unknown;
}

export interface WebhookTestResult {
  success: boolean;
  deliveryId?: string;
  statusCode?: number;
  duration?: number;
  message?: string;
  [key: string]: unknown;
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
  statusCode?: number;
  duration?: number;
  status: 'SUCCESS' | 'DELIVERED' | 'FAILED' | 'PENDING' | 'PROCESSING' | 'RETRY_SCHEDULED' | string;
  deliveredAt?: string;
  nextRetryAt?: string | null;
  errorMessage?: string | null;
  error?: string | null;
  createdAt?: string;
  [key: string]: unknown;
}

export interface ListDeliveriesQuery {
  endpointId?: string;
  status?: 'SUCCESS' | 'DELIVERED' | 'FAILED' | 'PENDING' | 'PROCESSING' | 'RETRY_SCHEDULED' | string;
  page?: number;
  limit?: number;
}

export interface ProjectInfo {
  id: string;
  name: string;
  slug?: string;
  environment: 'TEST' | 'LIVE' | string;
  tier?: string;
  limits?: PlanLimits;
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

export interface ProjectModuleItem {
  moduleCode: string;
  name: string;
  category: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' | string;
  isCore: boolean;
  moduleCreditsReserved: number;
  creditCost: number;
  sectors: string[];
  capabilities: string[];
  roleCapabilities?: Record<string, string[]>;
  enabledAt?: string | null;
  [key: string]: unknown;
}

export interface ProjectCreditSummary {
  limit: number | null;
  usedCredits: number;
  remainingCredits: number | null;
  unlimited: boolean;
  isUnlimited: boolean;
  [key: string]: unknown;
}

export interface ProjectModulesResponse {
  sector: string | null;
  environment: 'TEST' | 'LIVE' | string;
  activeModulesCount: number;
  creditsReservedInProject: number;
  accountCreditSummary: ProjectCreditSummary;
  modules: ProjectModuleItem[];
  [key: string]: unknown;
}

export interface ProjectModuleCreditsResponse {
  limit: number | null;
  usedCredits: number;
  remainingCredits: number | null;
  unlimited: boolean;
  isUnlimited: boolean;
  planCode?: string;
  planName?: string;
  [key: string]: unknown;
}

export interface DeveloperProjectDetails {
  id: string;
  name: string;
  slug: string;
  description?: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED' | string;
  environment: 'TEST' | 'LIVE' | string;
  organizationSector?: 'SCHOOL' | 'HOSPITAL' | 'HOTEL' | 'PHARMACY' | 'COMPANY' | string | null;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

// ── Sector Domain Interfaces ──────────────────────────────────────────────────

// School
export interface StudentItem {
  id: string;
  studentId?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  admissionNo?: string;
  class?: { id: string; name: string; section?: string } | null;
  status: string;
  createdAt: string;
  [key: string]: unknown;
}

export interface ListStudentsQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  classId?: string;
}

export interface CreateStudentParams {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  classId?: string;
  admissionNo?: string;
}

export interface AttendanceRecordItem {
  id: string;
  class?: { id: string; name: string; section?: string } | null;
  date: string;
  records: Array<{ student: string; status: string; remark?: string }>;
  createdAt: string;
}

export interface ListAttendanceQuery {
  page?: number;
  limit?: number;
  classId?: string;
  date?: string;
}

export interface RecordAttendanceParams {
  classId: string;
  date?: string;
  records: Array<{ studentId?: string; student?: string; status?: string; remark?: string }>;
}

export interface SchoolClassItem {
  id: string;
  name: string;
  section?: string;
  academicYear?: string;
  capacity?: number;
  studentCount?: number;
  room?: string;
}

export interface CreateSchoolClassParams {
  name: string;
  section?: string;
  capacity?: number;
  academicYear?: string;
  room?: string;
}

// Hospital
export interface PatientItem {
  id: string;
  patientId?: string;
  mrn: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  genotype?: string;
  createdAt: string;
  [key: string]: unknown;
}

export interface ListPatientsQuery {
  page?: number;
  limit?: number;
  search?: string;
  gender?: string;
}

export interface CreatePatientParams {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  genotype?: string;
}

export interface AppointmentItem {
  id: string;
  patient?: { id: string; name: string; mrn: string } | null;
  appointmentDate: string;
  status: string;
  type?: string;
  reason?: string;
  createdAt: string;
}

export interface ListAppointmentsQuery {
  page?: number;
  limit?: number;
  status?: string;
  patientId?: string;
}

export interface CreateAppointmentParams {
  patientId: string;
  appointmentDate: string;
  type?: string;
  reason?: string;
}

export interface VitalSignItem {
  id: string;
  patientId?: string;
  patientName?: string;
  systolic?: number;
  diastolic?: number;
  heartRate?: number;
  temperature?: number;
  respiratoryRate?: number;
  spO2?: number;
  weight?: number;
  height?: number;
  recordedAt: string;
}

export interface ListVitalsQuery {
  page?: number;
  limit?: number;
  patientId?: string;
}

export interface RecordVitalsParams {
  patientId: string;
  systolic?: number;
  diastolic?: number;
  pulse?: number;
  temperature?: number;
  spO2?: number;
  respiratoryRate?: number;
  weight?: number;
  height?: number;
}

// Hotel
export interface HotelRoomItem {
  id: string;
  roomNumber: string;
  operationalStatus: string;
  roomType?: { id: string; name: string; baseRate?: number } | null;
  building?: string;
  wing?: string;
  createdAt: string;
}

export interface ListHotelRoomsQuery {
  page?: number;
  limit?: number;
  status?: string;
}

export interface ReservationItem {
  id: string;
  reservationNumber: string;
  guest?: { id: string; name: string; email?: string } | null;
  room?: { id: string; roomNumber: string } | null;
  arrivalDate: string;
  departureDate: string;
  numberOfNights: number;
  totalAmount?: number;
  status: string;
  createdAt: string;
}

export interface ListReservationsQuery {
  page?: number;
  limit?: number;
  status?: string;
}

export interface CreateReservationParams {
  guestId: string;
  roomTypeId?: string;
  arrivalDate: string;
  departureDate: string;
  numberOfAdults?: number;
  totalAmount?: number;
}

export interface HotelGuestItem {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  status?: string;
  createdAt: string;
}

// Pharmacy
export interface PharmacyProductItem {
  id: string;
  name: string;
  genericName?: string;
  brandName?: string;
  sku?: string;
  sellingPrice?: number;
  costPrice?: number;
  totalStockOnHand?: number;
  requiresPrescription?: boolean;
  status?: string;
  createdAt: string;
}

export interface ListProductsQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export interface CreateProductParams {
  name: string;
  genericName?: string;
  brandName?: string;
  sellingPrice?: number;
  costPrice?: number;
  sku?: string;
  requiresPrescription?: boolean;
}

export interface PrescriptionItem {
  id: string;
  prescriptionNumber: string;
  customerName?: string;
  status: string;
  prescribedDate?: string;
  itemsCount: number;
  createdAt: string;
}

export interface PharmacySaleItem {
  id: string;
  saleNumber: string;
  totalAmount: number;
  paymentStatus: string;
  createdAt: string;
}

// Company
export interface CompanyEmployeeItem {
  id: string;
  employeeId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  department?: string;
  jobTitle?: string;
  status: string;
  createdAt: string;
}

export interface ListEmployeesQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

export interface CreateEmployeeParams {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  department?: string;
}

export interface CompanyAttendanceItem {
  id: string;
  employeeId?: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status: string;
  createdAt: string;
}

export interface RecordCompanyAttendanceParams {
  employeeId: string;
  date?: string;
  checkIn?: string;
  checkOut?: string;
  status?: string;
}

export interface PayrollRunItem {
  id: string;
  runNumber?: string;
  periodStart?: string;
  periodEnd?: string;
  totalGross?: number;
  totalNet?: number;
  status: string;
  createdAt: string;
}
