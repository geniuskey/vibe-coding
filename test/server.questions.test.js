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

test('POST /qa/questions with an oversized (>1MB) body resets the connection instead of hanging', async () => {
  const hugeBody = JSON.stringify({ text: 'x'.repeat(1_100_000) });
  let threw = false;
  try {
    await fetch(`http://localhost:${port}/qa/questions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: hugeBody,
    });
  } catch {
    threw = true;
  }
  assert.equal(threw, true);

  // server must still be alive and serving normal requests afterwards
  const health = await fetch(`http://localhost:${port}/qa/health`);
  assert.equal(health.status, 200);
});

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

test('closing an SSE connection cleans up so other subscribers still receive broadcasts', async () => {
  const deadRes = await fetch(`http://localhost:${port}/qa/events`);
  const deadStream = sseReader(deadRes);
  await deadStream.next(); // snapshot

  const liveRes = await fetch(`http://localhost:${port}/qa/events`);
  const liveStream = sseReader(liveRes);
  await liveStream.next(); // snapshot

  deadStream.close(); // abruptly cancel, simulating a dropped client mid-connection

  const res = await fetch(`http://localhost:${port}/qa/questions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'still alive?' }),
  });
  assert.equal(res.status, 201);

  const evt = await liveStream.next();
  assert.equal(evt.event, 'question');
  assert.equal(evt.data.text, 'still alive?');
  liveStream.close();
});
