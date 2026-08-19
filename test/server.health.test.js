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
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.ok('lan' in body);       // 콘솔이 청중용 LAN 링크를 만드는 데 쓴다
  assert.ok(Array.isArray(body.decks));
});

test('GET / serves the landing page', async () => {
  const res = await fetch(`http://localhost:${port}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  const text = await res.text();
  assert.match(text, /<!DOCTYPE html>/i);
  assert.match(text, /intro\//);
});

test('GET /intro/ serves the intro deck', async () => {
  const res = await fetch(`http://localhost:${port}/intro/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  const text = await res.text();
  assert.match(text, /바이브 코딩이란 무엇인가/);
});

test('unknown route returns 404', async () => {
  const res = await fetch(`http://localhost:${port}/nope`);
  assert.equal(res.status, 404);
});
