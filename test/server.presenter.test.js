const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const server = require('../server.js');

let port;
before(async () => { await new Promise((r) => server.listen(0, r)); port = server.address().port; });
after(async () => { await new Promise((r) => server.close(r)); });

test('POST /qa/slide without key is forbidden', async () => {
  const res = await fetch(`http://localhost:${port}/qa/slide`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ h: 3 }),
  });
  assert.equal(res.status, 403);
});

test('POST /qa/slide with correct key via header updates slide', async () => {
  const res = await fetch(`http://localhost:${port}/qa/slide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-present-key': 'change-me' },
    body: JSON.stringify({ h: 5 }),
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { h: 5 });
});

test('POST /qa/clear without key is forbidden', async () => {
  const res = await fetch(`http://localhost:${port}/qa/clear?key=wrong`, { method: 'POST' });
  assert.equal(res.status, 403);
});

test('POST /qa/clear with correct key via query clears questions', async () => {
  await fetch(`http://localhost:${port}/qa/questions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'to be cleared' }),
  });
  const res = await fetch(`http://localhost:${port}/qa/clear?key=change-me`, { method: 'POST' });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});
