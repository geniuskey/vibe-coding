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
