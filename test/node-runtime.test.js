'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('Node package metadata advertises supported runtime and dual module entry points', () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8')
  );
  assert.equal(packageJson.engines.node, '>=18.0.0');
  assert.equal(packageJson.exports['.'].require, './dist/index.js');
  assert.equal(packageJson.exports['.'].import, './dist/esm/index.js');
});

test('CommonJS and ESM builds both expose Nexora and NexoraError', async () => {
  const cjs = require('../dist/index.js');
  assert.equal(typeof cjs.Nexora, 'function');
  assert.equal(typeof cjs.NexoraError, 'function');

  const esm = await import('../dist/esm/index.js');
  assert.equal(typeof esm.Nexora, 'function');
  assert.equal(typeof esm.NexoraError, 'function');
});

test('supported Node runtime globals required by the HTTP transport are available', () => {
  assert.equal(typeof globalThis.fetch, 'function');
  assert.equal(typeof globalThis.AbortController, 'function');
  assert.equal(typeof globalThis.URL, 'function');
});
