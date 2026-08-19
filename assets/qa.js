/*
 * 통합 발표 플랫폼 — 모든 세미나 덱이 공유하는 실시간 Q&A 클라이언트.
 *
 * 덱 index.html은 아래 두 줄만 넣으면 된다 (13개 덱에 330줄씩 복붙하던 코드를 대체):
 *   <link rel="stylesheet" href="../assets/qa.css">
 *   <script src="../assets/qa.js" defer></script>
 *
 * 덱 이름은 경로(/context/ → "context")에서 유도하므로 덱마다 설정할 값이 없다.
 * ?present 판정도 이 파일 한 곳에서만 일어난다.
 */
(function () {
  const QA_COLORS = ['#9B82FF', '#2BEAD0', '#FF7A95', '#FFD46B'];
  const params = new URLSearchParams(location.search);
  const IS_PRESENTER = params.has('present');

  // 경로의 마지막 폴더명이 곧 덱 이름. /context/, /context/index.html 모두 "context".
  const DECK = (function () {
    const el = document.currentScript;
    const override = el && el.dataset && el.dataset.deck;
    if (override) return override;
    const segs = location.pathname.split('/').filter((s) => s && !/\.html?$/i.test(s));
    return segs.length ? segs[segs.length - 1] : '';
  })();

  let following = sessionStorage.getItem('qa_following') !== '0';
  let liveSlide = 0;
  let liveDeck = null;
  const shownIds = new Set();
  let history = [];

  // 실시간 Q&A는 server.js 가 떠 있는 곳에서만 동작한다. 어디서 프로브할지가 관건인데,
  // 예전에는 사설 IP 대역(localhost·10.·192.168.·172.16~31)만 허용했다. 그러면 사내망처럼
  // 공인 대역을 사설로 쓰는 네트워크나 ngrok·Cloudflare 터널로 열었을 때, 서버가 멀쩡히
  // 떠 있는데도 질문·이모지 UI가 통째로 안 뜬다. 그래서 반대로 뒤집었다 — 서버가 있을 리
  // 없는 정적 호스팅만 빼고 전부 프로브한다. (정적 호스팅을 걸러내는 이유는 /qa/health 가
  // 404가 되면서 .catch 로도 지워지지 않는 콘솔 에러를 남기기 때문이다.)
  const STATIC_HOSTS = /(^|\.)(github\.io|netlify\.app|vercel\.app|pages\.dev)$/i;
  const qaMaybeLive = location.protocol !== 'file:' && !STATIC_HOSTS.test(location.hostname);
  if (qaMaybeLive) {
    fetch('/qa/health', { signal: AbortSignal.timeout(1500) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && d.ok) initLiveQa(); else notifyNoServer(); })
      .catch(() => notifyNoServer());
  } else {
    notifyNoServer();
  }

  // 서버가 없으면 지금까지는 아무 일도 일어나지 않아서, 발표자 입장에서는 "질문 기능이
  // 사라졌다"와 "서버를 안 켰다"를 구분할 수 없었다. ?present 로 들어온 사람에게만
  // 짧은 안내를 띄운다 — 청중 화면은 예전처럼 조용히 슬라이드만 보여준다.
  function notifyNoServer() {
    if (!IS_PRESENTER) return;
    const el = document.createElement('div');
    el.id = 'qa-offline-hint';
    el.textContent = '실시간 Q&A 서버에 연결되지 않았습니다 — 발표용 PC에서 npm run dev 로 실행한 주소로 접속하세요.';
    (document.body || document.documentElement).appendChild(el);
    setTimeout(() => el.remove(), 8000);
  }

  const QA_MARKUP = `
  <div id="qa-note-layer"></div>
  <div id="qa-float-layer"></div>

  <div id="qa-nick-modal" class="qa-modal qa-hidden">
    <div class="qa-modal-box">
      <h3>닉네임을 정해주세요</h3>
      <input id="qa-nick-input" maxlength="24" placeholder="익명" />
      <button id="qa-nick-go">입장하기 →</button>
    </div>
  </div>

  <div id="qa-audience-dock" class="qa-dock qa-hidden">
    <button id="qa-follow-toggle" class="qa-follow on">🔗 발표자 따라가기 ON</button>
    <input id="qa-question-input" maxlength="280" placeholder="질문을 입력하세요" />
    <button id="qa-question-send">보내기</button>
    <button id="qa-react-up">👍 <span id="qa-tally-up">0</span></button>
    <button id="qa-react-confused">🤔 <span id="qa-tally-confused">0</span></button>
  </div>

  <div id="qa-presenter-bar" class="qa-hidden">
    <span id="qa-conn-dot" class="qa-dot"></span>
    <a id="qa-console-link" href="/present/" target="_blank" rel="noopener">🎛️ 발표자 콘솔</a>
    <button id="qa-history-toggle">📋 질문 기록 (<span id="qa-history-count">0</span>)</button>
    <span class="qa-presenter-tally" aria-label="이모지 클릭 수 요약">
      👍 <span id="qa-presenter-tally-up">0</span>
      🤔 <span id="qa-presenter-tally-confused">0</span>
    </span>
  </div>

  <div id="qa-history-panel" class="qa-panel qa-hidden">
    <div class="qa-panel-head">
      <span>질문 기록</span>
      <div>
        <button id="qa-history-clear">전체 삭제</button>
        <button id="qa-history-close">닫기</button>
      </div>
    </div>
    <div id="qa-history-list"></div>
  </div>`;

  function mountRoot() {
    let root = document.getElementById('qa-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'qa-root';
      root.className = 'qa-hidden';
      root.innerHTML = QA_MARKUP;
      document.body.appendChild(root);
    }
    return root;
  }

  function initLiveQa() {
    mountRoot().classList.remove('qa-hidden');
    if (IS_PRESENTER) {
      document.getElementById('qa-presenter-bar').classList.remove('qa-hidden');
      claimDeck();
    } else {
      document.getElementById('qa-audience-dock').classList.remove('qa-hidden');
    }
    connectSse();
    setupSlideSync();
    setupAudienceUI();
    setupPresenterUI();
  }

  function api(path, body) {
    const headers = { 'Content-Type': 'application/json' };
    return fetch(path, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function currentSlide() {
    try { return (window.Reveal && Reveal.getIndices) ? (Reveal.getIndices().h || 0) : 0; }
    catch { return 0; }
  }

  function goToSlide(h) {
    if (!window.Reveal) return;
    if (Reveal.isReady && Reveal.isReady()) Reveal.slide(h);
    else Reveal.on('ready', () => Reveal.slide(h));
  }

  // 발표자가 콘솔을 거치지 않고 /<덱>/?present 를 직접 열었을 때도 세션의 "현재 덱"을
  // 이 덱으로 넘긴다. 주소에 #/5 같은 해시가 붙어 있을 수 있으므로 Reveal이 그 슬라이드를
  // 잡은 뒤에 알려야 청중이 0번이 아니라 실제 슬라이드로 따라온다.
  function claimDeck() {
    if (!DECK) return;
    const send = () => api('/qa/deck', { deck: DECK, h: currentSlide() });
    if (!window.Reveal) return void send();
    if (Reveal.isReady && Reveal.isReady()) send();
    else Reveal.on('ready', send);
  }

  // 통합 세션의 핵심: 발표자가 다른 덱으로 넘어가면 따라가기 중인 청중도 그 덱으로 이동한다.
  // 질문·이모지는 서버에서 하나로 관리되므로 이동해도 흐름이 끊기지 않는다.
  let navigating = false;
  function followDeck(deck, h) {
    if (navigating || IS_PRESENTER || !following) return false;
    if (!deck || !DECK || deck === DECK) return false;
    navigating = true;
    sessionStorage.setItem('qa_following', '1');
    const url = new URL('../' + deck + '/', location.href);
    if (h) url.hash = '/' + h;
    location.replace(url.toString());
    return true;
  }

  function getNickname() {
    try { return JSON.parse(localStorage.getItem('qa_nickname') || 'null'); } catch { return null; }
  }
  function setNickname(name) {
    localStorage.setItem('qa_nickname', JSON.stringify(name));
  }

  let es;
  function connectSse() {
    es = new EventSource('/qa/events?role=' + (IS_PRESENTER ? 'presenter' : 'audience'));
    const dot = document.getElementById('qa-conn-dot');
    es.onopen = () => dot && dot.classList.add('on');
    es.onerror = () => dot && dot.classList.remove('on');

    es.addEventListener('snapshot', (e) => {
      const st = JSON.parse(e.data);
      liveDeck = st.deck || null;
      liveSlide = st.slide || 0;
      setTally(st.reactions);
      history = (st.questions || []).slice();
      renderHistory();
      if (followDeck(liveDeck, liveSlide)) return;
      if (!IS_PRESENTER && following && liveDeck === DECK) goToSlide(liveSlide);
    });

    es.addEventListener('slide', (e) => {
      const { deck, h } = JSON.parse(e.data);
      liveDeck = deck || null;
      liveSlide = h;
      if (IS_PRESENTER) return;
      if (followDeck(liveDeck, liveSlide)) return;
      if (following && (!liveDeck || liveDeck === DECK)) goToSlide(h);
      updateFollowUI();
    });

    es.addEventListener('question', (e) => {
      const q = JSON.parse(e.data);
      history.push(q);
      renderHistory();
      showNote(q);
    });

    es.addEventListener('show', (e) => showNote(JSON.parse(e.data), true));

    es.addEventListener('vote', (e) => {
      const { id, votes } = JSON.parse(e.data);
      const el = document.querySelector('.qa-note[data-id="' + id + '"] .qa-vote-count');
      if (el) el.textContent = votes;
      const hq = history.find((q) => q.id === id);
      if (hq) { hq.votes = votes; renderHistory(); }
    });

    es.addEventListener('react', (e) => {
      const d = JSON.parse(e.data);
      setTally(d.total);
      spawnFloat(d.kind);
    });

    es.addEventListener('reactions', (e) => setTally(JSON.parse(e.data)));

    es.addEventListener('clear', () => {
      document.getElementById('qa-note-layer').innerHTML = '';
      shownIds.clear();
      history = [];
      renderHistory();
    });
  }

  function setupSlideSync() {
    if (!window.Reveal) return;
    if (IS_PRESENTER) {
      Reveal.on('slidechanged', (e) => { api('/qa/slide', { deck: DECK, h: e.indexh }); });
    } else {
      Reveal.on('slidechanged', (e) => {
        if (following && liveDeck === DECK && e.indexh !== liveSlide) { setFollowing(false); }
      });
      const btn = document.getElementById('qa-follow-toggle');
      btn.onclick = () => {
        setFollowing(!following);
        if (following && !followDeck(liveDeck, liveSlide)) goToSlide(liveSlide);
      };
    }
  }

  function setFollowing(on) {
    following = on;
    sessionStorage.setItem('qa_following', on ? '1' : '0');
    updateFollowUI();
  }

  function updateFollowUI() {
    const btn = document.getElementById('qa-follow-toggle');
    if (!btn) return;
    btn.classList.toggle('on', following);
    btn.textContent = following ? '🔗 발표자 따라가기 ON' : '🔓 자유 탐색 OFF';
  }
  function showNote(q, force) {
    if (!force && shownIds.has(q.id)) return;
    shownIds.add(q.id);
    const layer = document.getElementById('qa-note-layer');
    const existing = layer.querySelector('.qa-note[data-id="' + q.id + '"]');
    if (existing) existing.remove();
    const note = document.createElement('div');
    note.className = 'qa-note';
    note.dataset.id = q.id;
    note.style.background = QA_COLORS[q.id % QA_COLORS.length];
    const pos = edgePosition();
    note.style.left = pos.left + 'vw';
    note.style.top = pos.top + 'vh';
    note.style.setProperty('--rot', (Math.random() * 8 - 4).toFixed(1) + 'deg');
    note.innerHTML =
      (IS_PRESENTER ? '<button class="qa-note-close" type="button" aria-label="질문 닫기">×</button>' : '') +
      '<div class="qa-note-name">' + esc(q.name) + '</div>' +
      '<div class="qa-note-text">' + esc(q.text) + '</div>' +
      '<button class="qa-vote">👍 <span class="qa-vote-count">' + (q.votes || 0) + '</span></button>';
    note.querySelector('.qa-vote').onclick = () => api('/qa/questions/vote', { id: q.id });
    const dismiss = () => {
      if (note.dataset.dismissed === '1') return;
      note.dataset.dismissed = '1';
      note.classList.add('qa-leaving');
      setTimeout(() => note.remove(), 500);
    };
    const close = note.querySelector('.qa-note-close');
    if (close) close.onclick = () => { clearTimeout(autoDismiss); dismiss(); };
    layer.appendChild(note);
    const autoDismiss = setTimeout(dismiss, 14000);
    if (IS_PRESENTER) makeDraggable(note, () => clearTimeout(autoDismiss));
  }
  // 화면 중앙이 아니라 가장자리(위/오른쪽/아래/왼쪽) 근처에 무작위로 배치
  function edgePosition() {
    const edge = Math.floor(Math.random() * 4);
    if (edge === 0) return { left: 3 + Math.random() * 70, top: 3 + Math.random() * 9 };   // 위쪽
    if (edge === 1) return { left: 60 + Math.random() * 18, top: 6 + Math.random() * 58 };  // 오른쪽
    if (edge === 2) return { left: 3 + Math.random() * 70, top: 60 + Math.random() * 20 };  // 아래쪽
    return { left: 2 + Math.random() * 7, top: 6 + Math.random() * 58 };                    // 왼쪽
  }
  // 발표자가 포스트잇을 드래그해서 위치를 옮길 수 있게 한다
  function makeDraggable(note, onDragStart) {
    note.classList.add('qa-draggable');
    note.addEventListener('pointerdown', (e) => {
      // 닫기/추천 버튼 클릭은 드래그로 취급하지 않음
      if (e.target.closest('.qa-note-close, .qa-vote')) return;
      if (note.dataset.dismissed === '1') return;
      e.preventDefault();
      if (onDragStart) onDragStart(); // 옮기는 중에는 자동으로 사라지지 않도록
      const rect = note.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      note.classList.add('qa-dragging');
      note.setPointerCapture(e.pointerId);
      const onMove = (ev) => {
        const maxLeft = window.innerWidth - rect.width;
        const maxTop = window.innerHeight - rect.height;
        const left = Math.max(0, Math.min(ev.clientX - offsetX, maxLeft));
        const top = Math.max(0, Math.min(ev.clientY - offsetY, maxTop));
        note.style.left = left + 'px';
        note.style.top = top + 'px';
      };
      const onUp = (ev) => {
        note.classList.remove('qa-dragging');
        note.removeEventListener('pointermove', onMove);
        note.removeEventListener('pointerup', onUp);
        try { note.releasePointerCapture(ev.pointerId); } catch (_) {}
      };
      note.addEventListener('pointermove', onMove);
      note.addEventListener('pointerup', onUp);
    });
  }
  function renderHistory() {
    const countEl = document.getElementById('qa-history-count');
    if (countEl) countEl.textContent = history.length;
    const list = document.getElementById('qa-history-list');
    if (!list) return;
    const sorted = history.slice().sort((a, b) => b.votes - a.votes || a.ts - b.ts);
    list.innerHTML = sorted.map((q) =>
      '<div class="qa-history-item">' +
        '<div class="qa-history-meta"><span>' + esc(q.name) + '</span><span>👍 ' + (q.votes || 0) + '</span></div>' +
        '<div class="qa-history-text">' + esc(q.text) + '</div>' +
      '</div>'
    ).join('') || '<div class="qa-history-empty">아직 질문이 없습니다.</div>';
  }
  function setTally(r) {
    if (!r) return;
    const up = document.getElementById('qa-tally-up');
    const conf = document.getElementById('qa-tally-confused');
    const presenterUp = document.getElementById('qa-presenter-tally-up');
    const presenterConf = document.getElementById('qa-presenter-tally-confused');
    if (up) up.textContent = r.up || 0;
    if (conf) conf.textContent = r.confused || 0;
    if (presenterUp) presenterUp.textContent = r.up || 0;
    if (presenterConf) presenterConf.textContent = r.confused || 0;
  }
  function spawnFloat(kind) {
    const layer = document.getElementById('qa-float-layer');
    const el = document.createElement('div');
    el.className = 'qa-float';
    el.textContent = kind === 'confused' ? '🤔' : '👍';
    el.style.left = (10 + Math.random() * 80) + 'vw';
    layer.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }
  function setupAudienceUI() {
    if (IS_PRESENTER) return;

    const nick = getNickname();
    if (!nick) {
      document.getElementById('qa-nick-modal').classList.remove('qa-hidden');
      document.getElementById('qa-nick-go').onclick = () => {
        const v = document.getElementById('qa-nick-input').value.trim().slice(0, 24) || '익명';
        setNickname(v);
        document.getElementById('qa-nick-modal').classList.add('qa-hidden');
      };
    }

    const input = document.getElementById('qa-question-input');
    const send = () => {
      const text = input.value.trim();
      if (!text) return;
      api('/qa/questions', { text, name: getNickname() || '익명' });
      input.value = '';
    };
    document.getElementById('qa-question-send').onclick = send;
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
      send();
    });

    document.getElementById('qa-react-up').onclick = () => api('/qa/react', { kind: 'up' });
    document.getElementById('qa-react-confused').onclick = () => api('/qa/react', { kind: 'confused' });

    updateFollowUI();
  }
  function setupPresenterUI() {
    if (!IS_PRESENTER) return;
    document.getElementById('qa-history-toggle').onclick = () => {
      document.getElementById('qa-history-panel').classList.toggle('qa-hidden');
    };
    document.getElementById('qa-history-close').onclick = () => {
      document.getElementById('qa-history-panel').classList.add('qa-hidden');
    };
    document.getElementById('qa-history-clear').onclick = () => {
      if (confirm('화면의 질문과 질문 기록을 모두 정리할까요?')) api('/qa/clear');
    };
  }
})();
