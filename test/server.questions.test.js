const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const server = require('../server.js');

let port;
before(async () => { await new Promise((r) => server.listen(0, r)); port = server.address().port; });
after(async () => { await new Promise((r) => server.close(r)); });

test('POST /qa/questions rejects empty text', async () => {
  const res = await fetch(`http://localhost:${port}/qa/questions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: '  ' }),
  });
  assert.equal(res.status, 400);
});

test('POST /qa/questions creates a question with defaults', async () => {
  const res = await fetch(`http://localhost:${port}/qa/questions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'hello?' }),
  });
  assert.equal(res.status, 201);
  const q = await res.json();
  assert.equal(q.text, 'hello?');
  assert.equal(q.name, '익명');
  assert.equal(q.votes, 0);
  assert.equal(typeof q.id, 'number');
});

test('POST /qa/questions truncates long text to 280 chars', async () => {
  const longText = 'a'.repeat(300);
  const res = await fetch(`http://localhost:${port}/qa/questions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: longText, name: 'me' }),
  });
  const q = await res.json();
  assert.equal(q.text.length, 280);
  assert.equal(q.name, 'me');
});
