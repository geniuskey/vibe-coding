const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const server = require('../server.js');

// The presenter "password" (?key=) was removed: it was exposed in the URL during
// the seminar, so it gave no real protection. /qa/slide and /qa/clear are now open;
// presenter vs. audience is purely a client-side UI distinction (?present).

let port;
before(async () => { await new Promise((r) => server.listen(0, r)); port = server.address().port; });
after(async () => { await new Promise((r) => server.close(r)); });

test('POST /qa/slide updates the slide without any key', async () => {
  const res = await fetch(`http://localhost:${port}/qa/slide`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ h: 5 }),
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { deck: null, h: 5 });
});

test('POST /qa/clear clears questions without any key', async () => {
  await fetch(`http://localhost:${port}/qa/questions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'to be cleared' }),
  });
  const res = await fetch(`http://localhost:${port}/qa/clear`, { method: 'POST' });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});
