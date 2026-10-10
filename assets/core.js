/*
 * 핵심만 보기 — 덱이 너무 길어서 안 읽히는 문제의 처방.
 *
 * 슬라이드는 지우지 않는다. 덜 중요한 장에 data-depth="extra" 를 붙여 두면,
 * 웹에서 혼자 읽는 사람에게는 기본으로 "핵심만" 보여 주고 토글로 전체를 펼친다.
 *
 * 덱 index.html 에서 reveal.js 다음, Reveal.initialize() 앞에 넣는다 (동기 로드):
 *   <link rel="stylesheet" href="../assets/core.css">
 *   <script src="../vendor/reveal/reveal.js"></script>
 *   <script src="../assets/core.js"></script>
 *
 * 모드 결정
 *   - ?full / ?core 쿼리가 있으면 그대로 따른다.
 *   - 실제 발표(server.js 로 띄운 곳, ?present, PDF 인쇄)는 항상 전체 —
 *     발표자와 청중의 슬라이드 번호가 어긋나면 따라가기가 깨지기 때문.
 *   - 그 밖(공개 사이트·file://)은 기본 핵심, 사용자가 토글로 고른 값은 기억한다.
 */
(function () {
  var params = new URLSearchParams(location.search);
  var STATIC_HOSTS = /^vibe-coding\.euiyun\.com$|(^|\.)(github\.io|netlify\.app|vercel\.app|pages\.dev)$/i;
  var readerHost = location.protocol === 'file:' || STATIC_HOSTS.test(location.hostname);
  var KEY = 'vibe-depth';
  var JUMP = 'vibe-depth-jump';

  var slidesEl = document.querySelector('.reveal .slides');
  if (!slidesEl) return;
  var all = Array.prototype.slice.call(slidesEl.children).filter(function (el) {
    return el.tagName === 'SECTION';
  });
  all.forEach(function (s, i) { s.setAttribute('data-orig', String(i)); });
  var depth = function (s) { return s.getAttribute('data-depth'); };
  var extras = all.filter(function (s) { return depth(s) === 'extra'; });
  // data-depth="summary" — 3분 요약(TL;DR) 장. 혼자 읽는 핵심 모드에서만 보이고,
  // 발표(전체 모드)에서는 원래 흐름을 해치지 않도록 빠진다.
  var summaries = all.filter(function (s) { return depth(s) === 'summary'; });
  if (!extras.length && !summaries.length) return;
  var fullCount = all.length - summaries.length;
  var coreCount = all.length - extras.length;

  var forced = params.has('present') || /print-pdf/i.test(location.search);
  var togglable = readerHost && !forced;
  var mode = 'full';
  if (params.has('core')) mode = 'core';
  else if (params.has('full') || !togglable) mode = 'full';
  else {
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (_) {}
    mode = saved === 'full' ? 'full' : 'core';
  }

  (mode === 'core' ? extras : summaries).forEach(function (s) { s.remove(); });
  var kept = Array.prototype.slice.call(slidesEl.children).filter(function (el) {
    return el.tagName === 'SECTION';
  });

  // 토글 직전 보던 장으로 복귀 — 핵심 모드에 그 장이 없으면 바로 앞의 핵심 장으로.
  var jump = null;
  try { jump = sessionStorage.getItem(JUMP); sessionStorage.removeItem(JUMP); } catch (_) {}
  if (jump !== null) {
    var want = Number(jump), idx = 0;
    kept.forEach(function (s, i) { if (Number(s.getAttribute('data-orig')) <= want) idx = i; });
    history.replaceState(null, '', location.pathname + location.search + '#/' + (idx + 1));
  }

  if (!togglable) return;

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'depth-toggle';
  btn.innerHTML = mode === 'core'
    ? '<span class="dt-dot"></span>핵심만 <b>' + coreCount + '</b>장 · <u>전체 ' + fullCount + '장 보기</u>'
    : '<span class="dt-dot full"></span>전체 <b>' + fullCount + '</b>장 · <u>핵심 ' + coreCount + '장만 보기</u>';
  btn.title = mode === 'core'
    ? '배경 이론·사례·참고 장을 접어 두었습니다. 눌러서 전체를 펼칩니다.'
    : '눌러서 핵심 장만 남깁니다.';
  btn.addEventListener('click', function () {
    var cur = 0;
    try {
      var s = window.Reveal && Reveal.getCurrentSlide && Reveal.getCurrentSlide();
      if (s) cur = Number(s.getAttribute('data-orig')) || 0;
    } catch (_) {}
    try {
      localStorage.setItem(KEY, mode === 'core' ? 'full' : 'core');
      sessionStorage.setItem(JUMP, String(cur));
    } catch (_) {}
    var q = new URLSearchParams(location.search);
    q.delete('core'); q.delete('full');
    var qs = q.toString();
    location.href = location.pathname + (qs ? '?' + qs : '');
  });
  document.body.appendChild(btn);
})();

// TL;DR 슬라이드의 프롬프트 복사 버튼 (덱마다 복사 구현이 달라서 여기서 따로 붙인다)
(function () {
  document.querySelectorAll('.tldr-prompt').forEach(function (box) {
    var pre = box.querySelector('pre');
    if (!pre) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'tldr-copy';
    b.textContent = '복사';
    b.addEventListener('click', function () {
      var text = pre.innerText.trim();
      var done = function () { b.textContent = '복사됨 ✓'; setTimeout(function () { b.textContent = '복사'; }, 1600); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { b.textContent = 'Ctrl+C로 복사'; });
      } else {
        var r = document.createRange(); r.selectNodeContents(pre);
        var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
        b.textContent = 'Ctrl+C로 복사';
      }
    });
    box.appendChild(b);
  });
})();
