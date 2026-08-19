const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 8080;
const INDEX_PATH = path.join(__dirname, 'index.html');

// 발표자 콘솔(/present)과 청중 대기 화면(/live)은 세미나 덱이 아니라 운영 화면이므로
// 덱 목록에서 제외한다.
const NON_DECK_DIRS = new Set(['present', 'live']);

// 폴더별 단일 index.html 규약: 최상위 폴더에 index.html이 있으면 그게 곧 세미나 덱이다.
// 덱 목록을 하드코딩하지 않으므로, 새 세미나 폴더를 추가하면 라우트 수정 없이 바로 동작한다.
function listDecks() {
  return fs.readdirSync(__dirname, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .filter((d) => !NON_DECK_DIRS.has(d.name))
    .filter((d) => fs.existsSync(path.join(__dirname, d.name, 'index.html')))
    .map((d) => d.name)
    .sort();
}

function isDeck(name) {
  return typeof name === 'string' && listDecks().includes(name);
}

// GET /<deck> 또는 /<deck>/ → <deck>/index.html
function serveDeck(req, res, url) {
  if (req.method !== 'GET') return false;
  const m = /^\/([A-Za-z0-9][A-Za-z0-9_-]*)\/?$/.exec(url);
  if (!m) return false;
  const filePath = path.join(__dirname, m[1], 'index.html');
  if (!filePath.startsWith(__dirname + path.sep)) return false;
  if (!fs.existsSync(filePath)) return false;
  serveFile(res, filePath);
  return true;
}

// 통합 발표자 플랫폼: 한 서버는 한 번에 하나의 발표만 진행한다.
// 덱을 바꿔도 질문·투표·이모지는 이어지고, 청중은 발표자가 연 덱을 그대로 따라간다.
// (덱별로 방을 나누면 발표 중간에 덱을 옮길 때마다 질문 흐름이 끊겼다.)
const session = {
  deck: null,            // 지금 발표 중인 덱 폴더명 (없으면 아직 시작 전)
  slide: 0,
  questions: [],
  reactions: { up: 0, confused: 0 },
  nextQuestionId: 1,
  clients: new Set(),
};

// 발표자 화면과 콘솔도 같은 SSE를 쓰므로, "청중 수"는 role=audience 인 연결만 센다.
function viewerCount() {
  let n = 0;
  for (const res of session.clients) if (res.qaRole === 'audience') n++;
  return n;
}

function snapshot() {
  return {
    deck: session.deck,
    slide: session.slide,
    questions: session.questions,
    reactions: session.reactions,
    viewers: viewerCount(),
  };
}

// 테스트가 서버를 재사용하며 상태를 되돌릴 수 있도록 노출한다.
function resetSession() {
  session.deck = null;
  session.slide = 0;
  session.questions = [];
  session.reactions = { up: 0, confused: 0 };
  session.nextQuestionId = 1;
}

function broadcast(event, data, role) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of session.clients) {
    if (role && res.qaRole !== role) continue;
    try { res.write(payload); } catch { session.clients.delete(res); }
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

const STATIC_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

// 정적 사이트(GitHub Pages)는 저장소 전체를 그대로 서빙하므로, 로컬 개발 서버도
// 동일하게 동작하도록 위 라우트에 없는 GET 요청은 저장소 파일로 폴백한다.
// 숨김 파일/폴더(.git, .claude 등)와 경로 탈출은 차단한다.
function serveStatic(req, res, url) {
  if (req.method !== 'GET') return false;
  const decoded = decodeURIComponent(url);
  if (decoded.split('/').some((seg) => seg.startsWith('.'))) return false;
  const filePath = path.join(__dirname, decoded);
  if (!filePath.startsWith(__dirname + path.sep)) return false;
  const ext = path.extname(filePath).toLowerCase();
  const type = STATIC_TYPES[ext];
  if (!type) return false;
  fs.readFile(filePath, (err, content) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': type });
    res.end(content);
  });
  return true;
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

  // 청중에게는 이 링크 하나만 안내하면 된다.
  // 발표 중이면 그 덱으로 바로 넘기고, 아직 시작 전이면 대기 화면을 준다. 예전에는 시작 전
  // 접속을 허브(/)로 보냈는데, 허브에는 Q&A 스크립트가 없어서 발표가 시작돼도 청중이
  // 따라가지 못하고 그대로 멈춰 있었다. 대기 화면은 SSE를 붙들고 있다가 스스로 넘어간다.
  if ((url === '/live' || url === '/live/') && req.method === 'GET') {
    if (session.deck) {
      res.writeHead(302, { Location: `/${session.deck}/` });
      return res.end();
    }
    return serveFile(res, path.join(__dirname, 'live', 'index.html'));
  }

  if (url === '/qa/health' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, lan: lanAddress(), decks: listDecks() });
  }

  // SSE를 못 쓰는 환경(또는 콘솔 첫 렌더)에서도 현재 상태를 한 번에 받아갈 수 있게.
  if (url === '/qa/session' && req.method === 'GET') return sendJson(res, 200, snapshot());

  if (serveDeck(req, res, url)) return;

  // 발표자 콘솔이 "이 덱으로 발표 시작"을 누르면 세션의 현재 덱이 바뀌고,
  // 따라가기 중인 청중은 그 덱으로 이동한다. 질문·이모지는 그대로 유지된다.
  if (url === '/qa/deck' && req.method === 'POST') {
    const body = await readBody(req);
    const deck = (body.deck || '').toString();
    if (!isDeck(deck)) return sendJson(res, 400, { error: 'unknown deck' });
    session.deck = deck;
    session.slide = Math.max(0, Number(body.h) || 0);
    broadcast('slide', { deck: session.deck, h: session.slide });
    return sendJson(res, 200, { deck: session.deck, h: session.slide });
  }

  if (url === '/qa/questions' && req.method === 'POST') {
    const body = await readBody(req);
    const text = (body.text || '').toString().trim().slice(0, 280);
    if (!text) return sendJson(res, 400, { error: 'empty' });
    const name = (body.name || '').toString().trim().slice(0, 24) || '익명';
    const q = { id: session.nextQuestionId++, text, name, ts: Date.now(), votes: 0, deck: session.deck };
    session.questions.push(q);
    broadcast('question', q);
    return sendJson(res, 201, q);
  }

  if (url === '/qa/questions/vote' && req.method === 'POST') {
    const body = await readBody(req);
    const q = session.questions.find((x) => x.id === Number(body.id));
    if (!q) return sendJson(res, 404, { error: 'not found' });
    q.votes++;
    broadcast('vote', { id: q.id, votes: q.votes });
    return sendJson(res, 200, { id: q.id, votes: q.votes });
  }

  // 콘솔에서 지난 질문을 골라 발표 화면에 다시 띄운다 (이미 사라진 포스트잇 소환).
  if (url === '/qa/questions/show' && req.method === 'POST') {
    const body = await readBody(req);
    const q = session.questions.find((x) => x.id === Number(body.id));
    if (!q) return sendJson(res, 404, { error: 'not found' });
    broadcast('show', q);
    return sendJson(res, 200, q);
  }

  if (url === '/qa/react' && req.method === 'POST') {
    const body = await readBody(req);
    const kind = body.kind === 'confused' ? 'confused' : 'up';
    session.reactions[kind]++;
    broadcast('react', { kind, count: session.reactions[kind], total: session.reactions });
    return sendJson(res, 200, session.reactions);
  }

  if (url === '/qa/reactions/reset' && req.method === 'POST') {
    session.reactions = { up: 0, confused: 0 };
    broadcast('reactions', session.reactions);
    return sendJson(res, 200, session.reactions);
  }

  if (url === '/qa/slide' && req.method === 'POST') {
    const body = await readBody(req);
    if (isDeck(body.deck)) session.deck = body.deck;
    session.slide = Math.max(0, Number(body.h) || 0);
    broadcast('slide', { deck: session.deck, h: session.slide });
    return sendJson(res, 200, { deck: session.deck, h: session.slide });
  }

  if (url === '/qa/clear' && req.method === 'POST') {
    session.questions = [];
    broadcast('clear', {});
    return sendJson(res, 200, { ok: true });
  }

  if (url === '/qa/events' && req.method === 'GET') {
    const role = new URL(req.url, 'http://x').searchParams.get('role');
    res.qaRole = role === 'presenter' || role === 'console' ? role : 'audience';
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    });
    res.write('retry: 3000\n\n');
    session.clients.add(res);
    res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot())}\n\n`);
    broadcast('presence', { viewers: viewerCount() }, 'console'); // 청중 수는 발표자 콘솔만 쓴다
    const hb = setInterval(() => {
      try { res.write(': ping\n\n'); } catch { drop(); }
    }, 15000);
    let dropped = false;
    function drop() {
      if (dropped) return;
      dropped = true;
      session.clients.delete(res);
      clearInterval(hb);
      broadcast('presence', { viewers: viewerCount() }, 'console'); // 청중 수는 발표자 콘솔만 쓴다
    }
    req.on('close', drop);
    return;
  }

  if (serveStatic(req, res, url)) return;

  res.writeHead(404);
  res.end('Not found');
});

if (require.main === module) {
  server.listen(PORT, () => {
    const lan = lanAddress();
    const base = lan ? `http://${lan}:${PORT}` : `http://localhost:${PORT}`;
    console.log('통합 발표 플랫폼이 켜졌습니다:');
    console.log(`  발표자 콘솔: http://localhost:${PORT}/present/   ← 여기 하나만 열면 됩니다`);
    console.log(`  청중 링크:   ${base}/live`);
    console.log(`  세미나 목록: http://localhost:${PORT}/`);
    console.log(`  (덱 ${listDecks().length}종: ${listDecks().join(', ')})`);
  });
}

module.exports = server;
module.exports.resetSession = resetSession;
module.exports.listDecks = listDecks;
