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

// 발표 시작 전에 들어온 청중을 허브(/)로 보내면, 허브에는 Q&A 스크립트가 없어서
// 발표가 시작돼도 따라가지 못하고 그대로 멈춘다. 대기 화면을 줘야 스스로 넘어간다.
test('GET /live before the presentation starts serves the waiting room, not the hub', async () => {
  const res = await fetch(`http://localhost:${port}/live`, { redirect: 'manual' });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  const text = await res.text();
  assert.match(text, /발표가 곧 시작됩니다/);
  assert.match(text, /qa\/events/); // 덱이 정해지는 순간 스스로 넘어갈 수 있게 SSE를 연다
});

test('the waiting room and presenter console are not listed as seminar decks', async () => {
  const body = await (await fetch(`http://localhost:${port}/qa/health`)).json();
  assert.ok(!body.decks.includes('live'));
  assert.ok(!body.decks.includes('present'));
});
