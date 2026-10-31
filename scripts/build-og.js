#!/usr/bin/env node
/*
 * 세미나별 OG 이미지 생성기 — assets/og-deck.html?id=<덱> 을 og/<덱>.png(1200×630)로 찍는다.
 *
 *   node scripts/build-og.js            # 전체 (assets/decks.js 의 덱 + UI/UX 치트시트)
 *   node scripts/build-og.js intro ui-ux # 일부만
 *
 * 로컬 Chrome 을 DevTools 프로토콜로 띄워 뷰포트를 정확히 1200×630(2배 밀도)으로 맞춰 찍고,
 * sips(macOS)로 1200×630 으로 줄인다. (--screenshot 플래그는 새 헤드리스에서 뷰포트가 창보다 작아 쓰지 않는다)
 * 카드 문구를 고쳤으면 다시 돌리고, 각 index.html 의 og:image ?v= 를 올려 캐시를 깬다.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'og');
const TEMPLATE = path.join(ROOT, 'assets/og-deck.html');
const EXTRA = ['ui-ux-cheatsheet'];
const PORT = 9339;

function loadDecks() {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets/decks.js'), 'utf8'), ctx);
  return ctx.window.SEMINAR_DECKS;
}

const CHROME = [
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find(f => f && fs.existsSync(f));
if (!CHROME) throw new Error('Chrome 을 찾을 수 없습니다 — CHROME=<경로> 로 지정하세요.');

const sleep = ms => new Promise(r => setTimeout(r, ms));

// 최소한의 CDP 클라이언트 — send(method, params) → result
async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });
  let seq = 0;
  const pending = new Map();
  ws.onmessage = e => {
    const msg = JSON.parse(e.data);
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    msg.error ? p.fail(new Error(msg.error.message)) : p.ok(msg.result);
  };
  const send = (method, params = {}) => new Promise((ok, fail) => {
    const id = ++seq;
    pending.set(id, { ok, fail });
    ws.send(JSON.stringify({ id, method, params }));
  });
  return { send, close: () => ws.close() };
}

async function main() {
  const all = [...loadDecks().map(d => d.id), ...EXTRA];
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : all;
  fs.mkdirSync(OUT, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'og-'));

  const chrome = spawn(CHROME, [
    '--headless', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${path.join(tmp, 'profile')}`, 'about:blank',
  ], { stdio: 'ignore' });

  try {
    let target;
    for (let i = 0; i < 50 && !target; i++) {
      await sleep(100);
      target = await fetch(`http://127.0.0.1:${PORT}/json/list`).then(r => r.json())
        .then(list => list.find(t => t.type === 'page')).catch(() => null);
    }
    if (!target) throw new Error('Chrome DevTools 에 연결하지 못했습니다.');
    const { send, close } = await connect(target.webSocketDebuggerUrl);
    await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 630, deviceScaleFactor: 2, mobile: false });

    for (const id of ids) {
      if (!all.includes(id)) { console.warn(`건너뜀: 알 수 없는 덱 ${id}`); continue; }
      const search = `?id=${encodeURIComponent(id)}`;
      await send('Page.navigate', { url: `file://${TEMPLATE}${search}` });
      // 새 문서가 다 뜰 때까지 기다린 뒤 폰트 로딩 → 한 프레임 더
      for (let ready = false; !ready; await sleep(50)) {
        const { result } = await send('Runtime.evaluate', {
          expression: `location.search === ${JSON.stringify(search)} && document.readyState === 'complete'`,
        }).catch(() => ({ result: {} }));
        ready = result.value === true;
      }
      await send('Runtime.evaluate', {
        expression: 'document.fonts.ready.then(() => new Promise(r => requestAnimationFrame(() => r())))',
        awaitPromise: true,
      });
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      const big = path.join(tmp, `${id}@2x.png`);
      fs.writeFileSync(big, Buffer.from(data, 'base64'));
      execFileSync('sips', ['-z', '630', '1200', big, '--out', path.join(OUT, `${id}.png`)], { stdio: 'ignore' });
      console.log(`og/${id}.png`);
    }
    close();
  } finally {
    const exited = new Promise(r => chrome.once('exit', r));
    chrome.kill();
    await exited;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
