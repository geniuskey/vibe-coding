const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const server = require('../server.js');

let port;
before(async () => {
  await new Promise((resolve) => server.listen(0, resolve));
  port = server.address().port;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('GET /qa/health returns ok', async () => {
  const res = await fetch(`http://localhost:${port}/qa/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});

test('GET / serves index.html', async () => {
  const res = await fetch(`http://localhost:${port}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  const text = await res.text();
  assert.match(text, /<!DOCTYPE html>/i);
});

test('unknown route returns 404', async () => {
  const res = await fetch(`http://localhost:${port}/nope`);
  assert.equal(res.status, 404);
});
