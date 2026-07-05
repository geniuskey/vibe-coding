const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 8080;
const PRESENT_KEY = process.env.PRESENT_KEY || 'change-me';
const INDEX_PATH = path.join(__dirname, 'index.html');

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

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  if (url === '/' && req.method === 'GET') return serveIndex(res);
  if (url === '/qa/health' && req.method === 'GET') return sendJson(res, 200, { ok: true });

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
