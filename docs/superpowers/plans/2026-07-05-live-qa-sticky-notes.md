# 실시간 질문 포스트잇 (Live Q&A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local-only real-time Q&A layer (sticky-note questions, upvotes, 👍/🤔 reactions, slide sync) to the existing single-file `index.html` reveal.js deck, activated only when `npm run dev` is running a small zero-dependency Node server — GitHub Pages (static) keeps working exactly as today.

**Architecture:** One new `server.js` (Node `http` module, in-memory state, SSE broadcast, presenter-key-gated mutations) serves both the static `index.html` and a `/qa/*` REST+SSE API. `index.html` gets one new `<style>`/`<script>` block, inserted right before `</body>`, that does a short backend health-check on load; if no backend answers (GitHub Pages, `file://`), the block does nothing and the deck behaves exactly as it does today.

**Tech Stack:** Node.js built-ins only (`http`, `fs`, `path`, `os`) — no npm dependencies. Backend tests use Node's built-in test runner (`node:test` + `node:assert/strict`) and the global `fetch`/`EventSource`-equivalent streaming APIs already available in Node 22. Frontend is vanilla JS against the existing reveal.js 5.1.0 instance (no new frontend framework).

## Global Constraints

- Zero runtime dependencies — Node built-ins only, both for `server.js` and its tests. Do not add anything to `package.json` under `dependencies` or `devDependencies`.
- No persistent storage. State lives in memory in `server.js` and is lost on restart — this is intentional ("발표 때만 잠깐").
- The GitHub Pages deployment path (`index.html` opened with no backend reachable) must render and behave byte-for-byte like it does before this feature — verified by loading it with the server stopped.
- The deck has 52 flat horizontal slides, no vertical stacks — only `indexh` needs to be synced (confirmed in spec: no nested `<section>`).
- Presenter key default is `change-me`, overridable via `PRESENT_KEY` env var; port default `8080` via `PORT` env var.
- Do not modify any existing slide content, styles, or scripts in `index.html` — only append the new block immediately before `</body>`.

---

## Task 1: Server scaffolding — static file serving + health check

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `server.js`
- Test: `test/server.health.test.js`

**Interfaces:**
- Produces: `server.js` exports a Node `http.Server` instance (`module.exports = server`) that is NOT auto-started when `require`d (guarded by `require.main === module`), so tests can `server.listen(0, cb)` on an ephemeral port. Later tasks add routes to this same file.
- Produces: `npm run dev` / `npm start` → `node server.js`; `npm test` → `node --test test/`.

- [ ] **Step 1: Write the failing test**

Create `test/server.health.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/server.health.test.js`
Expected: FAIL — `Cannot find module '../server.js'`

- [ ] **Step 3: Create `package.json`**

```json
{
  "name": "vibe-coding-202607-live-qa",
  "private": true,
  "version": "1.0.0",
  "scripts": {
    "dev": "node server.js",
    "start": "node server.js",
    "test": "node --test test/"
  }
}
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
```

- [ ] **Step 5: Create `server.js`**

```js
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 8080;
const PRESENT_KEY = process.env.PRESENT_KEY || 'change-me';
const INDEX_PATH = path.join(__dirname, 'index.html');

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function serveIndex(res) {
  fs.readFile(INDEX_PATH, (err, content) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(content);
  });
}

function lanAddress() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return null;
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  if (url === '/' && req.method === 'GET') return serveIndex(res);
  if (url === '/qa/health' && req.method === 'GET') return sendJson(res, 200, { ok: true });

  res.writeHead(404);
  res.end('Not found');
});

if (require.main === module) {
  server.listen(PORT, () => {
    const lan = lanAddress();
    console.log('Live Q&A running:');
    console.log(`  발표자: http://localhost:${PORT}/?present=${PRESENT_KEY}`);
    console.log(`  청중:   http://localhost:${PORT}/`);
    if (lan) console.log(`  (같은 Wi-Fi에서는 http://${lan}:${PORT}/ 로 접속)`);
  });
}

module.exports = server;
```

- [ ] **Step 6: Run test to verify it passes**

Run: `node --test test/server.health.test.js`
Expected: 3 tests pass (`GET /qa/health returns ok`, `GET / serves index.html`, `unknown route returns 404`)

- [ ] **Step 7: Commit**

```bash
git add package.json .gitignore server.js test/server.health.test.js
git commit -m "feat: add local Q&A server scaffolding with health check"
```

---

## Task 2: Question submission API

**Files:**
- Modify: `server.js`
- Test: `test/server.questions.test.js`

**Interfaces:**
- Consumes: `sendJson(res, code, obj)` from Task 1.
- Produces: in-memory `state = { slide, questions, reactions }`; `broadcast(event, data)` (writes SSE-formatted payload to every response in the `clients` Set — the Set stays empty until Task 5 adds the `/qa/events` route, so `broadcast` is a safe no-op until then); `readBody(req)` returning a parsed-JSON-or-`{}` Promise. Later tasks (3, 4, 5) call `broadcast` and `readBody` by these exact names.

- [ ] **Step 1: Write the failing test**

Create `test/server.questions.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/server.questions.test.js`
Expected: FAIL — all three requests get 404 (route doesn't exist yet)

- [ ] **Step 3: Modify `server.js`**

Insert after the `const INDEX_PATH = ...` line:

```js
const state = {
  slide: 0,
  questions: [],
  reactions: { up: 0, confused: 0 },
};
let nextQuestionId = 1;

const clients = new Set();
function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(payload);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { resolve({}); }
    });
  });
}
```

Change the server callback signature to `async` (find `const server = http.createServer((req, res) => {`, replace with `const server = http.createServer(async (req, res) => {`).

Insert the new route right before the final `res.writeHead(404);` fallback:

```js
  if (url === '/qa/questions' && req.method === 'POST') {
    const body = await readBody(req);
    const text = (body.text || '').toString().trim().slice(0, 280);
    if (!text) return sendJson(res, 400, { error: 'empty' });
    const name = (body.name || '').toString().trim().slice(0, 24) || '익명';
    const q = { id: nextQuestionId++, text, name, ts: Date.now(), votes: 0 };
    state.questions.push(q);
    broadcast('question', q);
    return sendJson(res, 201, q);
  }

```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/server.questions.test.js`
Expected: 3 tests pass

- [ ] **Step 5: Run the full suite to check no regression**

Run: `npm test`
Expected: all tests from Task 1 and Task 2 pass (6 total)

- [ ] **Step 6: Commit**

```bash
git add server.js test/server.questions.test.js
git commit -m "feat: add question submission API"
```

---

## Task 3: Voting + reaction API

**Files:**
- Modify: `server.js`
- Test: `test/server.voting-reactions.test.js`

**Interfaces:**
- Consumes: `state`, `broadcast`, `readBody`, `sendJson` from Task 2.
- Produces: no new shared symbols; adds `POST /qa/questions/vote` and `POST /qa/react` routes that Task 5's SSE clients will observe via `vote`/`react` broadcast events.

- [ ] **Step 1: Write the failing test**

Create `test/server.voting-reactions.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/server.voting-reactions.test.js`
Expected: FAIL — 404 on all requests (routes don't exist yet)

- [ ] **Step 3: Modify `server.js`**

Insert the following two routes right before the final `res.writeHead(404);` fallback (after the `/qa/questions` route added in Task 2):

```js
  if (url === '/qa/questions/vote' && req.method === 'POST') {
    const body = await readBody(req);
    const q = state.questions.find((x) => x.id === Number(body.id));
    if (!q) return sendJson(res, 404, { error: 'not found' });
    q.votes++;
    broadcast('vote', { id: q.id, votes: q.votes });
    return sendJson(res, 200, { id: q.id, votes: q.votes });
  }

  if (url === '/qa/react' && req.method === 'POST') {
    const body = await readBody(req);
    const kind = body.kind === 'confused' ? 'confused' : 'up';
    state.reactions[kind]++;
    broadcast('react', { kind, count: state.reactions[kind], total: state.reactions });
    return sendJson(res, 200, state.reactions);
  }

```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/server.voting-reactions.test.js`
Expected: 4 tests pass

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all tests pass (10 total)

- [ ] **Step 6: Commit**

```bash
git add server.js test/server.voting-reactions.test.js
git commit -m "feat: add question voting and reaction API"
```

---

## Task 4: Presenter-gated slide sync + clear API

**Files:**
- Modify: `server.js`
- Test: `test/server.presenter.test.js`

**Interfaces:**
- Consumes: `state`, `broadcast`, `readBody`, `sendJson`, `PRESENT_KEY` from earlier tasks.
- Produces: `isPresenter(req)` helper (checks `?key=` query or `x-present-key` header against `PRESENT_KEY`); `POST /qa/slide` and `POST /qa/clear` routes, both 403 without a valid key.

- [ ] **Step 1: Write the failing test**

Create `test/server.presenter.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/server.presenter.test.js`
Expected: FAIL — 404 on all requests (routes don't exist yet)

- [ ] **Step 3: Modify `server.js`**

Insert after the `readBody` function (from Task 2):

```js
function isPresenter(req) {
  const q = new URL(req.url, 'http://x').searchParams.get('key');
  return q === PRESENT_KEY || req.headers['x-present-key'] === PRESENT_KEY;
}
```

Insert the following two routes right before the final `res.writeHead(404);` fallback:

```js
  if (url === '/qa/slide' && req.method === 'POST') {
    if (!isPresenter(req)) return sendJson(res, 403, { error: 'forbidden' });
    const body = await readBody(req);
    state.slide = Math.max(0, Number(body.h) || 0);
    broadcast('slide', { h: state.slide });
    return sendJson(res, 200, { h: state.slide });
  }

  if (url === '/qa/clear' && req.method === 'POST') {
    if (!isPresenter(req)) return sendJson(res, 403, { error: 'forbidden' });
    state.questions = [];
    broadcast('clear', {});
    return sendJson(res, 200, { ok: true });
  }

```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/server.presenter.test.js`
Expected: 4 tests pass

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all tests pass (14 total)

- [ ] **Step 6: Commit**

```bash
git add server.js test/server.presenter.test.js
git commit -m "feat: add presenter-gated slide sync and clear API"
```

---

## Task 5: SSE broadcast endpoint

**Files:**
- Modify: `server.js`
- Test: `test/server.sse.test.js`

**Interfaces:**
- Consumes: `state`, `clients` (Set, currently unused/empty), `broadcast` from Task 2.
- Produces: `GET /qa/events` — on connect, sends a `snapshot` SSE event with the full `state`, then registers the response into `clients` so subsequent `broadcast()` calls (already wired into every mutating route since Task 2) reach it. This is the last backend task — after this, every route added in Tasks 2–4 is live end-to-end.

- [ ] **Step 1: Write the failing test**

Create `test/server.sse.test.js`:

```js
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const server = require('../server.js');

let port;
before(async () => { await new Promise((r) => server.listen(0, r)); port = server.address().port; });
after(async () => { await new Promise((r) => server.close(r)); });

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
        if (!eventMatch) continue; // skip the leading "retry:" / heartbeat comment frames
        const dataMatch = chunk.match(/^data: (.+)$/m);
        return { event: eventMatch[1], data: dataMatch ? JSON.parse(dataMatch[1]) : null };
      }
    },
    close() { reader.cancel(); },
  };
}

test('GET /qa/events sends a snapshot on connect', async () => {
  const res = await fetch(`http://localhost:${port}/qa/events`);
  const stream = sseReader(res);
  const first = await stream.next();
  assert.equal(first.event, 'snapshot');
  assert.ok('questions' in first.data);
  assert.ok('reactions' in first.data);
  stream.close();
});

test('GET /qa/events broadcasts a question event', async () => {
  const res = await fetch(`http://localhost:${port}/qa/events`);
  const stream = sseReader(res);
  await stream.next(); // snapshot

  await fetch(`http://localhost:${port}/qa/questions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'broadcast me' }),
  });

  const evt = await stream.next();
  assert.equal(evt.event, 'question');
  assert.equal(evt.data.text, 'broadcast me');
  stream.close();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/server.sse.test.js`
Expected: FAIL — `GET /qa/events` returns 404, so `res.body` reading never gets a `snapshot` event (test hangs/fails on the 404 body instead)

- [ ] **Step 3: Modify `server.js`**

Insert the following route right before the final `res.writeHead(404);` fallback:

```js
  if (url === '/qa/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    });
    res.write('retry: 3000\n\n');
    res.write(`event: snapshot\ndata: ${JSON.stringify(state)}\n\n`);
    clients.add(res);
    const hb = setInterval(() => {
      try { res.write(': ping\n\n'); } catch { drop(); }
    }, 15000);
    function drop() { clients.delete(res); clearInterval(hb); }
    req.on('close', drop);
    return;
  }

```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/server.sse.test.js`
Expected: 2 tests pass

- [ ] **Step 5: Run the full suite — this is the last backend task**

Run: `npm test`
Expected: all tests pass (16 total)

- [ ] **Step 6: Commit**

```bash
git add server.js test/server.sse.test.js
git commit -m "feat: add SSE broadcast endpoint for live Q&A"
```

---

## Task 6: Client bootstrap — backend detection + DOM shell

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `GET /qa/health` from Task 1.
- Produces: DOM shell (`#qa-root` and children) and an IIFE with helper functions (`api`, `esc`, `goToSlide`, `getNickname`, `setNickname`) plus **empty stub functions** that later tasks fill in one at a time: `connectSse()`, `setupSlideSync()`, `updateFollowUI()`, `showNote(q)`, `renderHistory()`, `setTally(r)`, `spawnFloat(kind)`, `setupAudienceUI()`, `setupPresenterUI()`. Every later frontend task (7–10) replaces exactly one or two of these stub bodies and touches nothing else in this file.

This task has no automated test (no browser test harness exists in this project and adding one — e.g. Playwright — would introduce a dependency the spec explicitly avoids). Verification is manual, with exact steps below.

- [ ] **Step 1: Modify `index.html`**

Find the literal text at the very end of the file:

```html
</body>
</html>
```

Replace it with (note: this inserts a new block *before* `</body>`, then keeps `</body>\n</html>` unchanged):

```html
<style>
  #qa-root.qa-hidden { display: none; }
  #qa-root { position: fixed; inset: 0; z-index: 9000; pointer-events: none; font-family: 'Pretendard', system-ui, sans-serif; }
  .qa-hidden { display: none !important; }

  #qa-note-layer, #qa-float-layer { position: fixed; inset: 0; pointer-events: none; }

  .qa-note {
    position: absolute;
    max-width: 240px;
    padding: 14px 16px;
    border-radius: 4px;
    color: #14181f;
    font-size: 14px;
    line-height: 1.4;
    box-shadow: 0 10px 30px rgba(0,0,0,0.35);
    transform: rotate(var(--rot, 0deg));
    pointer-events: auto;
    animation: qaNoteIn .35s ease both;
  }
  .qa-note.qa-leaving { animation: qaNoteOut .5s ease both; }
  @keyframes qaNoteIn { from { opacity: 0; transform: rotate(var(--rot,0deg)) translateY(12px) scale(.9); } to { opacity: 1; transform: rotate(var(--rot,0deg)) translateY(0) scale(1); } }
  @keyframes qaNoteOut { to { opacity: 0; transform: rotate(var(--rot,0deg)) translateY(-12px) scale(.92); } }
  .qa-note-name { font-weight: 800; font-size: 11px; opacity: .65; margin-bottom: 4px; }
  .qa-note-text { font-weight: 600; word-break: break-word; }
  .qa-vote { margin-top: 8px; border: 0; background: rgba(0,0,0,0.12); border-radius: 999px; padding: 3px 10px; font-size: 12px; font-weight: 700; cursor: pointer; }

  .qa-dock {
    position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%);
    display: flex; gap: 8px; align-items: center;
    background: rgba(14,18,32,0.85); border: 1px solid rgba(155,130,255,0.35);
    border-radius: 999px; padding: 8px 10px; pointer-events: auto; backdrop-filter: blur(8px);
  }
  .qa-dock input { border: 0; outline: none; background: rgba(255,255,255,0.08); color: #fff; border-radius: 999px; padding: 8px 14px; width: 200px; font-size: 13px; }
  .qa-dock button { border: 0; border-radius: 999px; padding: 8px 12px; font-size: 13px; font-weight: 700; cursor: pointer; background: rgba(255,255,255,0.08); color: #fff; }
  .qa-follow.on { background: var(--accent); color: #06080F; }

  .qa-modal { position: fixed; inset: 0; background: rgba(6,8,15,0.75); display: flex; align-items: center; justify-content: center; pointer-events: auto; }
  .qa-modal-box { background: #0E1220; border: 1px solid rgba(155,130,255,0.4); border-radius: 16px; padding: 28px; width: min(320px, 86vw); text-align: center; }
  .qa-modal-box h3 { color: #fff; margin: 0 0 14px; }
  .qa-modal-box input { width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.06); color: #fff; margin-bottom: 12px; }
  .qa-modal-box button { width: 100%; padding: 10px; border-radius: 10px; border: 0; background: var(--accent); color: #06080F; font-weight: 800; cursor: pointer; }

  #qa-presenter-bar { position: fixed; top: 14px; right: 14px; display: flex; align-items: center; gap: 8px; pointer-events: auto; }
  .qa-dot { width: 8px; height: 8px; border-radius: 50%; background: #555; display: inline-block; }
  .qa-dot.on { background: var(--accent-2); box-shadow: 0 0 8px var(--accent-2); }
  #qa-history-toggle { border: 0; border-radius: 999px; padding: 6px 12px; font-size: 12px; font-weight: 700; background: rgba(255,255,255,0.1); color: #fff; cursor: pointer; }

  .qa-panel { position: fixed; top: 0; right: 0; bottom: 0; width: min(340px, 90vw); background: #0E1220; border-left: 1px solid rgba(155,130,255,0.3); pointer-events: auto; display: flex; flex-direction: column; }
  .qa-panel-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.1); color: #fff; font-weight: 800; }
  .qa-panel-head button { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #fff; border-radius: 8px; padding: 4px 10px; font-size: 12px; cursor: pointer; margin-left: 6px; }
  #qa-history-list { overflow-y: auto; padding: 10px 16px; }
  .qa-history-item { padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.08); }
  .qa-history-meta { display: flex; justify-content: space-between; font-size: 12px; color: #B8BFD0; margin-bottom: 4px; }
  .qa-history-text { color: #fff; font-size: 13px; }
  .qa-history-empty { color: #B8BFD0; font-size: 13px; padding: 20px 0; text-align: center; }

  .qa-float { position: fixed; bottom: 70px; font-size: 28px; animation: qaFloatUp 2.6s ease forwards; }
  @keyframes qaFloatUp { 0% { opacity: 0; transform: translateY(0); } 15% { opacity: 1; } 100% { opacity: 0; transform: translateY(-60vh); } }
</style>

<div id="qa-root" class="qa-hidden">
  <div id="qa-note-layer"></div>
  <div id="qa-float-layer"></div>

  <div id="qa-nick-modal" class="qa-modal qa-hidden">
    <div class="qa-modal-box">
      <h3>닉네임을 정해주세요</h3>
      <input id="qa-nick-input" maxlength="24" placeholder="익명" />
      <button id="qa-nick-go">입장하기 →</button>
    </div>
  </div>

  <div id="qa-audience-dock" class="qa-dock qa-hidden">
    <button id="qa-follow-toggle" class="qa-follow on">🔗 발표자 따라가기 ON</button>
    <input id="qa-question-input" maxlength="280" placeholder="질문을 입력하세요" />
    <button id="qa-question-send">보내기</button>
    <button id="qa-react-up">👍 <span id="qa-tally-up">0</span></button>
    <button id="qa-react-confused">🤔 <span id="qa-tally-confused">0</span></button>
  </div>

  <div id="qa-presenter-bar" class="qa-hidden">
    <span id="qa-conn-dot" class="qa-dot"></span>
    <button id="qa-history-toggle">📋 질문 기록 (<span id="qa-history-count">0</span>)</button>
  </div>

  <div id="qa-history-panel" class="qa-panel qa-hidden">
    <div class="qa-panel-head">
      <span>질문 기록</span>
      <div>
        <button id="qa-history-clear">전체 삭제</button>
        <button id="qa-history-close">닫기</button>
      </div>
    </div>
    <div id="qa-history-list"></div>
  </div>
</div>

<script>
(function () {
  const QA_COLORS = ['#9B82FF', '#2BEAD0', '#FF7A95', '#FFD46B'];
  const params = new URLSearchParams(location.search);
  const PRESENT_KEY = params.get('present');
  const IS_PRESENTER = !!PRESENT_KEY;

  let following = true;
  let liveSlide = 0;
  const shownIds = new Set();
  let history = [];

  fetch('/qa/health', { signal: AbortSignal.timeout(800) })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => { if (d && d.ok) initLiveQa(); })
    .catch(() => {});

  function initLiveQa() {
    document.getElementById('qa-root').classList.remove('qa-hidden');
    if (IS_PRESENTER) {
      document.getElementById('qa-presenter-bar').classList.remove('qa-hidden');
    } else {
      document.getElementById('qa-audience-dock').classList.remove('qa-hidden');
    }
    connectSse();
    setupSlideSync();
    setupAudienceUI();
    setupPresenterUI();
  }

  function api(path, body) {
    const headers = { 'Content-Type': 'application/json' };
    let url = path;
    if (IS_PRESENTER) { headers['x-present-key'] = PRESENT_KEY; url += '?key=' + encodeURIComponent(PRESENT_KEY); }
    return fetch(url, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function goToSlide(h) {
    if (!window.Reveal) return;
    if (Reveal.isReady && Reveal.isReady()) Reveal.slide(h);
    else Reveal.on('ready', () => Reveal.slide(h));
  }

  function getNickname() {
    try { return JSON.parse(localStorage.getItem('qa_nickname') || 'null'); } catch { return null; }
  }
  function setNickname(name) {
    localStorage.setItem('qa_nickname', JSON.stringify(name));
  }

  function connectSse() {}
  function setupSlideSync() {}
  function updateFollowUI() {}
  function showNote(q) {}
  function renderHistory() {}
  function setTally(r) {}
  function spawnFloat(kind) {}
  function setupAudienceUI() {}
  function setupPresenterUI() {}
})();
</script>

</body>
</html>
```

- [ ] **Step 2: Manual verification — GitHub Pages equivalence (no backend)**

Open `index.html` directly as a file (double-click it, or `file://` URL) in a browser.
Expected: deck loads and behaves exactly as before this change — no dock, no bar, no console errors related to `qa-root` (the `/qa/health` fetch fails silently and `initLiveQa` is never called).

- [ ] **Step 3: Manual verification — local server, audience mode**

```bash
npm run dev
```

Open `http://localhost:8080/` in a browser.
Expected: a floating dock appears at the bottom-center with a follow toggle, a text input, a send button, and two reaction buttons (buttons are inert for now — later tasks wire them).

- [ ] **Step 4: Manual verification — local server, presenter mode**

Open `http://localhost:8080/?present=change-me` in another tab.
Expected: a small bar appears top-right with a gray dot and a "📋 질문 기록 (0)" button (also inert for now).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add live Q&A client bootstrap and DOM shell"
```

---

## Task 7: SSE connection + slide sync + follow toggle

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `GET /qa/events` (Task 5), `POST /qa/slide` (Task 4), stub functions `connectSse`, `setupSlideSync`, `updateFollowUI` (Task 6), and the still-empty stubs `showNote`, `renderHistory`, `setTally`, `spawnFloat` (safe to call — they no-op until Tasks 8–10 fill them).
- Produces: filled `connectSse()`, `setupSlideSync()`, `updateFollowUI()`. After this task, the presenter's arrow-key/Space navigation drives the audience's slide position live.

- [ ] **Step 1: Modify `index.html`**

Find this block (from Task 6):

```js
  function connectSse() {}
  function setupSlideSync() {}
  function updateFollowUI() {}
```

Replace with:

```js
  let es;
  function connectSse() {
    es = new EventSource('/qa/events');
    const dot = document.getElementById('qa-conn-dot');
    es.onopen = () => dot && dot.classList.add('on');
    es.onerror = () => dot && dot.classList.remove('on');

    es.addEventListener('snapshot', (e) => {
      const st = JSON.parse(e.data);
      liveSlide = st.slide || 0;
      if (!IS_PRESENTER && following) goToSlide(liveSlide);
      setTally(st.reactions);
      history = (st.questions || []).slice();
      renderHistory();
    });

    es.addEventListener('slide', (e) => {
      const { h } = JSON.parse(e.data);
      liveSlide = h;
      if (IS_PRESENTER) return;
      if (following) goToSlide(h);
      updateFollowUI();
    });

    es.addEventListener('question', (e) => {
      const q = JSON.parse(e.data);
      history.push(q);
      renderHistory();
      showNote(q);
    });

    es.addEventListener('vote', (e) => {
      const { id, votes } = JSON.parse(e.data);
      const el = document.querySelector('.qa-note[data-id="' + id + '"] .qa-vote-count');
      if (el) el.textContent = votes;
      const hq = history.find((q) => q.id === id);
      if (hq) { hq.votes = votes; renderHistory(); }
    });

    es.addEventListener('react', (e) => {
      const d = JSON.parse(e.data);
      setTally(d.total);
      spawnFloat(d.kind);
    });

    es.addEventListener('clear', () => {
      document.getElementById('qa-note-layer').innerHTML = '';
      shownIds.clear();
      history = [];
      renderHistory();
    });
  }

  function setupSlideSync() {
    if (!window.Reveal) return;
    if (IS_PRESENTER) {
      Reveal.on('slidechanged', (e) => { api('/qa/slide', { h: e.indexh }); });
    } else {
      Reveal.on('slidechanged', (e) => {
        if (following && e.indexh !== liveSlide) { following = false; updateFollowUI(); }
      });
      const btn = document.getElementById('qa-follow-toggle');
      btn.onclick = () => {
        following = !following;
        if (following) goToSlide(liveSlide);
        updateFollowUI();
      };
    }
  }

  function updateFollowUI() {
    const btn = document.getElementById('qa-follow-toggle');
    if (!btn) return;
    btn.classList.toggle('on', following);
    btn.textContent = following ? '🔗 발표자 따라가기 ON' : '🔓 자유 탐색 OFF';
  }
```

- [ ] **Step 2: Manual verification — slide sync**

With `npm run dev` running, open presenter tab (`http://localhost:8080/?present=change-me`) and audience tab (`http://localhost:8080/`) side by side.
In the presenter tab, press the right arrow key.
Expected: the audience tab's connection dot is teal (`.qa-dot.on`), and its slide advances to match the presenter's within roughly a second.

- [ ] **Step 3: Manual verification — follow toggle**

In the audience tab, press the right arrow key directly.
Expected: the follow button switches to "🔓 자유 탐색 OFF". Click it again.
Expected: it switches back to "🔗 발표자 따라가기 ON" and the slide snaps back to the presenter's current slide.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: wire live Q&A slide sync over SSE"
```

---

## Task 8: Audience UI — nickname, question submission, sticky notes

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `POST /qa/questions` (Task 2), `POST /qa/questions/vote` (Task 3), `POST /qa/react` (Task 3), `api`, `esc`, `getNickname`, `setNickname`, `QA_COLORS`, `shownIds` (Task 6).
- Produces: filled `showNote(q)` and `setupAudienceUI()`. After this task, an audience member can set a nickname, submit a question, see it (and everyone else's) pop up as a sticky note, and upvote any note.

- [ ] **Step 1: Modify `index.html`**

Find this line (from Task 6):

```js
  function showNote(q) {}
```

Replace with:

```js
  function showNote(q) {
    if (shownIds.has(q.id)) return;
    shownIds.add(q.id);
    const layer = document.getElementById('qa-note-layer');
    const note = document.createElement('div');
    note.className = 'qa-note';
    note.dataset.id = q.id;
    note.style.background = QA_COLORS[q.id % QA_COLORS.length];
    note.style.left = (6 + Math.random() * 60) + 'vw';
    note.style.top = (14 + Math.random() * 50) + 'vh';
    note.style.setProperty('--rot', (Math.random() * 8 - 4).toFixed(1) + 'deg');
    note.innerHTML =
      '<div class="qa-note-name">' + esc(q.name) + '</div>' +
      '<div class="qa-note-text">' + esc(q.text) + '</div>' +
      '<button class="qa-vote">👍 <span class="qa-vote-count">' + (q.votes || 0) + '</span></button>';
    note.querySelector('.qa-vote').onclick = () => api('/qa/questions/vote', { id: q.id });
    layer.appendChild(note);
    setTimeout(() => {
      note.classList.add('qa-leaving');
      setTimeout(() => note.remove(), 500);
    }, 14000);
  }
```

Find this line (from Task 6):

```js
  function setupAudienceUI() {}
```

Replace with:

```js
  function setupAudienceUI() {
    if (IS_PRESENTER) return;

    const nick = getNickname();
    if (!nick) {
      document.getElementById('qa-nick-modal').classList.remove('qa-hidden');
      document.getElementById('qa-nick-go').onclick = () => {
        const v = document.getElementById('qa-nick-input').value.trim().slice(0, 24) || '익명';
        setNickname(v);
        document.getElementById('qa-nick-modal').classList.add('qa-hidden');
      };
    }

    const input = document.getElementById('qa-question-input');
    const send = () => {
      const text = input.value.trim();
      if (!text) return;
      api('/qa/questions', { text, name: getNickname() || '익명' });
      input.value = '';
    };
    document.getElementById('qa-question-send').onclick = send;
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
      send();
    });

    document.getElementById('qa-react-up').onclick = () => api('/qa/react', { kind: 'up' });
    document.getElementById('qa-react-confused').onclick = () => api('/qa/react', { kind: 'confused' });

    updateFollowUI();
  }
```

- [ ] **Step 2: Manual verification — nickname + question + sticky note**

With `npm run dev` running, open an audience tab (`http://localhost:8080/`).
Expected: a nickname modal appears. Type "테스터" and click "입장하기 →" — modal closes.
Type "이거 질문입니다" in the question input and press Enter.
Expected: a colored sticky note appears on screen with "테스터" as the name and "이거 질문입니다" as the text, tilted slightly, and fades out after ~14 seconds.

- [ ] **Step 3: Manual verification — voting**

Click the 👍 button on the sticky note before it disappears.
Expected: the vote count next to 👍 increments from 0 to 1 immediately.

- [ ] **Step 4: Manual verification — reload keeps nickname**

Reload the audience tab.
Expected: no nickname modal appears (nickname was persisted to `localStorage`).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add audience nickname, question submission, and sticky notes"
```

---

## Task 9: Presenter UI — question history panel

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `POST /qa/clear` (Task 4), `esc`, `api`, `history` array (Task 6, populated by `connectSse` from Task 7).
- Produces: filled `renderHistory()` and `setupPresenterUI()`. After this task, the presenter can open a side panel listing every question (sorted by votes, then time) and clear all questions.

- [ ] **Step 1: Modify `index.html`**

Find this line (from Task 6):

```js
  function renderHistory() {}
```

Replace with:

```js
  function renderHistory() {
    const countEl = document.getElementById('qa-history-count');
    if (countEl) countEl.textContent = history.length;
    const list = document.getElementById('qa-history-list');
    if (!list) return;
    const sorted = history.slice().sort((a, b) => b.votes - a.votes || a.ts - b.ts);
    list.innerHTML = sorted.map((q) =>
      '<div class="qa-history-item">' +
        '<div class="qa-history-meta"><span>' + esc(q.name) + '</span><span>👍 ' + (q.votes || 0) + '</span></div>' +
        '<div class="qa-history-text">' + esc(q.text) + '</div>' +
      '</div>'
    ).join('') || '<div class="qa-history-empty">아직 질문이 없습니다.</div>';
  }
```

Find this line (from Task 6):

```js
  function setupPresenterUI() {}
```

Replace with:

```js
  function setupPresenterUI() {
    if (!IS_PRESENTER) return;
    document.getElementById('qa-history-toggle').onclick = () => {
      document.getElementById('qa-history-panel').classList.toggle('qa-hidden');
    };
    document.getElementById('qa-history-close').onclick = () => {
      document.getElementById('qa-history-panel').classList.add('qa-hidden');
    };
    document.getElementById('qa-history-clear').onclick = () => {
      if (confirm('화면의 질문과 질문 기록을 모두 정리할까요?')) api('/qa/clear');
    };
  }
```

- [ ] **Step 2: Manual verification — history panel**

With `npm run dev` running, open a presenter tab (`http://localhost:8080/?present=change-me`) and an audience tab.
From the audience tab, submit two questions, upvote one of them once.
In the presenter tab, click "📋 질문 기록 (2)".
Expected: panel slides in listing both questions, the upvoted one on top, each showing name/text/vote count.

- [ ] **Step 3: Manual verification — clear**

Click "전체 삭제" in the panel, confirm the dialog.
Expected: both the panel list and any still-visible sticky notes on both tabs are cleared, and the counter resets to "📋 질문 기록 (0)".

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add presenter question history panel"
```

---

## Task 10: Reaction feedback — tally counters + floating emoji

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `react` SSE event data shape `{ kind, count, total: { up, confused } }` (Task 3/7), DOM ids `#qa-tally-up`, `#qa-tally-confused`, `#qa-float-layer` (Task 6).
- Produces: filled `setTally(r)` and `spawnFloat(kind)`. After this task, every 👍/🤔 click (wired in Task 8) is visible to both tabs as a floating emoji and an updated counter.

- [ ] **Step 1: Modify `index.html`**

Find this line (from Task 6):

```js
  function setTally(r) {}
```

Replace with:

```js
  function setTally(r) {
    if (!r) return;
    const up = document.getElementById('qa-tally-up');
    const conf = document.getElementById('qa-tally-confused');
    if (up) up.textContent = r.up || 0;
    if (conf) conf.textContent = r.confused || 0;
  }
```

Find this line (from Task 6):

```js
  function spawnFloat(kind) {}
```

Replace with:

```js
  function spawnFloat(kind) {
    const layer = document.getElementById('qa-float-layer');
    const el = document.createElement('div');
    el.className = 'qa-float';
    el.textContent = kind === 'confused' ? '🤔' : '👍';
    el.style.left = (10 + Math.random() * 80) + 'vw';
    layer.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }
```

- [ ] **Step 2: Manual verification**

With `npm run dev` running, open audience and presenter tabs side by side.
In the audience tab, click 👍 three times and 🤔 once.
Expected: in the audience tab, the counter next to 👍 reads 3 and next to 🤔 reads 1; emojis float up from the bottom and fade out over ~2.6s. The presenter tab (which also runs `setTally` via its own SSE connection) does not show the dock, but its `history`/tally state updates silently with no visible error — confirm via DevTools console that no errors were thrown.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add reaction tally counters and floating emoji"
```

---

## Task 11: README update

**Files:**
- Modify: `README.md`

**Interfaces:**
- None — documentation only.

- [ ] **Step 1: Modify `README.md`**

Replace the entire current content:

```markdown
# vibe-coding-202607
```

With:

```markdown
# vibe-coding-202607

바이브 코딩 세미나 슬라이드 (reveal.js, 단일 `index.html`, 빌드 없음).

## 실행

- **정적 열람 (GitHub Pages)**: `index.html`을 그대로 정적 호스팅. 질문/반응 기능 없이 슬라이드만 동작한다.
- **실제 발표 (로컬 실시간 Q&A)**:

  ```bash
  npm run dev        # http://localhost:8080
  # 발표자 키를 바꾸려면: PRESENT_KEY=mykey PORT=8080 npm run dev
  ```

  - **발표자**: `http://localhost:8080/?present=change-me` (화살표/Space로 슬라이드 이동, 우측 상단에서 질문 기록 확인)
  - **청중**: `http://localhost:8080/` 또는 같은 Wi-Fi의 `http://<발표자-IP>:8080/` (서버 시작 시 콘솔에 출력됨)

  발표가 끝나면 서버(Ctrl+C)를 끄면 모든 질문/반응 기록이 사라진다 (영속 저장 없음).

## 테스트

```bash
npm test
```
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document local live Q&A mode"
```

---

## Task 12: End-to-end verification

**Files:** none (verification only, no code changes)

**Interfaces:** none.

- [ ] **Step 1: Full backend regression**

Run: `npm test`
Expected: all tests from Tasks 1–5 pass (16 tests).

- [ ] **Step 2: GitHub Pages equivalence**

Stop any running `npm run dev` process. Open `index.html` directly via `file://`.
Expected: deck behaves identically to before this feature — no dock, no bar, no visible errors.

- [ ] **Step 3: Full live scenario**

```bash
npm run dev
```

Open two tabs: `http://localhost:8080/?present=change-me` (presenter) and `http://localhost:8080/` (audience, set nickname "청중A").

1. Presenter presses → a few times. Audience tab follows (connection dot teal, slide number matches).
2. Audience submits a question "이거 질문 있어요". A sticky note appears on both tabs; presenter's "질문 기록" count becomes 1.
3. Audience clicks 👍 on the note. Vote count becomes 1 on both tabs (presenter panel too, if open).
4. Audience clicks the 👍 reaction button (not the note's vote — the dock's reaction button) and the 🤔 button once. Floating emoji appear, tally counters update.
5. Audience navigates with the left/right arrow keys directly. Follow toggle turns OFF; presenter continuing to navigate does not move the audience's slide.
6. Audience clicks the follow toggle again. Slide snaps to whatever the presenter is currently on.
7. Presenter opens "질문 기록", clicks "전체 삭제", confirms. Sticky notes and history clear on both tabs.

Expected: every step behaves as described, matching spec sections "질문 포스트잇 UI", "슬라이드 동기화", and "반응".

- [ ] **Step 4: Presenter auth check**

With the server still running, from a terminal:

```bash
curl -i -X POST http://localhost:8080/qa/slide -H "Content-Type: application/json" -d "{\"h\":2}"
```

Expected: `403 Forbidden` JSON body `{"error":"forbidden"}` (no key supplied).

- [ ] **Step 5: Final commit (only if any fixups were needed above)**

If Steps 1–4 required any code fixes, stage and commit them with a message describing the fix. If everything passed as-is, no commit is needed for this task.
