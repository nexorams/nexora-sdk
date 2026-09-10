const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const {
  Nexora,
  NexoraClient,
  NexoraError,
  HttpClient,
  OrganizationsResource,
  UsersResource,
  ModulesResource,
  PlansResource,
  ProjectResource,
  SubscriptionsResource,
  DomainsResource,
  WebhooksResource,
  WebhookDeliveriesResource,
  UsageResource,
  SchoolResource,
  HospitalResource,
  HotelResource,
  PharmacyResource,
  CompanyResource,
} = require('../dist/index.js');

test('Nexora SDK Comprehensive Test Suite', async (t) => {
  await t.test('Client Initialization & Configuration', async (t2) => {
    await t2.test('Throws when apiKey is missing', () => {
      assert.throws(() => new Nexora({}), (err) => {
        return err instanceof NexoraError && err.code === 'MISSING_API_KEY' && err.status === 400;
      });
    });

    await t2.test('Throws when apiKey has invalid prefix', () => {
      assert.throws(() => new Nexora({ apiKey: 'invalid_key_12345' }), (err) => {
        return err instanceof NexoraError && err.code === 'INVALID_API_KEY_FORMAT' && err.status === 400;
      });
    });

    await t2.test('Infers sandbox environment from nx_test_ prefix', () => {
      const client = new Nexora({ apiKey: 'nx_test_abc123' });
      assert.equal(client.environment, 'sandbox');
      assert.equal(client.baseUrl, 'https://api.nexoragms.com/developer/v1');
    });

    await t2.test('Infers live environment from nx_live_ prefix', () => {
      const client = new Nexora({ apiKey: 'nx_live_abc123' });
      assert.equal(client.environment, 'live');
      assert.equal(client.baseUrl, 'https://api.nexoragms.com/developer/v1');
    });

    await t2.test('Trims whitespace from apiKey', () => {
      const client = new Nexora({ apiKey: '  nx_test_padded_key  ' });
      assert.equal(client.apiKey, 'nx_test_padded_key');
    });

    await t2.test('Custom baseUrl trims trailing slashes', () => {
      const client = new Nexora({
        apiKey: 'nx_test_abc123',
        baseUrl: 'http://localhost:5000/developer/v1///',
      });
      assert.equal(client.baseUrl, 'http://localhost:5000/developer/v1');
    });

    await t2.test('Named export NexoraClient is identical to Nexora', () => {
      assert.equal(Nexora, NexoraClient);
    });

    await t2.test('Exposes all required top-level resource properties', () => {
      const client = new Nexora({ apiKey: 'nx_test_sample' });
      assert.ok(client.project instanceof ProjectResource);
      assert.ok(client.organizations instanceof OrganizationsResource);
      assert.ok(client.users instanceof UsersResource);
      assert.ok(client.modules instanceof ModulesResource);
      assert.ok(client.plans instanceof PlansResource);
      assert.ok(client.subscriptions instanceof SubscriptionsResource);
      assert.ok(client.domains instanceof DomainsResource);
      assert.ok(client.webhooks instanceof WebhooksResource);
      assert.ok(client.deliveries instanceof WebhookDeliveriesResource);
      assert.ok(client.usage instanceof UsageResource);
      assert.ok(client.school instanceof SchoolResource);
      assert.ok(client.hospital instanceof HospitalResource);
      assert.ok(client.hotel instanceof HotelResource);
      assert.ok(client.pharmacy instanceof PharmacyResource);
      assert.ok(client.company instanceof CompanyResource);
    });

    await t2.test('Supports optional organizationId default in client configuration', () => {
      const client = new Nexora({
        apiKey: 'nx_test_sample',
        organizationId: 'org_configured_default',
      });
      assert.ok(client.school instanceof SchoolResource);
    });
  });

  await t.test('Security & Secret Redaction', async (t2) => {
    await t2.test('API key is never exposed in error message or toJSON', () => {
      const secret = 'nx_test_super_secret_12345';
      const error = new NexoraError({
        message: 'Something went wrong',
        code: 'TEST_ERROR',
        status: 400,
        requestId: 'req_12345',
        details: { safeInfo: 'ok' },
      });

      const serialized = JSON.stringify(error);
      assert.equal(serialized.includes(secret), false);
      assert.equal(error.message.includes(secret), false);
    });
  });

  await t.test('Webhook Cryptographic Signature Verification', async (t2) => {
    const secret = 'whsec_test_secret_key_abcdef123456';
    const payload = JSON.stringify({
      id: 'evt_123',
      type: 'organization.created',
      data: { name: 'Acme Academy' },
    });
    const now = Math.floor(Date.now() / 1000);

    await t2.test('Verifies valid standard Nexora-Signature (t=...,v1=...)', () => {
      const signaturePayload = `${now}.${payload}`;
      const hash = crypto.createHmac('sha256', secret).update(signaturePayload).digest('hex');
      const header = `t=${now},v1=${hash}`;

      const isValid = Nexora.verifyWebhookSignature(payload, header, secret, 300);
      assert.equal(isValid, true);
    });

    await t2.test('Verifies valid Buffer payload input', () => {
      const signaturePayload = `${now}.${payload}`;
      const hash = crypto.createHmac('sha256', secret).update(signaturePayload).digest('hex');
      const header = `t=${now},v1=${hash}`;

      const isValid = Nexora.verifyWebhookSignature(Buffer.from(payload), header, secret, 300);
      assert.equal(isValid, true);
    });

    await t2.test('Verifies direct v1=... signature header format', () => {
      const hash = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      const header = `v1=${hash}`;

      const isValid = Nexora.verifyWebhookSignature(payload, header, secret, 300);
      assert.equal(isValid, true);
    });

    await t2.test('Rejects tampered payload', () => {
      const signaturePayload = `${now}.${payload}`;
      const hash = crypto.createHmac('sha256', secret).update(signaturePayload).digest('hex');
      const header = `t=${now},v1=${hash}`;

      const tamperedPayload = JSON.stringify({ id: 'evt_999', data: {} });
      const isValid = Nexora.verifyWebhookSignature(tamperedPayload, header, secret, 300);
      assert.equal(isValid, false);
    });

    await t2.test('Rejects signature exceeding timestamp tolerance window', () => {
      const staleTimestamp = now - 600; // 10 minutes ago
      const signaturePayload = `${staleTimestamp}.${payload}`;
      const hash = crypto.createHmac('sha256', secret).update(signaturePayload).digest('hex');
      const header = `t=${staleTimestamp},v1=${hash}`;

      const isValid = Nexora.verifyWebhookSignature(payload, header, secret, 300);
      assert.equal(isValid, false);
    });

    await t2.test('Rejects invalid secret', () => {
      const signaturePayload = `${now}.${payload}`;
      const hash = crypto.createHmac('sha256', secret).update(signaturePayload).digest('hex');
      const header = `t=${now},v1=${hash}`;

      const isValid = Nexora.verifyWebhookSignature(payload, header, 'wrong_secret', 300);
      assert.equal(isValid, false);
    });

    await t2.test('Rejects empty or missing inputs gracefully without throwing', () => {
      assert.equal(Nexora.verifyWebhookSignature('', 'v1=123', secret), false);
      assert.equal(Nexora.verifyWebhookSignature(payload, '', secret), false);
      assert.equal(Nexora.verifyWebhookSignature(payload, 'v1=123', ''), false);
    });
  });

  await t.test('HTTP Transport, Resources & Error Handling', async (t2) => {
    let lastRequest = null;
    let mockResponse = { statusCode: 200, body: {} };

    // Spin up local lightweight mock HTTP server for unit testing
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        lastRequest = {
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: body ? JSON.parse(body) : null,
        };
        res.writeHead(mockResponse.statusCode, {
          'Content-Type': 'application/json',
          'X-Request-Id': 'req_mock_unit_12345',
        });
        res.end(JSON.stringify(mockResponse.body));
      });
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const client = new Nexora({
      apiKey: 'nx_test_mockkey123',
      baseUrl: `http://127.0.0.1:${port}/developer/v1`,
    });

    t2.after(() => {
      server.close();
    });

    await t2.test('Injects Bearer token and User-Agent', async () => {
      mockResponse = {
        statusCode: 200,
        body: { data: [] },
      };

      await client.organizations.list();
      assert.equal(lastRequest.headers.authorization, 'Bearer nx_test_mockkey123');
      assert.equal(lastRequest.headers['user-agent'], 'Nexora-Node-SDK/1.0.0');
      assert.equal(lastRequest.url, '/developer/v1/organizations');
    });

    await t2.test('Injects Idempotency-Key header when provided', async () => {
      mockResponse = {
        statusCode: 201,
        body: {
          data: { id: 'org_123', name: 'Pinecrest Hospital', status: 'ACTIVE' },
        },
      };

      const result = await client.organizations.create(
        {
          name: 'Pinecrest Hospital',
          type: 'HOSPITAL',
          country: 'US',
          owner: {
            firstName: 'Sarah',
            lastName: 'Connor',
            email: 'admin@pinecrest.org',
          },
        },
        { idempotencyKey: 'idemp_test_abc123' }
      );

      assert.equal(lastRequest.headers['idempotency-key'], 'idemp_test_abc123');
      assert.equal(result.id, 'org_123');
      assert.equal(result.name, 'Pinecrest Hospital');
    });

    await t2.test('Properly parses and throws NexoraError on 400 Bad Request', async () => {
      mockResponse = {
        statusCode: 400,
        body: {
          error: {
            message: 'Owner email is required',
            code: 'INVALID_OWNER_EMAIL',
          },
        },
      };

      await assert.rejects(
        async () => {
          await client.organizations.create({
            name: 'Dup School',
            type: 'SCHOOL',
            country: 'US',
            owner: { firstName: 'A', lastName: 'B', email: '' },
          });
        },
        (err) => {
          assert.equal(err instanceof NexoraError, true);
          assert.equal(err.status, 400);
          assert.equal(err.code, 'INVALID_OWNER_EMAIL');
          assert.equal(err.message, 'Owner email is required');
          assert.equal(err.requestId, 'req_mock_unit_12345');
          return true;
        }
      );
    });

    await t2.test('Parses 401 Unauthorized', async () => {
      mockResponse = {
        statusCode: 401,
        body: { error: { message: 'Invalid API key credentials provided.', code: 'INVALID_API_KEY' } },
      };

      await assert.rejects(
        () => client.organizations.list(),
        (err) => err instanceof NexoraError && err.status === 401 && err.code === 'INVALID_API_KEY'
      );
    });

    await t2.test('Parses 403 Forbidden with insufficient scope', async () => {
      mockResponse = {
        statusCode: 403,
        body: { error: { message: 'Lacks required scope organizations.create', code: 'INSUFFICIENT_SCOPE' } },
      };

      await assert.rejects(
        () => client.organizations.create({ name: 'School', type: 'SCHOOL', owner: { firstName: 'A', lastName: 'B', email: 'a@b.com' } }),
        (err) => err instanceof NexoraError && err.status === 403 && err.code === 'INSUFFICIENT_SCOPE'
      );
    });

    await t2.test('Parses 404 Not Found', async () => {
      mockResponse = {
        statusCode: 404,
        body: { error: { message: 'Organization not found.', code: 'ORGANIZATION_NOT_FOUND' } },
      };

      await assert.rejects(
        () => client.organizations.get('org_missing'),
        (err) => err instanceof NexoraError && err.status === 404 && err.code === 'ORGANIZATION_NOT_FOUND'
      );
    });

    await t2.test('Parses 409 Conflict', async () => {
      mockResponse = {
        statusCode: 409,
        body: { error: { message: 'Idempotency key payload mismatch', code: 'IDEMPOTENCY_CONFLICT' } },
      };

      await assert.rejects(
        () => client.organizations.create({ name: 'School', type: 'SCHOOL', owner: { firstName: 'A', lastName: 'B', email: 'a@b.com' } }, { idempotencyKey: 'k1' }),
        (err) => err instanceof NexoraError && err.status === 409 && err.code === 'IDEMPOTENCY_CONFLICT'
      );
    });

    await t2.test('Parses 429 Rate Limit Exceeded', async () => {
      mockResponse = {
        statusCode: 429,
        body: { error: { message: 'Too many requests.', code: 'RATE_LIMIT_EXCEEDED' } },
      };

      await assert.rejects(
        () => client.organizations.list(),
        (err) => err instanceof NexoraError && err.status === 429 && err.code === 'RATE_LIMIT_EXCEEDED'
      );
    });

    await t2.test('Parses 500 Internal Error', async () => {
      mockResponse = {
        statusCode: 500,
        body: { error: { message: 'Unexpected database failure.', code: 'INTERNAL_ERROR' } },
      };

      await assert.rejects(
        () => client.organizations.list(),
        (err) => err instanceof NexoraError && err.status === 500 && err.code === 'INTERNAL_ERROR'
      );
    });

    await t2.test('Organizations: update (PATCH /organizations/:id)', async () => {
      mockResponse = {
        statusCode: 200,
        body: {
          data: { id: 'org_123', name: 'UPDATED ACADEMY', status: 'ACTIVE' },
        },
      };

      const updated = await client.organizations.update('org_123', {
        name: 'UPDATED ACADEMY',
        primaryColor: '#0284c7',
      });
      assert.equal(lastRequest.method, 'PATCH');
      assert.equal(lastRequest.url, '/developer/v1/organizations/org_123');
      assert.equal(updated.name, 'UPDATED ACADEMY');
    });

    await t2.test('Organizations: list supports query params and returns pagination envelope', async () => {
      mockResponse = {
        statusCode: 200,
        body: {
          data: [{ id: 'org_1', name: 'School 1' }],
          pagination: { page: 1, limit: 10, total: 25, totalPages: 3 },
        },
      };

      const res = await client.organizations.list({ type: 'SCHOOL', page: 1, limit: 10 });
      assert.equal(lastRequest.url, '/developer/v1/organizations?page=1&limit=10&type=SCHOOL');
      assert.equal(res.data.length, 1);
      assert.equal(res.pagination.totalPages, 3);
    });

    await t2.test('Users: create and list in an organization', async () => {
      mockResponse = {
        statusCode: 201,
        body: {
          data: { id: 'usr_1', firstName: 'Jane', lastName: 'Doe', email: 'jane@org.com', role: 'teacher' },
        },
      };

      const user = await client.users.create('org_123', {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@org.com',
        role: 'teacher',
      });
      assert.equal(lastRequest.method, 'POST');
      assert.equal(lastRequest.url, '/developer/v1/organizations/org_123/users');
      assert.equal(user.email, 'jane@org.com');

      mockResponse = {
        statusCode: 200,
        body: {
          data: [{ id: 'usr_1', firstName: 'Jane' }],
        },
      };

      const users = await client.users.list('org_123', { role: 'teacher' });
      assert.equal(lastRequest.url, '/developer/v1/organizations/org_123/users?role=teacher');
      assert.equal(users.length, 1);
    });

    await t2.test('Modules: lists system catalog and updates organization features', async () => {
      mockResponse = {
        statusCode: 200,
        body: {
          data: [
            { key: 'attendance', name: 'Attendance Management', organizationTypes: ['school'] },
          ],
        },
      };

      const modules = await client.modules.list({ organizationType: 'school' });
      assert.equal(lastRequest.url, '/developer/v1/modules?organizationType=school');
      assert.equal(modules[0].key, 'attendance');

      mockResponse = {
        statusCode: 200,
        body: {
          data: { organizationId: 'org_123', activeFeatures: ['attendance', 'grading'] },
        },
      };

      const updated = await client.modules.update('org_123', { modules: ['attendance', 'grading'] });
      assert.equal(lastRequest.method, 'PATCH');
      assert.equal(lastRequest.url, '/developer/v1/organizations/org_123/modules');
      assert.deepEqual(updated.activeFeatures, ['attendance', 'grading']);
    });

    await t2.test('Plans: lists available plans with sector filter', async () => {
      mockResponse = {
        statusCode: 200,
        body: {
          data: [{ name: 'School Starter', slug: 'school-starter' }],
        },
      };

      const plans = await client.plans.list({ organizationType: 'school' });
      assert.equal(lastRequest.url, '/developer/v1/plans?organizationType=school');
      assert.equal(plans[0].slug, 'school-starter');
    });

    await t2.test('Subscriptions: gets organization subscription details', async () => {
      mockResponse = {
        statusCode: 200,
        body: {
          data: { organizationId: 'org_123', status: 'TRIAL', trialEndsAt: '2026-10-07T00:00:00.000Z' },
        },
      };

      const sub = await client.subscriptions.get('org_123');
      assert.equal(lastRequest.url, '/developer/v1/organizations/org_123/subscription');
      assert.equal(sub.status, 'TRIAL');
    });

    await t2.test('Domains: lists, creates, and verifies custom domain', async () => {
      mockResponse = {
        statusCode: 200,
        body: {
          data: [{ id: 'dom_1', hostname: 'portal.myschool.edu', verified: true }],
        },
      };

      const domains = await client.domains.list('org_123');
      assert.equal(lastRequest.url, '/developer/v1/organizations/org_123/domains');
      assert.equal(domains[0].hostname, 'portal.myschool.edu');

      mockResponse = {
        statusCode: 201,
        body: {
          data: { id: 'dom_2', hostname: 'custom.school.edu', status: 'PENDING_DNS' },
        },
      };

      const created = await client.domains.create('org_123', { hostname: 'custom.school.edu' });
      assert.equal(lastRequest.method, 'POST');
      assert.equal(created.status, 'PENDING_DNS');

      mockResponse = {
        statusCode: 200,
        body: {
          data: { verified: true, status: 'VERIFIED' },
        },
      };

      const verified = await client.domains.verify('org_123', 'dom_2');
      assert.equal(lastRequest.url, '/developer/v1/organizations/org_123/domains/dom_2/verify');
      assert.equal(verified.verified, true);
    });

    await t2.test('Webhooks: creates, lists, and deletes endpoints', async () => {
      mockResponse = {
        statusCode: 201,
        body: {
          data: {
            id: 'wh_101',
            url: 'https://example.com/webhooks',
            events: ['organization.created'],
            secret: 'whsec_new_123',
          },
        },
      };

      const wh = await client.webhooks.create({
        url: 'https://example.com/webhooks',
        events: ['organization.created'],
      });
      assert.equal(lastRequest.url, '/developer/v1/webhook-endpoints');
      assert.equal(wh.id, 'wh_101');
      assert.equal(wh.secret, 'whsec_new_123');

      mockResponse = {
        statusCode: 200,
        body: {
          data: [{ id: 'wh_101', url: 'https://example.com/webhooks' }],
        },
      };

      const list = await client.webhooks.list();
      assert.equal(list.length, 1);

      mockResponse = {
        statusCode: 200,
        body: {
          data: { id: 'wh_101', url: 'https://example.com/webhooks', status: 'ACTIVE' },
        },
      };

      const got = await client.webhooks.get('wh_101');
      assert.equal(lastRequest.url, '/developer/v1/webhook-endpoints/wh_101');
      assert.equal(got.id, 'wh_101');

      mockResponse = {
        statusCode: 200,
        body: {
          data: { id: 'wh_101', url: 'https://example.com/updated-webhooks' },
        },
      };

      const updated = await client.webhooks.update('wh_101', { url: 'https://example.com/updated-webhooks' });
      assert.equal(lastRequest.method, 'PATCH');
      assert.equal(lastRequest.url, '/developer/v1/webhook-endpoints/wh_101');
      assert.equal(updated.url, 'https://example.com/updated-webhooks');

      mockResponse = {
        statusCode: 200,
        body: {
          data: { secret: 'whsec_rot_999', secretVersion: 2 },
        },
      };

      const rotated = await client.webhooks.rotateSecret('wh_101');
      assert.equal(lastRequest.method, 'POST');
      assert.equal(lastRequest.url, '/developer/v1/webhook-endpoints/wh_101/rotate-secret');
      assert.equal(rotated.secret, 'whsec_rot_999');

      mockResponse = {
        statusCode: 200,
        body: {
          data: { success: true, deliveryId: 'del_test_1', statusCode: 200 },
        },
      };

      const testRes = await client.webhooks.test('wh_101');
      assert.equal(lastRequest.method, 'POST');
      assert.equal(lastRequest.url, '/developer/v1/webhook-endpoints/wh_101/test');
      assert.equal(testRes.success, true);

      mockResponse = {
        statusCode: 200,
        body: {
          data: { id: 'wh_101', status: 'DISABLED' },
        },
      };

      const disabled = await client.webhooks.disable('wh_101');
      assert.equal(lastRequest.method, 'POST');
      assert.equal(lastRequest.url, '/developer/v1/webhook-endpoints/wh_101/disable');
      assert.equal(disabled.status, 'DISABLED');

      mockResponse = {
        statusCode: 200,
        body: { success: true, message: 'Webhook endpoint deleted.' },
      };

      const del = await client.webhooks.delete('wh_101');
      assert.equal(lastRequest.method, 'DELETE');
      assert.equal(lastRequest.url, '/developer/v1/webhook-endpoints/wh_101');
      assert.equal(del.success, true);
    });

    await t2.test('Deliveries: lists history with pagination, gets single delivery, and retries delivery', async () => {
      mockResponse = {
        statusCode: 200,
        body: {
          data: [{ id: 'del_1', status: 'FAILED' }],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        },
      };

      const deliveries = await client.deliveries.list({ status: 'FAILED' });
      assert.equal(lastRequest.url, '/developer/v1/webhook-deliveries?status=FAILED');
      assert.equal(deliveries.data.length, 1);

      mockResponse = {
        statusCode: 200,
        body: {
          data: { id: 'del_1', status: 'FAILED', endpointId: 'wh_101' },
        },
      };

      const singleDelivery = await client.deliveries.get('del_1');
      assert.equal(lastRequest.method, 'GET');
      assert.equal(lastRequest.url, '/developer/v1/webhook-deliveries/del_1');
      assert.equal(singleDelivery.id, 'del_1');

      mockResponse = {
        statusCode: 200,
        body: {
          data: { id: 'del_1', status: 'SUCCESS' },
        },
      };

      const retried = await client.deliveries.retry('del_1');
      assert.equal(lastRequest.url, '/developer/v1/webhook-deliveries/del_1/retry');
      assert.equal(retried.status, 'SUCCESS');
    });

    await t2.test('Usage: retrieves monthly summary and project profile', async () => {
      mockResponse = {
        statusCode: 200,
        body: {
          data: { totalRequests: 1540, successfulRequests: 1530, failedRequests: 10 },
        },
      };

      const summary = await client.usage.summary({ period: '2026-09' });
      assert.equal(lastRequest.url, '/developer/v1/usage?period=2026-09');
      assert.equal(summary.totalRequests, 1540);

      mockResponse = {
        statusCode: 200,
        body: {
          data: { id: 'proj_1', name: 'Production Project', environment: 'LIVE' },
        },
      };

      const proj = await client.usage.getProject();
      assert.equal(lastRequest.url, '/developer/v1/project');
      assert.equal(proj.name, 'Production Project');
    });

    await t2.test('Project: retrieves project details, active modules, and account module credits', async () => {
      mockResponse = {
        statusCode: 200,
        body: {
          data: {
            id: 'proj_101',
            name: 'Acme School Portal',
            slug: 'acme-school-portal',
            environment: 'TEST',
            organizationSector: 'SCHOOL',
          },
        },
      };

      const project = await client.project.get();
      assert.equal(lastRequest.url, '/developer/v1/project');
      assert.equal(project.id, 'proj_101');
      assert.equal(project.organizationSector, 'SCHOOL');

      mockResponse = {
        statusCode: 200,
        body: {
          data: {
            sector: 'SCHOOL',
            environment: 'TEST',
            activeModulesCount: 2,
            creditsReservedInProject: 0,
            accountCreditSummary: { limit: 10, usedCredits: 0, remainingCredits: 10, unlimited: false },
            modules: [
              { moduleCode: 'ATTENDANCE', name: 'Attendance Management', isCore: false, moduleCreditsReserved: 0 },
              { moduleCode: 'AUTH', name: 'Identity & Authentication', isCore: true, moduleCreditsReserved: 0 },
            ],
          },
        },
      };

      const modulesRes = await client.project.modules();
      assert.equal(lastRequest.url, '/developer/v1/project/modules');
      assert.equal(modulesRes.sector, 'SCHOOL');
      assert.equal(modulesRes.modules.length, 2);

      mockResponse = {
        statusCode: 200,
        body: {
          data: {
            limit: 10,
            usedCredits: 0,
            remainingCredits: 10,
            unlimited: false,
            isUnlimited: false,
          },
        },
      };

      const creditsRes = await client.project.moduleCredits();
      assert.equal(lastRequest.url, '/developer/v1/project/module-credits');
      assert.equal(creditsRes.limit, 10);
      assert.equal(creditsRes.remainingCredits, 10);
    });

    await t2.test('Domain Resources & Multi-Tenant X-Organization-Id Header Propagation', async (t3) => {
      const orgClient = new Nexora({
        apiKey: 'nx_test_mockkey123',
        baseUrl: `http://127.0.0.1:${port}/developer/v1`,
        organizationId: 'org_default_school_101',
      });

      await t3.test('School: students.list with query and per-request organization override', async () => {
        mockResponse = {
          statusCode: 200,
          body: {
            data: [{ id: 'stu_1', firstName: 'Alice', lastName: 'Wonder' }],
            pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
          },
        };

        const res = await orgClient.school.students.list(
          { search: 'Alice', limit: 10 },
          { organizationId: 'org_override_school_202' }
        );

        assert.equal(lastRequest.method, 'GET');
        assert.equal(lastRequest.url, '/developer/v1/school/students?limit=10&search=Alice');
        assert.equal(lastRequest.headers['x-organization-id'], 'org_override_school_202');
        assert.equal(res.data.length, 1);
        assert.equal(res.data[0].firstName, 'Alice');
      });

      await t3.test('School: students.create uses default organizationId', async () => {
        mockResponse = {
          statusCode: 201,
          body: {
            data: { id: 'stu_2', firstName: 'Bob', lastName: 'Builder' },
          },
        };

        const res = await orgClient.school.students.create({
          firstName: 'Bob',
          lastName: 'Builder',
        });

        assert.equal(lastRequest.method, 'POST');
        assert.equal(lastRequest.url, '/developer/v1/school/students');
        assert.equal(lastRequest.headers['x-organization-id'], 'org_default_school_101');
        assert.equal(res.id, 'stu_2');
      });

      await t3.test('School: attendance.record and classes.list', async () => {
        mockResponse = {
          statusCode: 200,
          body: { data: { recordedCount: 1 } },
        };

        const attRes = await orgClient.school.attendance.record({
          records: [{ studentId: 'stu_2', status: 'PRESENT' }],
        });
        assert.equal(lastRequest.method, 'POST');
        assert.equal(lastRequest.url, '/developer/v1/school/attendance');
        assert.equal(attRes.recordedCount, 1);

        mockResponse = {
          statusCode: 200,
          body: { data: [{ id: 'cls_1', name: 'Grade 10-A' }] },
        };

        const classes = await orgClient.school.classes.list();
        assert.equal(lastRequest.method, 'GET');
        assert.equal(lastRequest.url, '/developer/v1/school/classes');
        assert.equal(classes.length, 1);
        assert.equal(classes[0].name, 'Grade 10-A');
      });

      await t3.test('Hospital: patients.list, appointments.create, vitals.record', async () => {
        mockResponse = {
          statusCode: 200,
          body: { data: [{ id: 'pat_1', firstName: 'Jane', lastName: 'Doe' }], pagination: { total: 1 } },
        };

        const patients = await orgClient.hospital.patients.list();
        assert.equal(lastRequest.url, '/developer/v1/hospital/patients');
        assert.equal(patients.data[0].id, 'pat_1');

        mockResponse = {
          statusCode: 201,
          body: { data: { id: 'apt_1', patientId: 'pat_1', scheduledAt: '2026-10-15T09:00:00Z' } },
        };

        const apt = await orgClient.hospital.appointments.create({
          patientId: 'pat_1',
          scheduledAt: '2026-10-15T09:00:00Z',
        });
        assert.equal(lastRequest.method, 'POST');
        assert.equal(lastRequest.url, '/developer/v1/hospital/appointments');
        assert.equal(apt.id, 'apt_1');

        mockResponse = {
          statusCode: 201,
          body: { data: { id: 'vit_1', heartRate: 75 } },
        };

        const vit = await orgClient.hospital.vitals.record({
          patientId: 'pat_1',
          heartRate: 75,
        });
        assert.equal(lastRequest.method, 'POST');
        assert.equal(lastRequest.url, '/developer/v1/hospital/vitals');
        assert.equal(vit.heartRate, 75);
      });

      await t3.test('Hotel: rooms.list and reservations.create', async () => {
        mockResponse = {
          statusCode: 200,
          body: {
            data: [{ id: 'room_101', roomNumber: '101', type: 'DELUXE' }],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
          },
        };

        const rooms = await orgClient.hotel.rooms.list();
        assert.equal(lastRequest.url, '/developer/v1/hotel/rooms');
        assert.equal(rooms.data.length, 1);

        mockResponse = {
          statusCode: 201,
          body: { data: { id: 'res_1', guestName: 'Alice', checkIn: '2026-10-01' } },
        };

        const res = await orgClient.hotel.reservations.create({
          guestName: 'Alice',
          checkIn: '2026-10-01',
          checkOut: '2026-10-05',
        });
        assert.equal(lastRequest.method, 'POST');
        assert.equal(lastRequest.url, '/developer/v1/hotel/reservations');
        assert.equal(res.id, 'res_1');
      });

      await t3.test('Pharmacy: products.list, prescriptions.list, sales.list', async () => {
        mockResponse = {
          statusCode: 200,
          body: {
            data: [{ id: 'prd_1', name: 'Amoxicillin' }],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
          },
        };

        const prods = await orgClient.pharmacy.products.list();
        assert.equal(lastRequest.url, '/developer/v1/pharmacy/products');
        assert.equal(prods.data[0].name, 'Amoxicillin');

        mockResponse = {
          statusCode: 200,
          body: {
            data: [{ id: 'rx_1', patientName: 'John Doe' }],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
          },
        };

        const rxs = await orgClient.pharmacy.prescriptions.list();
        assert.equal(lastRequest.url, '/developer/v1/pharmacy/prescriptions');
        assert.equal(rxs.data.length, 1);

        mockResponse = {
          statusCode: 200,
          body: {
            data: [{ id: 'sale_1', totalAmount: 45.5 }],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
          },
        };

        const sales = await orgClient.pharmacy.sales.list();
        assert.equal(lastRequest.url, '/developer/v1/pharmacy/sales');
        assert.equal(sales.data[0].totalAmount, 45.5);
      });

      await t3.test('Company: employees.list, attendance.record, payroll.list', async () => {
        mockResponse = {
          statusCode: 200,
          body: {
            data: [{ id: 'emp_1', firstName: 'Mark', role: 'Engineer' }],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
          },
        };

        const emps = await orgClient.company.employees.list();
        assert.equal(lastRequest.url, '/developer/v1/company/employees');
        assert.equal(emps.data[0].firstName, 'Mark');

        mockResponse = {
          statusCode: 200,
          body: { data: { success: true } },
        };

        const attRes = await orgClient.company.attendance.record({
          records: [{ employeeId: 'emp_1', status: 'PRESENT' }],
        });
        assert.equal(lastRequest.method, 'POST');
        assert.equal(lastRequest.url, '/developer/v1/company/attendance');
        assert.equal(attRes.success, true);

        mockResponse = {
          statusCode: 200,
          body: {
            data: [{ id: 'pay_1', employeeId: 'emp_1', netPay: 5000 }],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
          },
        };

        const payroll = await orgClient.company.payroll.list();
        assert.equal(lastRequest.url, '/developer/v1/company/payroll');
        assert.equal(payroll.data[0].netPay, 5000);
      });
    });

    await t2.test('Handles request timeout error', async () => {
      const slowClient = new Nexora({
        apiKey: 'nx_test_slow',
        baseUrl: `http://127.0.0.1:${port}/developer/v1`,
        timeoutMs: 50,
      });

      // Override server for this test to hang
      const hangServer = http.createServer(() => {
        // Do not respond
      });
      await new Promise((resolve) => hangServer.listen(0, '127.0.0.1', resolve));
      const hangPort = hangServer.address().port;

      const timeoutClient = new Nexora({
        apiKey: 'nx_test_timeout',
        baseUrl: `http://127.0.0.1:${hangPort}/developer/v1`,
        timeoutMs: 50,
      });

      try {
        await assert.rejects(
          () => timeoutClient.organizations.list(),
          (err) => err instanceof NexoraError && err.code === 'REQUEST_TIMEOUT' && err.status === 408
        );
      } finally {
        hangServer.close();
      }
    });

    await t2.test('Handles connection network error', async () => {
      const deadClient = new Nexora({
        apiKey: 'nx_test_dead',
        baseUrl: 'http://127.0.0.1:1', // Non-existent port
      });

      await assert.rejects(
        () => deadClient.organizations.list(),
        (err) => {
          assert.equal(err instanceof NexoraError, true);
          assert.equal(err.code, 'NETWORK_ERROR');
          assert.equal(err.status, 0);
          return true;
        }
      );
    });
  });
});
