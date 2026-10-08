#!/usr/bin/env node
/*
 * 세미나별 PDF 생성기 — assets/decks.js 의 덱마다 pdf/<id>.pdf 를 만든다.
 *
 *   node scripts/build-pdfs.js            # 전체
 *   node scripts/build-pdfs.js intro ui-ux # 일부만
 *
 * reveal.js 의 ?print-pdf 모드로 각 덱을 열어 Chromium 으로 인쇄한다.
 * 프래그먼트는 페이지를 쪼개지 않고 모두 펼친 상태로 한 장에 담는다.
 * 덱 내용을 고쳤으면 이 스크립트를 다시 돌려 pdf/ 를 함께 커밋한다.
 *
 * 용량 줄이기 (scripts/pdf_tools.py, `pip install fonttools brotli pypdf pillow`):
 *  - Chromium 은 가변 폰트(Pretendard Variable)를 페이지마다 Type 3 글꼴로 다시 심으므로,
 *    인쇄할 때만 굵기별 정적 인스턴스로 바꿔 끼운다.
 *  - 글로우·그림자처럼 비트맵으로 구워진 레이어를 JPEG 으로 재압축한다.
 * 파이썬 패키지가 없으면 이 단계만 건너뛴다 (결과는 같고 용량만 커진다).
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'pdf');

function loadDecks() {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets/decks.js'), 'utf8'), ctx);
  return ctx.window.SEMINAR_DECKS;
}

const FONT_CSS = path.join(ROOT, 'vendor/fonts/pretendard.css');
const TOOLS = path.join(__dirname, 'pdf_tools.py');
const STATIC_WEIGHTS = [300, 400, 500, 600, 700, 800, 900];

// pretendard.css 의 가변 Pretendard @font-face 를 굵기별 정적 TTF @font-face 로 바꾼 CSS.
function staticFontCss() {
  const css = fs.readFileSync(FONT_CSS, 'utf8');
  const rule = css.match(/@font-face\{font-family:'Pretendard';[^}]*base64,([A-Za-z0-9+\/=]+)[^}]*\}/);
  if (!rule) return null;
  let fonts;
  try {
    fonts = JSON.parse(execFileSync('python3', [TOOLS, 'fonts', STATIC_WEIGHTS.join(',')], {
      input: rule[1], maxBuffer: 64 * 1024 * 1024, stdio: ['pipe', 'pipe', 'ignore'],
    }).toString());
  } catch (_) {
    console.warn('! fonttools 를 쓸 수 없어 가변 폰트로 인쇄합니다 (PDF 용량이 커집니다).');
    return null;
  }
  const faces = STATIC_WEIGHTS.map(w =>
    `@font-face{font-family:'Pretendard';font-style:normal;font-weight:${w};` +
    `src:url(data:font/ttf;base64,${fonts[w]}) format('truetype');}`).join('');
  return css.replace(rule[0], faces);
}

function loadPlaywright() {
  const candidates = ['playwright', '/opt/node22/lib/node_modules/playwright'];
  for (const c of candidates) {
    try { return require(c); } catch (_) { /* 다음 후보 */ }
  }
  throw new Error('playwright 를 찾을 수 없습니다 — `npm i -g playwright` 후 다시 실행하세요.');
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.json': 'application/json', '.mp4': 'video/mp4',
};

// 정적 파일 서버 — 인쇄 중 Q&A 서버(/qa/*)는 없어도 된다.
function serve() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(ROOT, p);
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// Reveal.initialize 를 가로채 인쇄용 옵션을 덧붙인다 (덱 파일은 건드리지 않는다).
function patchReveal() {
  let real;
  Object.defineProperty(window, 'Reveal', {
    configurable: true,
    get() { return real; },
    set(v) {
      if (v && typeof v.initialize === 'function') {
        const init = v.initialize.bind(v);
        v.initialize = (opts = {}) => init(Object.assign({}, opts, {
          pdfSeparateFragments: false,
          pdfMaxPagesPerSlide: 1,
          showNotes: false,
          slideNumber: false,
        }));
      }
      real = v;
    },
  });
}

// 인쇄 직전 정리 — 화면용 장식을 걷어내 PDF 를 가볍고 깨끗하게 만든다.
function preparePrint() {
  // 0) 등장 애니메이션(opacity:0 → 1 등)을 끝까지 감은 뒤 최종 모습을 인라인으로 고정한다.
  //    아래에서 애니메이션을 끄면 원래 상태(대개 투명)로 돌아가기 때문이다.
  const frozen = [];
  for (const el of document.querySelectorAll('.reveal *')) {
    const anims = el.getAnimations();
    if (!anims.length) continue;
    let finite = true;
    for (const a of anims) {
      try { a.finish(); } catch (_) { finite = false; } // 무한 반복은 고정하지 않는다
    }
    if (!finite) continue;
    const cs = getComputedStyle(el);
    frozen.push([el, cs.opacity, cs.transform, cs.visibility]);
  }

  // 1) 그림자·글로우·블러는 Chromium 이 요소마다 비트맵으로 구워 PDF 를 수십 MB 로 키운다.
  //    애니메이션도 끈다 — 인쇄 경로는 애니메이션을 첫 키프레임(대개 opacity:0)으로 찍는다.
  const style = document.createElement('style');
  style.textContent = '*,*::before,*::after{box-shadow:none!important;text-shadow:none!important;' +
    'filter:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;' +
    'animation:none!important;transition:none!important}' +
    // 슬라이드가 페이지 경계를 몇 px 넘으면 Chromium 이 블록을 '다음 장'으로 밀어내고
    // 그 장은 잘려 보이지 않는다 — 장마다 독립된 상자로 만들어 쪼개지지 않게 한다.
    '.reveal .pdf-page{contain:strict}';
  document.head.appendChild(style);
  for (const [el, opacity, transform, visibility] of frozen) {
    el.style.setProperty('opacity', opacity, 'important');
    el.style.setProperty('transform', transform, 'important');
    el.style.setProperty('visibility', visibility, 'important');
  }

  // 2) 그라데이션 텍스트(background-clip:text)는 PDF 뷰어에서 흐린 상자로 깨지므로
  //    그라데이션의 첫 색으로 칠한 단색 텍스트로 바꾼다.
  for (const el of document.querySelectorAll('.reveal *')) {
    const cs = getComputedStyle(el);
    if (cs.webkitBackgroundClip !== 'text' && cs.backgroundClip !== 'text') continue;
    const m = cs.backgroundImage.match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}/i);
    const color = m ? m[0] : cs.color;
    el.style.setProperty('background', 'none', 'important');
    el.style.setProperty('-webkit-text-fill-color', color, 'important');
    el.style.setProperty('color', color, 'important');
  }

  // 3) 덱 바깥의 화면용 UI(툴바·Q&A 도크·배경 캔버스 등)는 숨긴다.
  for (const el of document.body.children) {
    if (!el.classList.contains('reveal') && el.tagName !== 'SCRIPT') el.style.setProperty('display', 'none', 'important');
  }
}

async function main() {
  const decks = loadDecks();
  const only = process.argv.slice(2);
  const targets = only.length ? decks.filter(d => only.includes(d.id)) : decks;
  if (!targets.length) throw new Error('해당하는 덱이 없습니다: ' + only.join(', '));

  fs.mkdirSync(OUT, { recursive: true });
  const { chromium } = loadPlaywright();
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(f => fs.existsSync(f));
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const fontCss = staticFontCss();

  try {
    for (const deck of targets) {
      // 덱마다 새 컨텍스트 — 앞 덱이 남긴 localStorage 등이 다음 덱 인쇄에 섞이지 않게.
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      await page.addInitScript(patchReveal);
      if (fontCss) {
        await page.route('**/vendor/fonts/pretendard.css', route =>
          route.fulfill({ status: 200, contentType: 'text/css', body: fontCss }));
      }
      // SSE 연결 때문에 networkidle 은 오지 않으므로 load + Reveal ready 로 기다린다.
      await page.goto(`${base}/${deck.id}/?print-pdf`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.Reveal && window.Reveal.isReady && window.Reveal.isReady(), null, { timeout: 30000 });
      // print-pdf 레이아웃(.pdf-page 래핑)은 ready 이후 비동기로 끝나므로 그것까지 기다린다.
      await page.waitForFunction(() => document.querySelector('.reveal .pdf-page'), null, { timeout: 30000 });
      await page.evaluate(() => document.fonts && document.fonts.ready);
      await page.waitForTimeout(1500); // 덱 스크립트·등장 애니메이션이 자리 잡을 시간
      await page.evaluate(preparePrint);
      await page.waitForTimeout(300);
      const size = await page.evaluate(() => ({
        w: window.Reveal.getConfig().width, h: window.Reveal.getConfig().height,
      }));
      const file = path.join(OUT, `${deck.id}.pdf`);
      await page.pdf({
        path: file,
        width: `${size.w}px`,
        height: `${size.h}px`,
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });
      await context.close();
      try {
        execFileSync('python3', [TOOLS, 'compress', file], { stdio: ['ignore', 'ignore', 'pipe'] });
      } catch (err) {
        console.warn(`! ${deck.id}: 재압축 건너뜀 (${String(err.stderr || err.message).trim().split('\n').pop()})`);
      }
      const kb = Math.round(fs.statSync(file).size / 1024);
      console.log(`✓ ${deck.id.padEnd(14)} → pdf/${deck.id}.pdf (${kb} KB)`);
    }
  } finally {
    server.close();
    await browser.close();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
