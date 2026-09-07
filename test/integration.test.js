'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const { Nexora, NexoraError } = require('@nexorams/sdk');

test('Nexora SDK Sandbox End-to-End Developer Journey', async (t) => {
  let server;
  let port;
  let receivedRequests = [];

  // Dedicated sandbox mock HTTP server simulating live backend behavior for integration verification
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const parsedBody = body ? JSON.parse(body) : null;
      receivedRequests.push({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: parsedBody,
      });

      const reqId = `req_sandbox_${crypto.randomBytes(8).toString('hex')}`;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-Request-Id', reqId);

      // Route: POST /developer/v1/organizations
      if (req.method === 'POST' && req.url === '/developer/v1/organizations') {
        if (!parsedBody?.owner?.email) {
          res.writeHead(400);
          return res.end(JSON.stringify({
            error: {
              code: 'INVALID_OWNER_EMAIL',
              message: 'A valid owner email address is required.',
              requestId: reqId,
            },
          }));
        }

        res.writeHead(201);
        return res.end(JSON.stringify({
          data: {
            organizationId: 'org_sb_66da18b4e72391001a4f0099',
            id: 'org_sb_66da18b4e72391001a4f0099',
            name: parsedBody.name.toUpperCase(),
            type: parsedBody.type.toLowerCase(),
            environment: 'TEST',
            primaryDomain: `${parsedBody.name.toLowerCase().replace(/\s+/g, '-')}.nexoragms.com`,
            portalUrl: `https://${parsedBody.name.toLowerCase().replace(/\s+/g, '-')}.nexoragms.com`,
            status: 'ACTIVE',
            ownerUser: {
              firstName: parsedBody.owner.firstName,
              lastName: parsedBody.owner.lastName,
              email: parsedBody.owner.email,
            },
            subscription: {
              plan: 'trial',
              status: 'TRIAL',
              trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            },
          },
        }));
      }

      // Route: GET /developer/v1/organizations/:id
      if (req.method === 'GET' && req.url.startsWith('/developer/v1/organizations/')) {
        const orgId = req.url.split('/')[4];
        res.writeHead(200);
        return res.end(JSON.stringify({
          data: {
            id: orgId,
            name: 'BRIGHT FUTURE ACADEMY',
            type: 'SCHOOL',
            environment: 'TEST',
            status: 'ACTIVE',
            portalUrl: 'https://bright-future-academy.nexoragms.com',
            subscription: {
              status: 'TRIAL',
              trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            },
          },
        }));
      }

      // Route: GET /developer/v1/modules
      if (req.method === 'GET' && req.url.startsWith('/developer/v1/modules')) {
        res.writeHead(200);
        return res.end(JSON.stringify({
          data: [
            { key: 'school_attendance', name: 'Attendance', organizationTypes: ['school'] },
            { key: 'school_grades', name: 'Gradebook', organizationTypes: ['school'] },
            { key: 'school_fees', name: 'Fee Collection', organizationTypes: ['school'] },
          ],
        }));
      }

      // Route: POST /developer/v1/webhook-endpoints
      if (req.method === 'POST' && req.url === '/developer/v1/webhook-endpoints') {
        res.writeHead(201);
        return res.end(JSON.stringify({
          data: {
            id: 'wh_sb_555',
            url: parsedBody.url,
            events: parsedBody.events,
            secret: 'whsec_sandbox_test_secret_789',
            status: 'active',
          },
        }));
      }

      // Fallback 404
      res.writeHead(404);
      res.end(JSON.stringify({
        error: { code: 'NOT_FOUND', message: 'Not Found', requestId: reqId },
      }));
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;

  t.after(() => {
    server.close();
  });

  await t.test('1. Initialize client with TEST key and verify environment resolution', () => {
    const nexora = new Nexora({
      apiKey: 'nx_test_sandbox_credential_001',
      baseUrl: `http://127.0.0.1:${port}/developer/v1`,
    });

    assert.equal(nexora.environment, 'sandbox');
    assert.equal(nexora.apiKey, 'nx_test_sandbox_credential_001');
  });

  await t.test('2. Provision Sandbox School organization with owner & idempotency key', async () => {
    const nexora = new Nexora({
      apiKey: 'nx_test_sandbox_credential_001',
      baseUrl: `http://127.0.0.1:${port}/developer/v1`,
    });

    const org = await nexora.organizations.create(
      {
        name: 'Bright Future Academy',
        type: 'SCHOOL',
        country: 'NG',
        owner: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@brightfuture.edu.ng',
        },
      },
      {
        idempotencyKey: 'idemp_bright_future_001',
      }
    );

    assert.ok(org.id);
    assert.equal(org.name, 'BRIGHT FUTURE ACADEMY');
    assert.equal(org.environment, 'TEST');
    assert.equal(org.status, 'ACTIVE');
    assert.ok(org.subscription?.trialEndsAt);

    // Verify sent HTTP headers
    const last = receivedRequests[receivedRequests.length - 1];
    assert.equal(last.headers.authorization, 'Bearer nx_test_sandbox_credential_001');
    assert.equal(last.headers['idempotency-key'], 'idemp_bright_future_001');
  });

  await t.test('3. Retrieve created organization by ID', async () => {
    const nexora = new Nexora({
      apiKey: 'nx_test_sandbox_credential_001',
      baseUrl: `http://127.0.0.1:${port}/developer/v1`,
    });

    const org = await nexora.organizations.get('org_sb_66da18b4e72391001a4f0099');
    assert.equal(org.id, 'org_sb_66da18b4e72391001a4f0099');
    assert.equal(org.status, 'ACTIVE');
    assert.equal(org.type, 'SCHOOL');
  });

  await t.test('4. Fetch sector module catalog for school', async () => {
    const nexora = new Nexora({
      apiKey: 'nx_test_sandbox_credential_001',
      baseUrl: `http://127.0.0.1:${port}/developer/v1`,
    });

    const modules = await nexora.modules.list({ organizationType: 'school' });
    assert.equal(Array.isArray(modules), true);
    assert.ok(modules.length >= 3);
    assert.equal(modules[0].key, 'school_attendance');
  });

  await t.test('5. Register Test Webhook Endpoint and verify signature validation', async () => {
    const nexora = new Nexora({
      apiKey: 'nx_test_sandbox_credential_001',
      baseUrl: `http://127.0.0.1:${port}/developer/v1`,
    });

    const webhook = await nexora.webhooks.create({
      url: 'http://localhost:4000/webhook-receiver',
      events: ['organization.created', 'user.created'],
    });

    assert.equal(webhook.id, 'wh_sb_555');
    assert.equal(webhook.secret, 'whsec_sandbox_test_secret_789');

    // Simulate backend sending signed event to receiver
    const simulatedEvent = JSON.stringify({
      id: 'evt_sb_123',
      type: 'organization.created',
      data: { organizationId: 'org_sb_66da18b4e72391001a4f0099' },
    });
    const now = Math.floor(Date.now() / 1000);
    const signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(`${now}.${simulatedEvent}`)
      .digest('hex');
    const header = `t=${now},v1=${signature}`;

    const isValid = Nexora.verifyWebhookSignature(simulatedEvent, header, webhook.secret);
    assert.equal(isValid, true);
  });

  await t.test('6. Verify error reporting and correlation request ID on failure', async () => {
    const nexora = new Nexora({
      apiKey: 'nx_test_sandbox_credential_001',
      baseUrl: `http://127.0.0.1:${port}/developer/v1`,
    });

    await assert.rejects(
      () => nexora.organizations.create({
        name: 'Invalid School',
        type: 'SCHOOL',
        country: 'NG',
        owner: { firstName: 'No', lastName: 'Email', email: '' },
      }),
      (err) => {
        assert.ok(err instanceof NexoraError);
        assert.equal(err.status, 400);
        assert.equal(err.code, 'INVALID_OWNER_EMAIL');
        assert.ok(err.requestId && err.requestId.startsWith('req_sandbox_'));
        return true;
      }
    );
  });
});
