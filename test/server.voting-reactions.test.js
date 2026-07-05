const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const server = require('../server.js');

let port;
before(async () => { await new Promise((r) => server.listen(0, r)); port = server.address().port; });
after(async () => { await new Promise((r) => server.close(r)); });

async function createQuestion(text) {
  const res = await fetch(`http://localhost:${port}/qa/questions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
  });
  return res.json();
}

test('POST /qa/questions/vote increments votes', async () => {
  const q = await createQuestion('vote me');
  const res = await fetch(`http://localhost:${port}/qa/questions/vote`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: q.id }),
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { id: q.id, votes: 1 });
});

test('POST /qa/questions/vote on unknown id returns 404', async () => {
  const res = await fetch(`http://localhost:${port}/qa/questions/vote`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 999999 }),
  });
  assert.equal(res.status, 404);
});

test('POST /qa/react defaults unknown kind to up', async () => {
  const res = await fetch(`http://localhost:${port}/qa/react`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'nonsense' }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.up, 1);
  assert.equal(body.confused, 0);
});

test('POST /qa/react confused increments confused count', async () => {
  const res = await fetch(`http://localhost:${port}/qa/react`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'confused' }),
  });
  const body = await res.json();
  assert.equal(body.confused, 1);
});
