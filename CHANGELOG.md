# Changelog

All notable changes to the `@nexorams/sdk` package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-10-06

This is a major release because several changes can break existing integrations. See **Migrating from 1.x** below.

### Breaking
- **Mismatched `environment` now throws.** Passing an `environment` option that disagrees with the API key prefix (for example `environment: 'live'` with an `nx_test_` key) throws a `NexoraError` with code `ENVIRONMENT_MISMATCH`. Unknown values throw `INVALID_ENVIRONMENT`. Previously the option silently overrode the inferred environment. `'test'` is accepted as an alias for `'sandbox'`, and the value is case-insensitive.
- **`webhooks.verifySignature` / `Nexora.verifyWebhookSignature` require timestamped signatures by default.** With the default `toleranceSeconds` (300), only the `t=<unix>,v1=<hex>` format is accepted. Bare HMAC signatures (`v1=<hex>` or raw hex without a timestamp) are rejected unless `toleranceSeconds` is explicitly `0`. Signatures must be 64 hex characters, timestamps must be positive integers, and a negative tolerance always fails verification.
- **`users.list` returns a paginated result.** It now resolves to `{ data: User[], pagination }` instead of `User[]`.
- **`school.classes.list` takes a query argument.** The signature is now `list(query?, options?)` and resolves to `{ data, pagination }` instead of an array. Request options passed as the first argument are now read as the query.
- **`ProjectInfo` type (returned by `usage.getProject`) reshaped.** `slug` is required; `tier` and `limits` were removed; `description`, `status`, `organizationSector` and `updatedAt` were added.
- **`UsageSummary` type (returned by `usage.summary`) reshaped.** `successfulRequests`, `failedRequests`, `rateLimitHits` and `byEndpoint` were replaced by `successCount`, `clientErrorCount`, `serverErrorCount`, `avgLatencyMs`, `quota` and `endpoints`; `period` is now required.

### Added
- Top-level aliases for sector resources: `students`, `attendance`, `patients`, `appointments`, `rooms`, `reservations`, `products`, `employees` and `payroll`. Each points at the same object as its sector resource (for example `nexora.students === nexora.school.students`).
- `SDK_VERSION` export.
- `ListSchoolClassesQuery` type.

### Fixed
- The `User-Agent` header now reports the real package version (`Nexora-Node-SDK/<version>`) instead of a hard-coded `1.0.0`.

### Migrating from 1.x
1. **Environment option.** Remove the `environment` option, or make it match the key: `nx_test_` keys are `'sandbox'` (or `'test'`) and `nx_live_` keys are `'live'`. To catch misconfiguration explicitly:
   ```typescript
   try {
     new Nexora({ apiKey, environment: 'live' });
   } catch (err) {
     if (err instanceof NexoraError && err.code === 'ENVIRONMENT_MISMATCH') { /* wrong key for this deployment */ }
   }
   ```
2. **Webhook verification.** Pass the full `Nexora-Signature` / `X-Nexora-Signature` header (`t=...,v1=...`) to the verifier. If you still receive legacy signatures without a timestamp, verify them with `toleranceSeconds` set to `0`, which disables replay protection, and plan to drop that path:
   ```typescript
   Nexora.verifyWebhookSignature(rawBody, header, secret, 0);
   ```
3. **`users.list`.** Read the array from `.data`:
   ```typescript
   const { data: users, pagination } = await nexora.users.list(orgId, { role: 'doctor' });
   ```
4. **`school.classes.list`.** Read `.data`, and move any request options to the second argument:
   ```typescript
   const { data: classes } = await nexora.school.classes.list({ page: 1, limit: 20 }, { organizationId });
   ```
5. **Usage types.** Update code that reads `tier`/`limits` on the project, or `successfulRequests`/`failedRequests`/`rateLimitHits`/`byEndpoint` on the usage summary, to the new fields listed above.

## [1.0.1] - 2026-09-10

### Added
- `project` resource: `project.get`, `project.modules` and `project.moduleCredits`.
- Sector resources: `school` (students, attendance, classes), `hospital` (patients, appointments, vitals), `hotel`, `pharmacy` and `company` (employees, attendance, payroll).
- `organizationId` client option and per-request option, sent as the `X-Organization-Id` header.
- `deliveries.get` for inspecting a single webhook delivery.
- Webhook endpoint management: `webhooks.get`, `webhooks.update`, `webhooks.rotateSecret`, `webhooks.test` and `webhooks.disable`.
- Type definitions for the new resources.

### Changed
- README now documents installing from npm, the `x-nexora-signature` header and the `event.event` payload field.

## [1.0.0] - 2026-09-07

### Added
- Initial official release of the `@nexorams/sdk` TypeScript/JavaScript library under the official `@nexorams` npm organization scope.
- Zero external runtime dependencies using native Node.js `fetch` and `crypto`.
- Dual module distribution: Native ES Modules (`dist/esm`) and CommonJS (`dist`) with full TypeScript declarations (`dist/index.d.ts`).
- Complete multi-tenant Organization lifecycle: `organizations.create`, `organizations.list`, `organizations.get`, `organizations.update`, `organizations.updateModules`, `organizations.getSubscription`, `organizations.getDomains`, `organizations.addDomain`, `organizations.verifyDomain`.
- User provisioning within organizations (`users.create`, `users.list`).
- Extensible modules catalog (`modules.list`, `modules.update`) and subscription plan discovery (`plans.list`, `subscriptions.get`).
- Dedicated custom domain management (`domains.list`, `domains.create`, `domains.verify`).
- Webhook management (`webhooks.create`, `webhooks.list`, `webhooks.delete`).
- Webhook delivery inspection and manual redelivery triggers (`deliveries.list`, `deliveries.retry`).
- High-security cryptographic webhook signature verification helper (`webhooks.verifySignature`) supporting standard `Nexora-Signature: t=...,v1=...` headers with timestamp tolerance replay defense and timing-safe equality.
- Automated API key prefix detection (`nx_test_` -> sandbox, `nx_live_` -> live) with optional custom `baseUrl`.
- Idempotency key forwarding support (`Idempotency-Key` header and per-request options).
- Correlation tracking with automatic `X-Request-Id` extraction.
- Structured error handling via `NexoraError` with HTTP status, machine error codes, trace IDs, and sensitive field redaction.
- Developer project and usage telemetry endpoints (`usage.summary`, `usage.getProject`).
