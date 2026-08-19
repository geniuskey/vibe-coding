const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const server = require('../server.js');

// 통합 발표 플랫폼: 서버는 한 번에 하나의 세션만 진행한다.
// 덱을 바꿔도 질문·투표·이모지는 하나로 이어지고, 청중은 발표 중인 덱을 따라간다.

let port;
before(async () => { await new Promise((r) => server.listen(0, r)); port = server.address().port; });
// SSE는 오래 열려 있는 연결이라, 실패한 테스트가 스트림을 남기면 close()가 영원히 기다린다.
after(async () => { server.closeAllConnections(); await new Promise((r) => server.close(r)); });

function sseReader(res) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  return {
    async next() {
      for (;;) {
        while (!buffer.includes('\n\n')) {
          const { value, done } = await reader.read();
          if (done) return null;
          buffer += decoder.decode(value, { stream: true });
        }
        const idx = buffer.indexOf('\n\n');
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const eventMatch = chunk.match(/^event: (.+)$/m);
        if (!eventMatch) continue;
        const dataMatch = chunk.match(/^data: (.+)$/m);
        return { event: eventMatch[1], data: dataMatch ? JSON.parse(dataMatch[1]) : null };
      }
    },
    // 다른 구독자가 붙고 끊길 때마다 presence 가 섞여 들어오므로, 기다리는 이벤트만 골라 읽는다.
    async nextOf(name) {
      for (;;) {
        const evt = await this.next();
        if (!evt) return null;
        if (evt.event === name) return evt;
      }
    },
    close() { return reader.cancel().catch(() => {}); },
  };
}

async function sessionState() {
  return (await fetch(`http://localhost:${port}/qa/session`)).json();
}

// 앞선 테스트가 끊은 SSE 연결이 서버에서 정리될 때까지 기다린다.
async function waitForViewers(n) {
  for (let i = 0; i < 100; i++) {
    if ((await sessionState()).viewers === n) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  assert.equal((await sessionState()).viewers, n);
}

function post(path, body) {
  return fetch(`http://localhost:${port}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}),
  });
}

test('GET /workshop/ serves the workshop deck', async () => {
  const res = await fetch(`http://localhost:${port}/workshop/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  const text = await res.text();
  assert.match(text, /<!DOCTYPE html>/i);
  assert.match(text, /워크숍/); // workshop deck, not the root deck
});

test('GET /github/ serves the git & github deck', async () => {
  const res = await fetch(`http://localhost:${port}/github/`);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.match(text, /<!DOCTYPE html>/i);
  assert.match(text, /SEMINAR_CONFIG/); // company-configurable domain block present
});

test('every deck loads the one shared Q&A client instead of its own copy', async () => {
  for (const deck of server.listDecks()) {
    const text = await (await fetch(`http://localhost:${port}/${deck}/`)).text();
    assert.match(text, /<script src="\.\.\/assets\/qa\.js" defer><\/script>/, `${deck} must load assets/qa.js`);
    assert.doesNotMatch(text, /QA_ROOM/, `${deck} must not carry a per-deck room`);
    assert.doesNotMatch(text, /new EventSource/, `${deck} must not inline its own Q&A client`);
  }
});

test('GET /present/ serves the unified presenter console but is not itself a deck', async () => {
  const res = await fetch(`http://localhost:${port}/present/`);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.match(text, /발표자 콘솔/);
  assert.ok(!server.listDecks().includes('present'));
});

test('GET /qa/health advertises the deck list for the console', async () => {
  const body = await (await fetch(`http://localhost:${port}/qa/health`)).json();
  assert.equal(body.ok, true);
  assert.ok(Array.isArray(body.decks));
  assert.ok(body.decks.includes('workshop'));
  assert.ok(!body.decks.includes('present'));
});

test('POST /qa/deck switches the live deck and rejects unknown decks', async () => {
  const ok = await post('/qa/deck', { deck: 'context' });
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { deck: 'context', h: 0 });

  const bad = await post('/qa/deck', { deck: '../etc' });
  assert.equal(bad.status, 400);

  const snap = await (await fetch(`http://localhost:${port}/qa/session`)).json();
  assert.equal(snap.deck, 'context'); // the rejected switch left the session alone
});

test('GET /live redirects to the deck currently being presented', async () => {
  await post('/qa/deck', { deck: 'security' });
  const res = await fetch(`http://localhost:${port}/live`, { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/security/');
});

test('questions and reactions survive a deck switch — one session, not one per deck', async () => {
  await post('/qa/deck', { deck: 'intro' });
  await post('/qa/questions', { text: 'intro 에서 올린 질문' });
  await post('/qa/react', { kind: 'up' });

  await post('/qa/deck', { deck: 'workshop' });
  await post('/qa/questions', { text: 'workshop 에서 올린 질문' });

  const snap = await (await fetch(`http://localhost:${port}/qa/session`)).json();
  const texts = snap.questions.map((q) => q.text);
  assert.ok(texts.includes('intro 에서 올린 질문'));
  assert.ok(texts.includes('workshop 에서 올린 질문'));
  assert.ok(snap.reactions.up >= 1);
  assert.equal(snap.deck, 'workshop');
});

test('a slide broadcast carries the deck so audiences on another deck can follow', async () => {
  const res = await fetch(`http://localhost:${port}/qa/events`);
  const stream = sseReader(res);
  await stream.next(); // snapshot

  await post('/qa/slide', { deck: 'knowledge', h: 4 });

  const evt = await stream.nextOf('slide');
  assert.deepEqual(evt.data, { deck: 'knowledge', h: 4 });
  await stream.close();
});

test('viewers counts only audience connections, not the presenter or the console', async () => {
  await waitForViewers(0);

  const consoleStream = sseReader(await fetch(`http://localhost:${port}/qa/events?role=console`));
  const presenterStream = sseReader(await fetch(`http://localhost:${port}/qa/events?role=presenter`));
  const audienceStream = sseReader(await fetch(`http://localhost:${port}/qa/events?role=audience`));
  try {
    // 각자의 snapshot을 받았다는 건 서버가 그 연결을 이미 등록했다는 뜻이다.
    for (const s of [consoleStream, presenterStream, audienceStream]) {
      assert.equal((await s.nextOf('snapshot')).event, 'snapshot');
    }
    assert.equal((await sessionState()).viewers, 1); // 청중 1명만 집계
  } finally {
    await Promise.all([audienceStream.close(), presenterStream.close(), consoleStream.close()]);
  }
});

test('POST /qa/questions/show re-broadcasts an existing question', async () => {
  const q = await (await post('/qa/questions', { text: '다시 띄울 질문' })).json();

  const res = await fetch(`http://localhost:${port}/qa/events`);
  const stream = sseReader(res);
  await stream.next(); // snapshot

  const shown = await post('/qa/questions/show', { id: q.id });
  assert.equal(shown.status, 200);

  const evt = await stream.nextOf('show');
  assert.equal(evt.data.text, '다시 띄울 질문');
  await stream.close();

  const missing = await post('/qa/questions/show', { id: 999999 });
  assert.equal(missing.status, 404);
});

test('POST /qa/reactions/reset zeroes the tallies', async () => {
  await post('/qa/react', { kind: 'confused' });
  const res = await post('/qa/reactions/reset');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { up: 0, confused: 0 });
});
