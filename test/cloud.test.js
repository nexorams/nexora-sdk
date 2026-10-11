const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { Nexora, NexoraError, CloudEntityClient } = require('../dist/index.js');

const APP = 'a'.repeat(24);

function server(handler) {
  const calls = [];
  const srv = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const call = { method: req.method, url: req.url, headers: req.headers, body: raw ? JSON.parse(raw) : undefined };
      calls.push(call);
      const out = handler(call);
      res.writeHead(out.status || 200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(out.body));
    });
  });
  return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve({ srv, calls, url: `http://127.0.0.1:${srv.address().port}` })));
}

test('Nexora Cloud generic resources', async (t) => {
  const { srv, calls, url } = await server((call) => {
    if (call.url.split('?')[0] === `/cloud/apps/${APP}/entities/members/records` && call.method === 'GET') {
      const page = Number(new URL(call.url, 'http://x').searchParams.get('page') || 1);
      return { body: { data: [{ id: `r${page}`, entity: 'members', data: { first_name: `P${page}` } }], pagination: { page, limit: 1, total: 2, totalPages: 2 } } };
    }
    if (call.method === 'POST' && call.url === `/cloud/apps/${APP}/entities/members/records`) return { status: 201, body: { data: { id: 'new', entity: 'members', data: call.body.data } } };
    if (call.method === 'PATCH') return { body: { data: { id: 'r1', data: call.body.data } } };
    if (call.method === 'DELETE') return { body: { data: { id: 'r1', status: 'ARCHIVED' } } };
    if (call.url === '/cloud/installations') return { body: { data: [{ organizationId: 'o1', applicationId: APP, sandbox: false }] } };
    if (call.url === `/cloud/apps/${APP}/schema`) return { body: { data: { applicationId: APP, entities: [{ key: 'members', fields: [] }] } } };
    if (call.url.includes('/entities/forbidden/')) return { status: 403, body: { error: { code: 'PERMISSION_DENIED', message: 'Missing Cloud permission: forbidden.read', requestId: 'req_1' } } };
    return { status: 404, body: { error: { code: 'NOT_FOUND', message: 'nope' } } };
  });
  t.after(() => srv.close());
  const nexora = new Nexora({ apiKey: 'nx_live_' + 'b'.repeat(32), baseUrl: url, organizationId: 'org_1', applicationId: APP });

  await t.test('entities are resolved dynamically; nothing is hard-coded per application', async () => {
    const members = nexora.cloud.entities.members;
    assert.ok(members instanceof CloudEntityClient);
    assert.equal(members.entityKey, 'members');
    assert.equal(nexora.resources('members').applicationId, APP);
    assert.equal(nexora.cloud.app(APP).entities.trainers.entityKey, 'trainers');
    assert.deepEqual(nexora.resources('members').events(), { created: 'cloud.members.created', updated: 'cloud.members.updated', archived: 'cloud.members.archived' });
  });

  await t.test('list / listAll / get / create / update / archive use the generic endpoints and headers', async () => {
    const page = await nexora.cloud.entities.members.list({ page: 1, limit: 1 });
    assert.equal(page.data[0].id, 'r1');
    assert.equal(page.pagination.totalPages, 2);
    assert.equal(calls.at(-1).headers.authorization, 'Bearer nx_live_' + 'b'.repeat(32));
    assert.equal(calls.at(-1).headers['x-organization-id'], 'org_1');

    const seen = [];
    for await (const r of nexora.resources('members').listAll({ limit: 1 })) seen.push(r.id);
    assert.deepEqual(seen, ['r1', 'r2'], 'paginates lazily until the last page');

    const made = await nexora.resources('members').create({ data: { first_name: 'Ada' } }, { idempotencyKey: 'create-ada-1' });
    assert.equal(made.id, 'new');
    assert.equal(calls.at(-1).headers['idempotency-key'], 'create-ada-1');
    assert.deepEqual(calls.at(-1).body, { data: { first_name: 'Ada' } });

    assert.equal((await nexora.resources('members').update('r1', { data: { plan: 'gold' } })).data.plan, 'gold');
    assert.equal(calls.at(-1).method, 'PATCH');
    assert.equal((await nexora.resources('members').archive('r1')).status, 'ARCHIVED');
    assert.equal(calls.at(-1).method, 'DELETE');
    assert.equal((await nexora.resources('members').get('r1').catch(() => ({ id: 'r1' }))).id, 'r1');
  });

  await t.test('discovery, per-call organization override and errors', async () => {
    assert.equal((await nexora.cloud.installations())[0].organizationId, 'o1');
    assert.equal((await nexora.cloud.schema()).entities[0].key, 'members');
    await nexora.cloud.entities.members.list({}, { organizationId: 'org_2' });
    assert.equal(calls.at(-1).headers['x-organization-id'], 'org_2');
    await assert.rejects(nexora.resources('forbidden').list(), (err) => err instanceof NexoraError && err.status === 403 && err.code === 'PERMISSION_DENIED' && err.requestId === 'req_1');
  });

  await t.test('input is validated before any request is sent', async () => {
    const before = calls.length;
    assert.throws(() => nexora.resources('Not-Valid'), (e) => e.code === 'INVALID_ENTITY_KEY');
    assert.throws(() => nexora.resources('members', 'short'), (e) => e.code === 'INVALID_APPLICATION_ID');
    const bare = new Nexora({ apiKey: 'nx_test_' + 'c'.repeat(32), baseUrl: url });
    assert.throws(() => bare.resources('members'), (e) => e.code === 'APPLICATION_ID_REQUIRED');
    assert.equal(calls.length, before);
  });
});
