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
