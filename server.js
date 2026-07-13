const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 8080;
const INDEX_PATH = path.join(__dirname, 'index.html');
const WORKSHOP_INDEX_PATH = path.join(__dirname, 'workshop', 'index.html');
const CONTEXT_INDEX_PATH = path.join(__dirname, 'context', 'index.html');

// 각 발표(덱)는 서로 다른 슬라이드를 가지므로, 질문·투표·반응·슬라이드 위치를
// "방(room)" 단위로 분리해 섞이지 않게 한다. 파라미터가 없으면 기본 방('main').
const rooms = new Map();
function getRoom(id) {
  let room = rooms.get(id);
  if (!room) {
    room = { slide: 0, questions: [], reactions: { up: 0, confused: 0 }, nextQuestionId: 1, clients: new Set() };
    rooms.set(id, room);
  }
  return room;
}
function roomIdOf(req) {
  const id = new URL(req.url, 'http://x').searchParams.get('room');
  return id ? id.slice(0, 40) : 'main';
}
function snapshotOf(room) {
  return { slide: room.slide, questions: room.questions, reactions: room.reactions };
}

function broadcast(room, event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of room.clients) {
    try { res.write(payload); } catch { room.clients.delete(res); }
  }
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    let settled = false;
    req.on('data', (chunk) => {
      if (settled) return;
      data += chunk;
      if (data.length > 1e6) {
        settled = true;
        req.destroy();
        resolve({});
      }
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { resolve({}); }
    });
  });
}

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, content) => {
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

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  if (url === '/' && req.method === 'GET') return serveFile(res, INDEX_PATH);
  if ((url === '/workshop' || url === '/workshop/') && req.method === 'GET') return serveFile(res, WORKSHOP_INDEX_PATH);
  if ((url === '/context' || url === '/context/') && req.method === 'GET') return serveFile(res, CONTEXT_INDEX_PATH);
  if (url === '/qa/health' && req.method === 'GET') return sendJson(res, 200, { ok: true });

  if (url === '/qa/questions' && req.method === 'POST') {
    const room = getRoom(roomIdOf(req));
    const body = await readBody(req);
    const text = (body.text || '').toString().trim().slice(0, 280);
    if (!text) return sendJson(res, 400, { error: 'empty' });
    const name = (body.name || '').toString().trim().slice(0, 24) || '익명';
    const q = { id: room.nextQuestionId++, text, name, ts: Date.now(), votes: 0 };
    room.questions.push(q);
    broadcast(room, 'question', q);
    return sendJson(res, 201, q);
  }

  if (url === '/qa/questions/vote' && req.method === 'POST') {
    const room = getRoom(roomIdOf(req));
    const body = await readBody(req);
    const q = room.questions.find((x) => x.id === Number(body.id));
    if (!q) return sendJson(res, 404, { error: 'not found' });
    q.votes++;
    broadcast(room, 'vote', { id: q.id, votes: q.votes });
    return sendJson(res, 200, { id: q.id, votes: q.votes });
  }

  if (url === '/qa/react' && req.method === 'POST') {
    const room = getRoom(roomIdOf(req));
    const body = await readBody(req);
    const kind = body.kind === 'confused' ? 'confused' : 'up';
    room.reactions[kind]++;
    broadcast(room, 'react', { kind, count: room.reactions[kind], total: room.reactions });
    return sendJson(res, 200, room.reactions);
  }

  if (url === '/qa/slide' && req.method === 'POST') {
    const room = getRoom(roomIdOf(req));
    const body = await readBody(req);
    room.slide = Math.max(0, Number(body.h) || 0);
    broadcast(room, 'slide', { h: room.slide });
    return sendJson(res, 200, { h: room.slide });
  }

  if (url === '/qa/clear' && req.method === 'POST') {
    const room = getRoom(roomIdOf(req));
    room.questions = [];
    broadcast(room, 'clear', {});
    return sendJson(res, 200, { ok: true });
  }

  if (url === '/qa/events' && req.method === 'GET') {
    const room = getRoom(roomIdOf(req));
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    });
    res.write('retry: 3000\n\n');
    res.write(`event: snapshot\ndata: ${JSON.stringify(snapshotOf(room))}\n\n`);
    room.clients.add(res);
    const hb = setInterval(() => {
      try { res.write(': ping\n\n'); } catch { drop(); }
    }, 15000);
    function drop() { room.clients.delete(res); clearInterval(hb); }
    req.on('close', drop);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

if (require.main === module) {
  server.listen(PORT, () => {
    const lan = lanAddress();
    console.log('Live Q&A running:');
    console.log(`  발표자(메인):   http://localhost:${PORT}/?present`);
    console.log(`  청중(메인):     http://localhost:${PORT}/`);
    console.log(`  발표자(워크숍): http://localhost:${PORT}/workshop/?present`);
    console.log(`  청중(워크숍):   http://localhost:${PORT}/workshop/`);
    console.log(`  발표자(컨텍스트): http://localhost:${PORT}/context/?present`);
    console.log(`  청중(컨텍스트):   http://localhost:${PORT}/context/`);
    if (lan) console.log(`  (같은 Wi-Fi에서는 http://${lan}:${PORT}/ 로 접속)`);
  });
}

module.exports = server;
