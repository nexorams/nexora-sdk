# Nexora SDK

Official JavaScript and TypeScript SDK for the [Nexora Developer Platform](https://nexoragms.com/developer).

Seamlessly automate multi-tenant organization provisioning (Schools, Hospitals, Hotels, Pharmacies, and Enterprises), manage tenant users, inspect modular features, connect custom domains, and subscribe to cryptographically signed webhooks.

---

## Installation

Install the official package from npm:

```bash
npm install @nexorams/sdk
```

Or using pnpm or yarn:

```bash
pnpm add @nexorams/sdk
# or
yarn add @nexorams/sdk
```

---

## Security: Server-Side Only

> [!CAUTION]
> **CRITICAL SECURITY WARNING**  
> The Nexora SDK requires secret Developer API credentials (`nx_live_...` or `nx_test_...`) and must **only** be executed in trusted, server-side environments.
>
> Never expose your Nexora secret API key in:
> - Client-side React, Next.js client components, Vue, or Angular applications
> - Browser JavaScript bundles or mobile clients
> - Public frontend code or source repositories
>
> **Recommended Integration Architecture:**
> ```
> End-User Browser / Mobile App
>            ↓ (Your Auth & Business Logic)
> Developer Backend (Node.js / Express / Next.js API Routes)
>            ↓ (Secret Key Authentication)
>     @nexorams/sdk
>            ↓ (HTTPS REST / Developer API)
>     Nexora Developer Platform
> ```

---

## Requirements

- **Node.js**: `>= 18.0.0`
- **Nexora Developer Account**: Sign up at [https://nexoragms.com/developers/signup](https://nexoragms.com/developers/signup)
- **Developer Project**: Created in the Developer Console (TEST or LIVE environment)
- **Developer API Key**: `nx_test_...` for Sandbox or `nx_live_...` for Production

---

## Quick Start

```typescript
import { Nexora } from '@nexorams/sdk';

// Initialize the client (environment is inferred automatically from the key prefix)
const nexora = new Nexora({
  apiKey: process.env.NEXORA_API_KEY!,
});

// Provision a tenant organization using the canonical schema
const organization = await nexora.organizations.create({
  name: 'Bright Future Academy',
  type: 'SCHOOL', // 'SCHOOL' | 'HOSPITAL' | 'HOTEL' | 'PHARMACY' | 'ENTERPRISE'
  country: 'NG', // ISO 3166-1 alpha-2 or country name
  owner: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@brightfuture.edu.ng',
  },
}, {
  idempotencyKey: 'bright-future-001', // Guarantees atomic, duplicate-safe provisioning
});

console.log('Organization created:', organization.id, organization.portalUrl);
console.log('30-Day Trial Status:', organization.subscription?.status);
```

CommonJS is also supported:

```javascript
const { Nexora } = require('@nexorams/sdk');

const nexora = new Nexora({
  apiKey: process.env.NEXORA_API_KEY,
});
```

---

## Authentication

Authentication is handled using Bearer tokens in the HTTP `Authorization` header. The SDK automatically infers your operational environment:

- `nx_test_...` → **Sandbox (`sandbox` / `TEST`)**
- `nx_live_...` → **Production (`live` / `LIVE`)**

```typescript
const nexora = new Nexora({
  apiKey: process.env.NEXORA_API_KEY!,
  // Optional overrides:
  // baseUrl: 'http://localhost:5000/developer/v1', // Local testing override
  // timeoutMs: 30000,                              // Request timeout (default: 30s)
});
```

---

## Sandbox vs Live

- **Sandbox (`nx_test_...`)**: Create test organizations, test webhooks with non-HTTPS/localhost destinations, and run integration tests without consuming production quotas or generating real billing events.
- **Production (`nx_live_...`)**: Provisions live organizations subject to your Developer Tier limits (`maxLiveOrganizations`), enforces HTTPS on all webhook destinations with strict SSRF filtering, and enables live customer portals.

---

## Organizations

The authoritative provisioning engine manages tenant isolation, subdomain creation, trial subscriptions, and owner credentials.

```typescript
// 1. Provision a new organization
const org = await nexora.organizations.create({
  name: 'Pinecrest Specialist Hospital',
  type: 'HOSPITAL',
  country: 'US',
  owner: {
    firstName: 'Sarah',
    lastName: 'Connor',
    email: 'admin@pinecrest.org',
    phone: '+14155552671',
  },
  branding: {
    primaryColor: '#0284c7',
    secondaryColor: '#0f172a',
  },
});

// 2. List organizations with pagination
const page = await nexora.organizations.list({
  type: 'HOSPITAL',
  page: 1,
  limit: 20,
});
console.log(page.data); // Array of organizations
console.log(page.pagination); // { page, limit, total, totalPages }

// 3. Get organization by ID
const details = await nexora.organizations.get(org.id);

// 4. Update organization branding and settings
const updated = await nexora.organizations.update(org.id, {
  name: 'PINECREST MEDICAL CENTER',
  primaryColor: '#0369a1',
});
```

---

## Users

Provision safe tenant users (practitioners, teachers, staff, clients) inside an organization without exposing internal platform roles.

```typescript
// Provision a teacher or doctor
const user = await nexora.users.create(org.id, {
  firstName: 'Eleanor',
  lastName: 'Vance',
  email: 'e.vance@pinecrest.org',
  role: 'doctor', // Note: Platform administration roles are rejected
});

// List users for an organization
const users = await nexora.users.list(org.id, {
  role: 'doctor',
});
```

---

## Modules

Inspect available modular features by sector and manage organization feature entitlements.

```typescript
// List available modules for a school
const modules = await nexora.modules.list({
  organizationType: 'school',
});

// Enable modules on an organization
await nexora.modules.update(org.id, {
  modules: ['school_attendance', 'school_grading', 'school_fees'],
});
```

---

## Plans

Query published subscription tiers and feature limits.

```typescript
const plans = await nexora.plans.list({
  organizationType: 'school',
});
```

---

## Subscriptions

Retrieve active subscription tiers and 30-day trial metadata. The backend `TrialPolicyService` is authoritative—trial eligibility is never calculated client-side.

```typescript
const subscription = await nexora.subscriptions.get(org.id);
console.log('Plan:', subscription.planName);
console.log('Trial ends at:', subscription.trialEndsAt);
```

---

## Domains

Connect and verify custom white-label hostnames for tenant organizations.

```typescript
// 1. Connect custom domain (returns required DNS records)
const domain = await nexora.domains.create(org.id, {
  hostname: 'portal.pinecrest.org',
});
console.log('Add CNAME to DNS:', domain.dnsRecords);

// 2. Trigger automated DNS verification
const verification = await nexora.domains.verify(org.id, domain.id!);
console.log('Verified:', verification.verified);
```

---

## Webhooks & Signature Verification

Nexora dispatches cryptographically signed HMAC-SHA256 webhooks for real-time lifecycle events.

### Register an Endpoint

```typescript
const webhook = await nexora.webhooks.create({
  url: 'https://api.yourdomain.com/webhooks/nexora',
  events: ['organization.provisioned', 'user.created', 'subscription.updated'],
});

// Store signing secret safely (returned ONLY ONCE upon creation):
console.log('Signing Secret:', webhook.secret);
```

### Verify Incoming Signatures

Prevent replay attacks and verify origin using constant-time cryptographic comparison:

```typescript
import express from 'express';
import { Nexora } from '@nexorams/sdk';

const app = express();

// Use express.raw or pass raw body buffer/string
app.post('/webhooks/nexora', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-nexora-signature'] as string;
  const secret = process.env.NEXORA_WEBHOOK_SECRET!;

  const isValid = Nexora.verifyWebhookSignature(
    req.body, // Raw payload Buffer or string
    signature,
    secret,
    300 // Max tolerance in seconds (default: 300 = 5 mins)
  );

  if (!isValid) {
    return res.status(400).send('Invalid webhook signature');
  }

  const event = JSON.parse(req.body.toString());
  console.log('Received verified event:', event.event);
  res.status(200).json({ received: true });
});
```

---

## Error Handling

All API errors throw typed `NexoraError` instances containing HTTP status codes, structured error codes, and correlation request IDs for support troubleshooting.

```typescript
import { Nexora, NexoraError } from '@nexorams/sdk';

try {
  await nexora.organizations.create({ ... });
} catch (error) {
  if (error instanceof NexoraError) {
    console.error('HTTP Status:', error.status);       // e.g. 400, 403, 409
    console.error('Error Code:', error.code);          // e.g. 'INVALID_OWNER_EMAIL'
    console.error('Correlation ID:', error.requestId); // e.g. 'req_66da18...'
    console.error('Details:', error.details);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

---

## Idempotency

All mutation endpoints support idempotency to prevent duplicate operations during network retries:

```typescript
await nexora.organizations.create(payload, {
  idempotencyKey: 'payment_ref_849204_create',
});
```

---

## Documentation & Support

- **Developer Documentation**: [https://nexoragms.com/developers/docs](https://nexoragms.com/developers/docs)
- **Interactive OpenAPI Reference**: [https://api.nexoragms.com/developer/v1/docs](https://api.nexoragms.com/developer/v1/docs)
- **Support**: `developer@nexoragms.com`

---

## License

MIT © [Nexora Technologies](https://nexoragms.com)
