# Changelog

All notable changes to the `@nexorams/sdk` package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
