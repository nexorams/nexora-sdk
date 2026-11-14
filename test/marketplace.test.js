const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const { Nexora, NexoraError, MarketplaceAuth, TokenManager, MemoryTokenStore, constructWebhookEvent, parseRetryAfter, SDK_VERSION } = require('../dist/index.js');

/** A scripted server: each request takes the next scripted reply (a function gets the request and returns { status, headers, body } or 'destroy'). */
function scripted(script) {
  const seen = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const entry = { method: req.method, url: req.url, headers: req.headers, body: raw ? JSON.parse(raw) : undefined };
      seen.push(entry);
      const step = typeof script === 'function' ? script(entry, seen.length - 1) : script[Math.min(seen.length - 1, script.length - 1)];
      const reply = typeof step === 'function' ? step(entry) : step;
      if (reply === 'destroy') { req.socket.destroy(); return; }
      res.writeHead(reply.status, { 'Content-Type': 'application/json', ...(reply.headers || {}) });
      res.end(JSON.stringify(reply.body === undefined ? {} : reply.body));
    });
  });
  server.unref();                         // a failing assertion must not leave the process hanging on an open server
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, seen, url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) })));
}
const err = (status, code, headers) => ({ status, headers, body: { error: { code, message: `${code} message`, requestId: 'req_1' } } });
const ok = (body) => ({ status: 200, body });
const FAST = { baseDelayMs: 2, maxDelayMs: 10 };
const TOKEN = `nxi_${'a'.repeat(64)}`;

test('SDK version for this feature set', () => { assert.equal(SDK_VERSION, '2.4.0'); });

test('automatic retries', async (t) => {
  await t.test('a read is retried after 503/502/504 and succeeds', async () => {
    for (const status of [502, 503, 504]) {
      const s = await scripted([err(status, 'UNAVAILABLE'), err(status, 'UNAVAILABLE'), ok({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } })]);
      const n = new Nexora({ accessToken: TOKEN, baseUrl: s.url, retry: FAST });
      const r = await n.students.list(); assert.deepEqual(r.data, []); assert.equal(s.seen.length, 3, `status ${status}`); await s.close();
    }
  });
  await t.test('gives up after maxRetries and throws the last error', async () => {
    const s = await scripted([err(503, 'UNAVAILABLE')]); const n = new Nexora({ accessToken: TOKEN, baseUrl: s.url, retry: { ...FAST, maxRetries: 1 } });
    await assert.rejects(n.students.list(), (e) => e instanceof NexoraError && e.status === 503); assert.equal(s.seen.length, 2); await s.close();
  });
  await t.test('a write WITHOUT an idempotency key is never retried after 502/503/504 or a dropped connection', async () => {
    for (const first of [err(503, 'UNAVAILABLE'), err(502, 'BAD_GATEWAY'), err(504, 'TIMEOUT'), 'destroy']) {
      const s = await scripted([first, ok({ id: 'x' })]); const n = new Nexora({ accessToken: TOKEN, baseUrl: s.url, retry: FAST });
      await assert.rejects(n.students.create({ firstName: 'Ada', lastName: 'Obi' })); assert.equal(s.seen.length, 1, 'the server may already have created the student'); await s.close();
    }
  });
  await t.test('a write WITH an idempotency key is retried, resending the SAME key and body', async () => {
    const s = await scripted([err(503, 'UNAVAILABLE'), 'destroy', { status: 201, body: { id: 'stu_1', firstName: 'Ada', lastName: 'Obi' } }]); const n = new Nexora({ accessToken: TOKEN, baseUrl: s.url, retry: FAST });
    const r = await n.students.create({ firstName: 'Ada', lastName: 'Obi' }, { idempotencyKey: 'create-ada-0001' }); assert.equal(r.id, 'stu_1');
    assert.equal(s.seen.length, 3); assert.ok(s.seen.every((x) => x.headers['idempotency-key'] === 'create-ada-0001')); assert.ok(s.seen.every((x) => JSON.stringify(x.body) === JSON.stringify({ firstName: 'Ada', lastName: 'Obi' }))); await s.close();
  });
  await t.test('a 429 is retried for any method (it was refused before it ran), honouring Retry-After', async () => {
    const s = await scripted([err(429, 'RATE_LIMITED', { 'Retry-After': '0' }), { status: 201, body: { id: 'stu_2' } }]); const n = new Nexora({ accessToken: TOKEN, baseUrl: s.url, retry: FAST });
    const r = await n.students.create({ firstName: 'A', lastName: 'B' }); assert.equal(r.id, 'stu_2'); assert.equal(s.seen.length, 2); await s.close();
  });
  await t.test('a Retry-After longer than the SDK is willing to wait is returned, not slept through', async () => {
    const s = await scripted([err(429, 'RATE_LIMITED', { 'Retry-After': '120' })]); const n = new Nexora({ accessToken: TOKEN, baseUrl: s.url, retry: { ...FAST, maxRetryAfterMs: 5000 } });
    const started = Date.now(); await assert.rejects(n.students.list(), (e) => e.status === 429 && e.retryAfter === 120 && e.code === 'RATE_LIMITED'); assert.ok(Date.now() - started < 1500); assert.equal(s.seen.length, 1); await s.close();
  });
  await t.test('client errors are never retried', async () => {
    for (const [status, code] of [[400, 'VALIDATION_ERROR'], [401, 'INSTALLATION_TOKEN_INVALID'], [403, 'PERMISSION_NOT_GRANTED'], [404, 'NOT_FOUND'], [409, 'IDEMPOTENCY_CONFLICT'], [500, 'INTERNAL_ERROR']]) {
      const s = await scripted([err(status, code), ok({ data: [], pagination: {} })]); const n = new Nexora({ accessToken: TOKEN, baseUrl: s.url, retry: FAST });
      await assert.rejects(n.students.list(), (e) => e.status === status && e.code === code && e.requestId === 'req_1'); assert.equal(s.seen.length, 1, String(status)); await s.close();
    }
  });
  await t.test('a dropped connection on a read is retried; per-call maxRetries: 0 turns retries off', async () => {
    const s = await scripted(['destroy', ok({ data: [], pagination: {} })]); const n = new Nexora({ accessToken: TOKEN, baseUrl: s.url, retry: FAST });
    await n.students.list(); assert.equal(s.seen.length, 2); await s.close();
    const s2 = await scripted([err(503, 'UNAVAILABLE'), ok({})]); const n2 = new Nexora({ accessToken: TOKEN, baseUrl: s2.url, retry: FAST });
    await assert.rejects(n2.students.list({}, { maxRetries: 0 })); assert.equal(s2.seen.length, 1); await s2.close();
  });
  await t.test('a timed-out read is retried; a timed-out write without a key is not', async () => {
    // a server whose first answer arrives after the client's timeout
    const slow = http.createServer((req, res) => { slow.hits = (slow.hits || 0) + 1; if (slow.hits === 1) { setTimeout(() => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{}'); }, 400); } else { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ data: [], pagination: {} })); } });
    slow.unref(); await new Promise((r) => slow.listen(0, '127.0.0.1', r)); const url = `http://127.0.0.1:${slow.address().port}`;
    const n = new Nexora({ accessToken: TOKEN, baseUrl: url, timeoutMs: 100, retry: FAST }); await n.students.list(); assert.equal(slow.hits, 2);
    slow.hits = 0; await assert.rejects(n.students.create({ firstName: 'A', lastName: 'B' }), (e) => e.code === 'REQUEST_TIMEOUT'); assert.equal(slow.hits, 1);
    await new Promise((r) => slow.close(r));
  });
  await t.test('Retry-After parsing: seconds, HTTP dates, junk', () => {
    assert.equal(parseRetryAfter('7'), 7); assert.equal(parseRetryAfter(null), undefined); assert.equal(parseRetryAfter('soon'), undefined);
    const inTen = new Date(Date.now() + 10_000).toUTCString(); const v = parseRetryAfter(inTen); assert.ok(v >= 9 && v <= 11);
  });
});

test('credentials for Marketplace apps', async (t) => {
  await t.test('accessToken must be an installation token; only one kind of credential; missing credentials', () => {
    assert.throws(() => new Nexora({ accessToken: 'nx_live_abc' }), (e) => e.code === 'INVALID_API_KEY_FORMAT');
    assert.throws(() => new Nexora({ apiKey: TOKEN, accessToken: TOKEN }), (e) => e.code === 'CONFLICTING_CREDENTIALS');
    assert.throws(() => new Nexora({ accessToken: TOKEN, getAccessToken: () => TOKEN }), (e) => e.code === 'CONFLICTING_CREDENTIALS');
    assert.throws(() => new Nexora({}), (e) => e.code === 'MISSING_API_KEY');
    assert.throws(() => new Nexora({ accessToken: TOKEN, organizationId: 'org_1' }), (e) => e.code === 'ORGANIZATION_ID_NOT_ALLOWED');
    const n = new Nexora({ accessToken: TOKEN }); assert.equal(n.isInstallationToken, true); assert.equal(n.apiKey, TOKEN);
  });
  await t.test('getAccessToken is asked for every request and the live token is not kept on the client', async () => {
    let i = 0; const s = await scripted([ok({ data: [], pagination: {} })]); const n = new Nexora({ getAccessToken: () => `nxi_${String(++i).padStart(64, '0')}`, baseUrl: s.url });
    assert.equal(n.apiKey, ''); assert.equal(n.isInstallationToken, true);
    await n.students.list(); await n.students.list(); assert.equal(s.seen[0].headers.authorization, `Bearer nxi_${'1'.padStart(64, '0')}`); assert.equal(s.seen[1].headers.authorization, `Bearer nxi_${'2'.padStart(64, '0')}`);
    assert.ok(s.seen.every((x) => !x.headers['x-organization-id'])); await s.close();
  });
  await t.test('an expired access token triggers ONE refresh through the provider and a retry, for any method', async () => {
    const calls = []; const s = await scripted((req) => (req.headers.authorization.endsWith('0'.repeat(63) + '1') ? err(401, 'INSTALLATION_TOKEN_EXPIRED') : { status: 201, body: { id: 'stu_9' } }));
    const n = new Nexora({ baseUrl: s.url, getAccessToken: ({ forceRefresh }) => { calls.push(forceRefresh); return forceRefresh ? `nxi_${'0'.repeat(63)}2` : `nxi_${'0'.repeat(63)}1`; } });
    const r = await n.students.create({ firstName: 'A', lastName: 'B' }); assert.equal(r.id, 'stu_9'); assert.deepEqual(calls, [false, true]); assert.equal(s.seen.length, 2); await s.close();
    const always = await scripted([err(401, 'INSTALLATION_TOKEN_EXPIRED')]); const n2 = new Nexora({ baseUrl: always.url, getAccessToken: () => TOKEN });
    await assert.rejects(n2.students.list(), (e) => e.code === 'INSTALLATION_TOKEN_EXPIRED'); assert.equal(always.seen.length, 2, 'a second expiry is reported, not looped on'); await always.close();
  });
  await t.test('a failing token provider is reported clearly, and nothing is sent', async () => {
    const s = await scripted([ok({})]); const n = new Nexora({ baseUrl: s.url, getAccessToken: () => { throw new Error('store offline'); } });
    await assert.rejects(n.students.list(), (e) => e.code === 'TOKEN_PROVIDER_FAILED' && /store offline/.test(e.message)); assert.equal(s.seen.length, 0); await s.close();
    const n2 = new Nexora({ baseUrl: s.url, getAccessToken: () => { throw new NexoraError({ message: 'connect again', code: 'REAUTHORIZATION_REQUIRED', status: 401 }); } });
    await assert.rejects(n2.students.list(), (e) => e.code === 'REAUTHORIZATION_REQUIRED');
  });
});

test('token endpoint helpers', async (t) => {
  const tokenBody = (n) => ({ access_token: `nxi_${String(n).padStart(64, '0')}`, token_type: 'Bearer', expires_in: 900, refresh_token: `nxr_${String(n).padStart(64, '0')}`, refresh_token_expires_in: 2592000, scope: 'school.students.read school.attendance.read', installation_id: 'inst_1' });
  const cfg = (url, extra = {}) => ({ clientId: `nxc_${'a'.repeat(24)}`, clientSecret: `nxs_${'b'.repeat(64)}`, baseUrl: url, ...extra });

  await t.test('exchangeCode and refresh send the documented request and return a typed token set', async () => {
    const s = await scripted([ok(tokenBody(1)), ok(tokenBody(2))]); const auth = new MarketplaceAuth(cfg(s.url));
    const t1 = await auth.exchangeCode({ code: `nxa_${'c'.repeat(43)}`, redirectUri: 'https://app.example.com/cb' });
    assert.equal(t1.accessToken, tokenBody(1).access_token); assert.deepEqual(t1.scope, ['school.students.read', 'school.attendance.read']); assert.equal(t1.installationId, 'inst_1'); assert.ok(Math.abs(t1.expiresAt.getTime() - (Date.now() + 900_000)) < 5000);
    assert.equal(s.seen[0].url, '/marketplace/oauth/token'); assert.equal(s.seen[0].method, 'POST');
    assert.deepEqual(s.seen[0].body, { grant_type: 'authorization_code', code: `nxa_${'c'.repeat(43)}`, redirect_uri: 'https://app.example.com/cb', client_id: `nxc_${'a'.repeat(24)}`, client_secret: `nxs_${'b'.repeat(64)}` });
    const t2 = await auth.refresh(t1.refreshToken); assert.equal(t2.refreshToken, tokenBody(2).refresh_token); assert.deepEqual(s.seen[1].body.grant_type, 'refresh_token'); assert.equal(s.seen[1].body.refresh_token, t1.refreshToken);
    assert.ok(!s.seen[0].url.includes('secret'), 'credentials are never in the URL'); await s.close();
  });
  await t.test('server errors keep their code, status, request id and Retry-After', async () => {
    const s = await scripted([err(400, 'INVALID_GRANT'), err(401, 'INVALID_CLIENT'), err(429, 'RATE_LIMITED', { 'Retry-After': '9' })]); const auth = new MarketplaceAuth(cfg(s.url));
    await assert.rejects(auth.refresh(`nxr_${'d'.repeat(64)}`), (e) => e.code === 'INVALID_GRANT' && e.status === 400 && e.requestId === 'req_1');
    await assert.rejects(auth.refresh(`nxr_${'d'.repeat(64)}`), (e) => e.code === 'INVALID_CLIENT' && e.status === 401);
    await assert.rejects(auth.refresh(`nxr_${'d'.repeat(64)}`), (e) => e.code === 'RATE_LIMITED' && e.retryAfter === 9); await s.close();
  });
  await t.test('required inputs are checked locally; and it refuses to run in a browser page', () => {
    assert.throws(() => new MarketplaceAuth({ clientId: 'x' }), (e) => e.code === 'MISSING_CLIENT_CREDENTIALS');
    const auth = new MarketplaceAuth(cfg('http://127.0.0.1:1')); assert.throws(() => auth.exchangeCode({ code: '' }), (e) => e.code === 'INVALID_REQUEST'); assert.throws(() => auth.refresh(''), (e) => e.code === 'INVALID_REQUEST');
    globalThis.window = {}; globalThis.document = {};
    try {
      assert.throws(() => new MarketplaceAuth(cfg('http://127.0.0.1:1')), (e) => e.code === 'CLIENT_SECRET_IN_BROWSER' && /server/.test(e.message));
      assert.doesNotThrow(() => new MarketplaceAuth(cfg('http://127.0.0.1:1', { allowBrowser: true })));
    } finally { delete globalThis.window; delete globalThis.document; }
  });

  await t.test('TokenManager: connect stores tokens; a fresh token is served without calling Nexora; a near-expiry token is refreshed', async () => {
    const s = await scripted([ok(tokenBody(1)), ok(tokenBody(2))]); const store = new MemoryTokenStore(); const mgr = new TokenManager(new MarketplaceAuth(cfg(s.url)), store, { skewSeconds: 60 });
    await assert.rejects(mgr.getAccessToken(), (e) => e.code === 'NOT_CONNECTED');
    await mgr.connect({ code: `nxa_${'c'.repeat(43)}`, redirectUri: 'https://app.example.com/cb' }); assert.equal((await store.load()).refreshToken, tokenBody(1).refresh_token);
    assert.equal(await mgr.getAccessToken(), tokenBody(1).access_token); assert.equal(s.seen.length, 1, 'no extra request');
    const stored = await store.load(); stored.expiresAt = new Date(Date.now() + 30_000); await store.save(stored); const mgr2 = new TokenManager(new MarketplaceAuth(cfg(s.url)), store, { skewSeconds: 60 });
    assert.equal(await mgr2.getAccessToken(), tokenBody(2).access_token); assert.equal((await store.load()).refreshToken, tokenBody(2).refresh_token, 'the NEXT refresh token is stored'); await s.close();
  });
  await t.test('TokenManager: 20 concurrent callers cause exactly ONE refresh (a refresh token works once)', async () => {
    let refreshes = 0; const s = await scripted((req) => { if (req.body.grant_type === 'refresh_token') { refreshes += 1; return ok(tokenBody(5)); } return ok(tokenBody(1)); });
    const store = new MemoryTokenStore(); const auth = new MarketplaceAuth(cfg(s.url)); const mgr = new TokenManager(auth, store);
    await mgr.connect({ code: `nxa_${'c'.repeat(43)}`, redirectUri: 'https://app.example.com/cb' }); const st = await store.load(); st.expiresAt = new Date(Date.now() - 1000); await store.save(st); mgr['cached'] = st;
    const results = await Promise.all(Array.from({ length: 20 }, () => mgr.getAccessToken())); assert.ok(results.every((x) => x === tokenBody(5).access_token)); assert.equal(refreshes, 1); await s.close();
  });
  await t.test('TokenManager: a rejected refresh token ends the connection cleanly (REAUTHORIZATION_REQUIRED) and clears the store', async () => {
    const s = await scripted([ok(tokenBody(1)), err(400, 'INVALID_GRANT')]); const store = new MemoryTokenStore(); const mgr = new TokenManager(new MarketplaceAuth(cfg(s.url)), store);
    await mgr.connect({ code: `nxa_${'c'.repeat(43)}`, redirectUri: 'https://app.example.com/cb' });
    await assert.rejects(mgr.getAccessToken({ forceRefresh: true }), (e) => e.code === 'REAUTHORIZATION_REQUIRED' && e.status === 401); assert.equal(await store.load(), null);
    await assert.rejects(mgr.getAccessToken(), (e) => e.code === 'NOT_CONNECTED'); await s.close();
  });
  await t.test('TokenManager: if saving fails after a refresh, the new tokens are kept for this process (the old refresh token is already spent)', async () => {
    const s = await scripted([ok(tokenBody(1)), ok(tokenBody(2)), ok(tokenBody(3))]); let failNext = false; const mem = new MemoryTokenStore();
    const store = { load: () => mem.load(), save: (t) => { if (failNext) { failNext = false; throw new Error('disk full'); } return mem.save(t); } };
    const mgr = new TokenManager(new MarketplaceAuth(cfg(s.url)), store); await mgr.connect({ code: `nxa_${'c'.repeat(43)}`, redirectUri: 'https://app.example.com/cb' });
    failNext = true; await assert.rejects(mgr.getAccessToken({ forceRefresh: true }), (e) => e.code === 'TOKEN_STORE_FAILED');
    assert.equal(await mgr.getAccessToken(), tokenBody(2).access_token, 'served from memory, no second refresh'); assert.equal(s.seen.length, 2); await s.close();
  });
  await t.test('end to end: the client renews an expired access token through the manager and keeps going', async () => {
    const issued = []; const api = await scripted((req) => (issued.includes(req.headers.authorization) ? err(401, 'INSTALLATION_TOKEN_EXPIRED') : ok({ data: [{ id: 's1' }], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } })));
    const tok = await scripted([ok(tokenBody(1)), ok(tokenBody(2))]); const mgr = new TokenManager(new MarketplaceAuth(cfg(tok.url)));
    await mgr.connect({ code: `nxa_${'c'.repeat(43)}`, redirectUri: 'https://app.example.com/cb' }); issued.push(`Bearer ${tokenBody(1).access_token}`);   // the server considers token 1 expired
    const nexora = new Nexora({ baseUrl: api.url, getAccessToken: (o) => mgr.getAccessToken(o) });
    const r = await nexora.students.list(); assert.equal(r.data[0].id, 's1'); assert.equal(api.seen.at(-1).headers.authorization, `Bearer ${tokenBody(2).access_token}`); assert.equal(tok.seen.length, 2);
    await api.close(); await tok.close();
  });
});

test('webhook events', async (t) => {
  const secret = 'whsec_test_secret';
  const sign = (body, ts = Math.floor(Date.now() / 1000), key = secret) => `t=${ts},v1=${crypto.createHmac('sha256', key).update(`${ts}.${body}`).digest('hex')}`;
  const event = { id: 'evt_0123456789abcdef01234567', type: 'school.student.enrolled', apiVersion: 'v1', createdAt: '2026-10-16T10:00:00.000Z', data: { installationId: 'inst_1', studentId: '65f0c0ffee0000000000abcd' } };
  const body = JSON.stringify(event);

  await t.test('a genuine delivery is verified and parsed (string or Buffer body, any header case)', () => {
    const headers = { 'X-Nexora-Signature': sign(body), 'X-Nexora-Event-Id': event.id };
    assert.deepEqual(constructWebhookEvent(body, headers, secret), event); assert.deepEqual(constructWebhookEvent(Buffer.from(body), { 'x-nexora-signature': sign(body) }, secret), event);
    assert.deepEqual(constructWebhookEvent(body, { 'nexora-signature': [sign(body)] }, secret), event);
  });
  await t.test('wrong secret, tampered body, missing header, stale timestamp and a mismatched id header are all refused', () => {
    const bad = (fn) => assert.throws(fn, (e) => e instanceof NexoraError && ['INVALID_WEBHOOK_SIGNATURE', 'INVALID_WEBHOOK_BODY'].includes(e.code) && e.status === 400);
    bad(() => constructWebhookEvent(body, { 'x-nexora-signature': sign(body, undefined, 'whsec_other') }, secret));
    bad(() => constructWebhookEvent(body.replace('abcd', 'abce'), { 'x-nexora-signature': sign(body) }, secret));
    bad(() => constructWebhookEvent(body, {}, secret)); bad(() => constructWebhookEvent(body, { 'x-nexora-signature': 'garbage' }, secret));
    bad(() => constructWebhookEvent(body, { 'x-nexora-signature': sign(body, Math.floor(Date.now() / 1000) - 3600) }, secret));
    bad(() => constructWebhookEvent(body, { 'x-nexora-signature': sign(body), 'x-nexora-event-id': 'evt_other' }, secret));
    assert.doesNotThrow(() => constructWebhookEvent(body, { 'x-nexora-signature': sign(body, Math.floor(Date.now() / 1000) - 3600) }, secret, 7200), 'a wider window can be chosen explicitly');
  });
  await t.test('a correctly signed body that is not a Nexora event is refused', () => {
    for (const raw of ['not json', '[]', '{"type":"x"}', '{"id":"a","type":"b","data":5}']) assert.throws(() => constructWebhookEvent(raw, { 'x-nexora-signature': sign(raw) }, secret), (e) => e.code === 'INVALID_WEBHOOK_BODY');
  });
});

test('error aliases, claims and introspection (SDK 2.3)', async (t) => {
  const cfg = (url) => ({ clientId: `nxc_${'a'.repeat(24)}`, clientSecret: `nxs_${'b'.repeat(64)}`, baseUrl: url });
  const aliasErr = (status, code, alias) => ({ status, body: { error: { code, alias, message: 'm', requestId: 'req_9' } } });
  const claims = { iss: 'nexora-marketplace', aud: 'nxc_x', sub: 'u1', userId: 'u1', organizationId: 'o1', installationId: 'i1', appId: 'a1', appVersion: '1.0.0', environment: 'LIVE', scope: ['school.students.read'], iat: 1, exp: 901, jti: 'j1' };

  await t.test('an API error exposes the alias next to the unchanged code, and is() matches either name', async () => {
    const s = await scripted([aliasErr(403, 'PERMISSION_NOT_GRANTED', 'SCOPE_NOT_GRANTED')]); const n = new Nexora({ accessToken: TOKEN, baseUrl: s.url, retry: FAST });
    await assert.rejects(n.students.list(), (e) => e instanceof NexoraError && e.code === 'PERMISSION_NOT_GRANTED' && e.alias === 'SCOPE_NOT_GRANTED' && e.is('SCOPE_NOT_GRANTED') && e.is('PERMISSION_NOT_GRANTED') && !e.is('TOKEN_EXPIRED') && e.toJSON().alias === 'SCOPE_NOT_GRANTED'); await s.close();
  });
  await t.test('an error without an alias has none (nothing is invented)', async () => {
    const s = await scripted([err(403, 'APP_SUSPENDED')]); const n = new Nexora({ accessToken: TOKEN, baseUrl: s.url, retry: FAST });
    await assert.rejects(n.students.list(), (e) => e.alias === undefined && e.is('APP_SUSPENDED') && !e.is('undefined')); await s.close();
  });
  await t.test('a token-endpoint failure carries the alias of a refused code', async () => {
    const s = await scripted([aliasErr(400, 'INVALID_GRANT', 'AUTHORIZATION_CODE_EXPIRED')]); const auth = new MarketplaceAuth(cfg(s.url));
    await assert.rejects(auth.exchangeCode({ code: `nxa_${'c'.repeat(43)}`, redirectUri: 'https://app.example.com/launch' }), (e) => e.code === 'INVALID_GRANT' && e.alias === 'AUTHORIZATION_CODE_EXPIRED' && e.status === 400); await s.close();
  });
  await t.test('the token set carries the claims when the server sends them, and works without them', async () => {
    const body = { access_token: `nxi_${'1'.repeat(64)}`, token_type: 'Bearer', expires_in: 900, refresh_token: `nxr_${'2'.repeat(64)}`, refresh_token_expires_in: 100, scope: 'school.students.read', installation_id: 'i1' };
    const s = await scripted([ok({ ...body, claims }), ok(body)]); const auth = new MarketplaceAuth(cfg(s.url));
    const withClaims = await auth.exchangeCode({ code: `nxa_${'c'.repeat(43)}`, redirectUri: 'https://app.example.com/launch' }); assert.deepEqual(withClaims.claims, claims); assert.equal(withClaims.claims.userId, 'u1');
    const without = await auth.refresh(withClaims.refreshToken); assert.equal(without.claims, undefined); await s.close();
  });
  await t.test('introspect posts the token with the client credentials (never in the URL) and returns active claims or { active: false }', async () => {
    const s = await scripted([ok({ active: true, ...claims }), ok({ active: false }), ok({ unexpected: true })]); const auth = new MarketplaceAuth(cfg(s.url));
    const live = await auth.introspect(TOKEN); assert.equal(live.active, true); assert.equal(live.organizationId, 'o1');
    assert.equal(s.seen[0].url, '/marketplace/oauth/introspect'); assert.equal(s.seen[0].method, 'POST'); assert.deepEqual(s.seen[0].body, { token: TOKEN, client_id: `nxc_${'a'.repeat(24)}`, client_secret: `nxs_${'b'.repeat(64)}` });
    assert.deepEqual(await auth.introspect(TOKEN), { active: false }); assert.deepEqual(await auth.introspect(TOKEN), { active: false }, 'anything that is not an explicit active:true is inactive');
    await assert.rejects(auth.introspect(''), (e) => e.code === 'INVALID_REQUEST'); await s.close();
  });
  await t.test('webhookSecret posts the token with the client credentials and returns the secret (and the previous one during a grace window)', async () => {
    const s = await scripted([ok({ secret: 'whsec_new', version: 3, previousSecret: 'whsec_old', graceEndsAt: '2026-10-18T10:00:00.000Z' }), err(403, 'USER_TOKEN_NOT_ALLOWED')]); const auth = new MarketplaceAuth(cfg(s.url));
    const got = await auth.webhookSecret(TOKEN); assert.equal(got.secret, 'whsec_new'); assert.equal(got.previousSecret, 'whsec_old'); assert.equal(s.seen[0].url, '/marketplace/oauth/webhook-secret'); assert.equal(s.seen[0].method, 'POST');
    assert.deepEqual(s.seen[0].body, { token: TOKEN, client_id: `nxc_${'a'.repeat(24)}`, client_secret: `nxs_${'b'.repeat(64)}` });
    await assert.rejects(auth.webhookSecret(''), (e) => e.code === 'INVALID_REQUEST'); await assert.rejects(auth.webhookSecret(TOKEN), (e) => e.code === 'USER_TOKEN_NOT_ALLOWED' && e.status === 403); await s.close();
  });
  await t.test('revoke posts the token with the client credentials and resolves with nothing', async () => {
    const s = await scripted([ok({}), err(401, 'INVALID_CLIENT')]); const auth = new MarketplaceAuth(cfg(s.url));
    assert.equal(await auth.revoke(`nxr_${'4'.repeat(64)}`), undefined); assert.equal(s.seen[0].url, '/marketplace/oauth/revoke'); assert.equal(s.seen[0].method, 'POST');
    assert.deepEqual(s.seen[0].body, { token: `nxr_${'4'.repeat(64)}`, client_id: `nxc_${'a'.repeat(24)}`, client_secret: `nxs_${'b'.repeat(64)}` });
    await assert.rejects(auth.revoke(''), (e) => e.code === 'INVALID_REQUEST'); await assert.rejects(auth.revoke(`nxr_${'4'.repeat(64)}`), (e) => e.code === 'INVALID_CLIENT' && e.status === 401); await s.close();
  });
  await t.test('introspect surfaces a wrong client as INVALID_CLIENT', async () => {
    const s = await scripted([err(401, 'INVALID_CLIENT')]); const auth = new MarketplaceAuth(cfg(s.url)); await assert.rejects(auth.introspect(TOKEN), (e) => e.code === 'INVALID_CLIENT' && e.status === 401); await s.close();
  });
});

test('webhook signatures during a secret rotation grace window (SDK 2.3)', async (t) => {
  const crypto = require('node:crypto'); const { WebhooksResource } = require('../dist/index.js');
  const body = JSON.stringify({ id: 'evt_1', type: 'school.student.enrolled', apiVersion: 'v1', environment: 'live', createdAt: new Date().toISOString(), data: { installationId: 'i1', studentId: 's1' } });
  const ts = Math.floor(Date.now() / 1000); const sig = (secret) => crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
  const headers = (header) => ({ 'x-nexora-signature': header, 'x-nexora-event-id': 'evt_1' });
  await t.test('a header with two signatures verifies with either secret and with no other', () => {
    const header = `t=${ts},v1=${sig('whsec_old')},v1=${sig('whsec_new')}`;
    assert.equal(WebhooksResource.verifySignature(body, header, 'whsec_old'), true); assert.equal(WebhooksResource.verifySignature(body, header, 'whsec_new'), true); assert.equal(WebhooksResource.verifySignature(body, header, 'whsec_other'), false);
    assert.equal(constructWebhookEvent(body, headers(header), 'whsec_old').id, 'evt_1'); assert.equal(constructWebhookEvent(body, headers(header), 'whsec_new').data.studentId, 's1');
    assert.throws(() => constructWebhookEvent(body, headers(header), 'whsec_other'), (e) => e.code === 'INVALID_WEBHOOK_SIGNATURE');
  });
  await t.test('a single-signature header still works, junk signatures beside a good one are ignored, and a tampered body or stale timestamp is refused', () => {
    assert.equal(WebhooksResource.verifySignature(body, `t=${ts},v1=${sig('whsec_new')}`, 'whsec_new'), true);
    assert.equal(WebhooksResource.verifySignature(body, `t=${ts},v1=zz,v1=${'0'.repeat(64)},v1=${sig('whsec_new')}`, 'whsec_new'), true);
    assert.equal(WebhooksResource.verifySignature(body + ' ', `t=${ts},v1=${sig('whsec_old')},v1=${sig('whsec_new')}`, 'whsec_new'), false);
    assert.equal(WebhooksResource.verifySignature(body, `t=${ts - 4000},v1=${crypto.createHmac('sha256', 'whsec_new').update(`${ts - 4000}.${body}`).digest('hex')},v1=${'0'.repeat(64)}`, 'whsec_new'), false, 'older than the tolerance');
    assert.equal(WebhooksResource.verifySignature(body, `t=${ts},v1=zz,v1=`, 'whsec_new'), false, 'nothing valid to compare');
  });
});
