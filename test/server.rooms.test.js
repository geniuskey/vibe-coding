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
        if (!eventMatch) continue;
        const dataMatch = chunk.match(/^data: (.+)$/m);
        return { event: eventMatch[1], data: dataMatch ? JSON.parse(dataMatch[1]) : null };
      }
    },
    close() { reader.cancel(); },
  };
}

test('GET /workshop/ serves the workshop deck', async () => {
  const res = await fetch(`http://localhost:${port}/workshop/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  const text = await res.text();
  assert.match(text, /<!DOCTYPE html>/i);
  assert.match(text, /워크숍/); // workshop deck, not the root deck
});

test('GET /context/ serves the context deck', async () => {
  const res = await fetch(`http://localhost:${port}/context/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  const text = await res.text();
  assert.match(text, /<!DOCTYPE html>/i);
  assert.match(text, /QA_ROOM = 'context'/); // context deck wired to its own room
});

test('GET /github/ serves the git & github deck', async () => {
  const res = await fetch(`http://localhost:${port}/github/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  const text = await res.text();
  assert.match(text, /<!DOCTYPE html>/i);
  assert.match(text, /QA_ROOM = 'github'/); // github deck wired to its own room
  assert.match(text, /SEMINAR_CONFIG/); // company-configurable domain block present
});

test('a question posted to one room is not visible in another room', async () => {
  await fetch(`http://localhost:${port}/qa/questions?room=workshop`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'workshop-only question' }),
  });

  // A fresh subscriber to a different room must not see the workshop question.
  const mainRes = await fetch(`http://localhost:${port}/qa/events?room=main`);
  const mainStream = sseReader(mainRes);
  const snap = await mainStream.next();
  assert.equal(snap.event, 'snapshot');
  assert.ok(!snap.data.questions.some((q) => q.text === 'workshop-only question'));
  mainStream.close();

  // ...but the workshop room's own snapshot does include it.
  const wsRes = await fetch(`http://localhost:${port}/qa/events?room=workshop`);
  const wsStream = sseReader(wsRes);
  const wsSnap = await wsStream.next();
  assert.ok(wsSnap.data.questions.some((q) => q.text === 'workshop-only question'));
  wsStream.close();
});

test('a broadcast only reaches subscribers of the same room', async () => {
  const wsRes = await fetch(`http://localhost:${port}/qa/events?room=ws2`);
  const wsStream = sseReader(wsRes);
  await wsStream.next(); // snapshot

  const otherRes = await fetch(`http://localhost:${port}/qa/events?room=other`);
  const otherStream = sseReader(otherRes);
  await otherStream.next(); // snapshot

  await fetch(`http://localhost:${port}/qa/questions?room=ws2`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'only ws2 hears this' }),
  });

  const evt = await wsStream.next();
  assert.equal(evt.event, 'question');
  assert.equal(evt.data.text, 'only ws2 hears this');

  // The 'other' room should instead receive the next broadcast targeted at it.
  await fetch(`http://localhost:${port}/qa/questions?room=other`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'now for other' }),
  });
  const otherEvt = await otherStream.next();
  assert.equal(otherEvt.data.text, 'now for other');

  wsStream.close();
  otherStream.close();
});
