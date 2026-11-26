// 발표 진행: 장면 등록, 비트 시계, 전환, 입력, 발표자 노트·전체 보기·도움말, HUD, 적응형 해상도.
//
// 장면 정의
//   Deck.scene({ id, title, mood, transition, ink, bg, beats: [{ dur, note }], create(ctx) → { render(s, hdr) } })
//   render(s, hdr)는 hdr(선형 HDR 타깃)에 그림을 그리고, 후처리 값({ bloom, exposure, tone, grain, ... })을 돌려준다.
//   글자·도형은 ctx.overlay에 넣어 두면 톤 매핑 뒤 또렷하게 얹힌다.
//
// 비트 시계: s.at(k)는 k번째 비트가 시작된 뒤 흐른 초(아직이면 -1). 뒤로 가면 시계가 거꾸로 감겨서 애니메이션이 되돌아간다.
(() => {
  const T = window.THREE;
  const { clamp, lerp, ease, prog, damp, lin } = Deck.util;
  const scenes = [];
  const transitions = {};
  const REWIND = 2.6;       // 뒤로 갈 때 시계가 감기는 속도
  const QUALITY = [1, 0.85, 0.72, 0.6, 0.5];

  Deck.frameId = 0;
  Deck.scenes = scenes;
  Deck.scene = (def) => scenes.push(def);
  Deck.transition = (name, def) => (transitions[name] = def);

  let g = null, hdr, ldrA, ldrB, ldrT, thumbT;
  let R = [];                 // 장면 실행 정보
  let cur = 0, trans = null;
  let chrome = true, auto = false, black = 0, blackTarget = 0;
  let suppress = true;
  let lastNow = 0, clock = 0, startedAt = 0;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  const sfx = (name, opts) => window.Snd && window.Snd.play(name, opts);

  // ── 장면 실행 정보 ────────────────────────────────────────────────
  function makeState(rt) {
    const n = rt.def.beats.length;
    const s = {
      beat: 0, n, clocks: new Float64Array(n).fill(-1), time: 0, dt: 0, enter: 1, exit: 0, dir: 1, live: false,
      mouse, get view() { return g.view; },
      at: (k) => (k >= 0 && k < n && s.clocks[k] >= 0 ? s.clocks[k] : -1),
      p: (k, delay = 0, dur = 1, e = ease.out3) => prog(s.at(k), delay, dur, e),
      cue(key, cond, name, opts) {
        if (!s.live) return;
        const was = rt.edges[key]; rt.edges[key] = !!cond;
        if (cond && !was && !suppress) sfx(name, opts);
      },
      ticks(key, v, name = "key", opts) {
        if (!s.live) return;
        const was = rt.edges[key] ?? 0; rt.edges[key] = v;
        if (v > was && !suppress) sfx(name, opts);
      },
    };
    return s;
  }
  const settleOf = (rt, k) => rt.def.beats[k].dur ?? 3;
  function settle(rt, beat) {
    const s = rt.s;
    s.beat = beat; s.time = 24; s.enter = 1; s.exit = 0;
    for (let k = 0; k < s.n; k++) s.clocks[k] = k <= beat ? settleOf(rt, k) + 20 : -1;
  }
  function reset(rt) {
    const s = rt.s;
    s.beat = 0; s.time = 0; s.enter = 1; s.exit = 0; s.clocks.fill(-1); s.clocks[0] = 0;
  }
  function step(rt, dt) {
    const s = rt.s;
    s.dt = dt; s.time += dt;
    for (let k = 0; k < s.n; k++) {
      if (k <= s.beat) s.clocks[k] = s.clocks[k] < 0 ? 0 : s.clocks[k] + dt;
      else if (s.clocks[k] >= 0) {
        s.clocks[k] = Math.min(s.clocks[k], settleOf(rt, k)) - dt * REWIND;
        if (s.clocks[k] < 0) s.clocks[k] = -1;
      }
    }
  }

  function makeCtx(rt) {
    const overlay = new T.Scene();
    overlay.matrixWorldAutoUpdate = true;
    const own = (fn) => (...a) => { const prev = g.owner; g.owner = rt; try { return fn(...a); } finally { g.owner = prev; } };
    const ctx = {
      T, g, r: g.r, overlay, ortho: g.ortho, glsl: Deck.glsl, util: Deck.util,
      get view() { return g.view; },
      text: (str, o) => { const t = new Deck.Text(str, o); if (o?.add !== false) overlay.add(t.mesh); return t; },
      shape: (kind, o) => { const sh = new Deck.Shape(kind, o); if (o?.add !== false) overlay.add(sh.mesh); return sh; },
      panel: (w, h, o) => { const p = new Deck.Panel(w, h, o); if (o?.add !== false) overlay.add(p.mesh); return p; },
      target: own(g.target), pass: g.pass, draw: g.draw, clear: g.clear, copy: g.copy, over: g.over, project: g.project, fit: g.fit,
      camera: (fov = 40, near = 0.1, far = 500) => new T.PerspectiveCamera(fov, 16 / 9, near, far),
      // 간단한 환경맵: 주어진 장면을 PMREM으로 구워서 반사·조명에 쓴다
      env: (scene, sigma = 0.04) => { const pm = new T.PMREMGenerator(g.r); const rt = pm.fromScene(scene, sigma); pm.dispose(); return rt.texture; },
    };
    return ctx;
  }

  async function ensure(rt) {
    if (rt.inst) return rt.inst;
    if (rt._init) return rt._init;
    rt._init = (async () => {
      g.owner = rt;
      try {
        rt.ctx = makeCtx(rt);
        const inst = rt.def.create(rt.ctx);
        g.owner = null;
        if (inst.init) await inst.init();
        rt.inst = inst;
      } catch (e) {
        console.error("장면 만들기 실패", rt.def.id, e);
        rt.inst = { render() { return {}; } };
      } finally { g.owner = null; }
      return rt.inst;
    })();
    return rt._init;
  }

  // ── 그리기 ────────────────────────────────────────────────────────
  function paint(rt, out, live) {
    Deck.frameId++;
    rt.s.live = live;
    g.clear(hdr, rt.bgColor, 1);
    let post = {};
    try { post = rt.inst.render(rt.s, hdr) || {}; }
    catch (e) { if (!rt._err) { console.error("장면 그리기 오류", rt.def.id, e); rt._err = true; } }
    g.resolve(hdr);
    g.post(hdr, out, post);
    g.r.setRenderTarget(out);
    g.r.render(rt.ctx.overlay, g.ortho);
    if (rt.inst.overlayDraw) { try { rt.inst.overlayDraw(rt.s, out); } catch (e) { if (!rt._err2) { console.error(e); rt._err2 = true; } } }
    rt.s.live = false;
    rt.lastPost = post;
    return post;
  }

  // ── HUD: 오른쪽 아래 장면 번호 + 맨 아래 진행 막대 ────────────────────
  let hud = null;
  function makeHud() {
    const scene = new T.Scene();
    const num = new Deck.Text("01", { size: 21, weight: 500, family: "mono", align: "right", valign: "middle", tracking: 0.04 });
    const tot = new Deck.Text(" / 10", { size: 21, weight: 400, family: "mono", align: "left", valign: "middle", tracking: 0.04 });
    const track = new Deck.Shape("rect", { fill: "#ffffff", fillAlpha: 1 });
    const fill = new Deck.Shape("rect", { fill: "#ffffff", fillAlpha: 1 });
    scene.add(track.mesh, fill.mesh, num.mesh, tot.mesh);
    return { scene, num, tot, track, fill, key: "", t: 1, prog: 0, ink: [1, 1, 1], a: 1 };
  }
  function drawHud(dt) {
    if (!hud) return;
    Deck.frameId++;
    const rt = R[cur], toRt = trans ? trans.to : rt;
    const show = trans && trans.p > 0.5 ? toRt : rt;
    const idx = show.i;
    const key = String(idx + 1).padStart(2, "0");
    if (key !== hud.key) { hud.key = key; hud.num.set(key); hud.t = 0; }
    hud.t = Math.min(1, hud.t + dt * 1.6);
    const target = (() => {
      const total = R.reduce((a, r) => a + r.def.beats.length, 0);
      const done = R.slice(0, toRt.i).reduce((a, r) => a + r.def.beats.length, 0) + toRt.s.beat + 1;
      return done / total;
    })();
    hud.prog = damp(hud.prog, target, 6, dt);
    const ink = Deck.util.hex((typeof show.def.ink === "function" ? show.def.ink(show.s) : show.def.ink) || "#ffffff");
    hud.ink = hud.ink.map((c, i) => damp(c, ink[i], 8, dt));
    hud.a = damp(hud.a, chrome ? 1 : 0, 8, dt);
    const v = g.view, [ir, ig, ib] = hud.ink;
    const a = hud.a * (1 - black);
    if (a < 0.01) return;
    hud.tot.set(` / ${String(R.length).padStart(2, "0")}`);
    const x = v.x1 - 56 - hud.tot.width, y = v.y1 - 50;
    const tint = (gl, o) => { o.r = ir; o.g = ig; o.b = ib; };
    hud.num.at(x, y); hud.num.alpha = 0.62 * a;
    hud.num.animate((gl, o) => { const e = ease.out4(clamp(hud.t * 1.8 - gl.n * 0.18)); o.dy = (1 - e) * 22; o.clip = 1; tint(gl, o); });
    hud.tot.at(x, y); hud.tot.alpha = 0.38 * a; hud.tot.animate(tint);
    const u1 = hud.track.mat.uniforms.uFill.value, u2 = hud.fill.mat.uniforms.uFill.value;
    u1.set(ir, ig, ib, 1); u2.set(ir, ig, ib, 1);
    hud.track.rect(v.x0, v.y1 - 3, v.w, 3).alpha(0.1 * a);
    hud.fill.rect(v.x0, v.y1 - 3, v.w * hud.prog, 3).alpha(0.42 * a);
    g.r.setRenderTarget(null);
    g.r.render(hud.scene, g.ortho);
  }

  // ── 전환 ──────────────────────────────────────────────────────────
  const tpass = {};
  function transPass(name) {
    const d = transitions[name] || transitions.fade;
    if (!tpass[name]) tpass[name] = g.pass(d.frag, { tA: null, tB: null, uP: 0, uDir: 1, uAspect: 16 / 9 });
    return tpass[name];
  }

  // ── 스냅숏: 다른 장면의 마지막 모습을 텍스처로 (마지막 장면이 발표 전체를 되돌아볼 때 쓴다) ──
  Deck.snapshots = {};
  let snapsBusy = null;
  async function buildSnapshots(except) {
    if (snapsBusy) return snapsBusy;
    snapsBusy = (async () => {
      for (const rt of R) {
        if (rt.def.id === except || Deck.snapshots[rt.def.id]) continue;
        await ensure(rt); g.park(rt, false);
        const save = { beat: rt.s.beat, clocks: rt.s.clocks.slice(), time: rt.s.time, enter: rt.s.enter, exit: rt.s.exit };
        settle(rt, rt.s.n - 1);
        const tgt = g.target({ hdr: false, w: 640, h: 360 });
        tgt.texture.generateMipmaps = false;
        g.with169(() => paint(rt, tgt, false));
        Object.assign(rt.s, { beat: save.beat, time: save.time, enter: save.enter, exit: save.exit }); rt.s.clocks.set(save.clocks);
        Deck.snapshots[rt.def.id] = tgt.texture;
        if (Math.abs(rt.i - cur) > 1) g.park(rt, true);
      }
    })();
    return snapsBusy;
  }

  // ── 이동 ──────────────────────────────────────────────────────────
  function syncMood(rt) { if (window.Snd) window.Snd.setMood(rt.def.mood ?? 0.4, rt.def.id); }
  function finishTrans() {
    if (!trans) return;
    trans.from.s.exit = 0; trans.to.s.enter = 1;
    cur = trans.to.i; trans = null;
    parkFar(); syncUI();
  }
  function parkFar() {
    R.forEach((rt, i) => { if (rt.inst) g.park(rt, Math.abs(i - cur) > 1 && !(trans && (trans.from === rt || trans.to === rt))); });
  }
  async function goScene(i, { dir = 1, beat = 0, fromEnd = false, instant = false } = {}) {
    i = clamp(i, 0, R.length - 1);
    const to = R[i];
    await ensure(to);
    if (to.def.snapshots) await buildSnapshots(to.def.id);
    g.park(to, false);
    to.edges = {};
    if (fromEnd) settle(to, clamp(beat, 0, to.s.n - 1));
    else { reset(to); if (beat > 0) { settle(to, beat - 1); to.s.beat = beat; to.s.clocks[beat] = 0; to.s.time = 0; } }
    suppress = true;
    if (instant || i === cur && !trans) {
      trans = null; cur = i;
    } else {
      if (trans) finishTrans();
      const name = dir > 0 ? to.def.transition || "fade" : R[cur].def.transition || "fade";
      const d = transitions[name] || transitions.fade;
      trans = { from: R[cur], to, name, t: 0, p: 0, dur: (d.dur || 1) * (dir > 0 ? 1 : 0.7), dir, speed: 1 };
      sfx("whoosh", { up: dir > 0, dur: Math.min(1.2, trans.dur * 0.9) });
    }
    syncMood(to);
    parkFar();
    syncUI();
    beatTimer = 0;
  }
  function next() {
    if (trans) { trans.speed = 4; return; }
    const rt = R[cur], s = rt.s;
    if (s.beat < s.n - 1) { s.beat++; s.clocks[s.beat] = Math.max(0, s.clocks[s.beat]); s.dir = 1; suppressBeat(); syncUI(); beatTimer = 0; }
    else if (cur < R.length - 1) goScene(cur + 1, { dir: 1 });
  }
  function prev() {
    if (trans) { trans.speed = 4; return; }
    const rt = R[cur], s = rt.s;
    if (s.beat > 0) { s.beat--; s.dir = -1; syncUI(); beatTimer = 0; }
    else if (cur > 0) goScene(cur - 1, { dir: -1, beat: R[cur - 1].def.beats.length - 1, fromEnd: true });
  }
  function suppressBeat() { /* 같은 장면 안에서는 소리를 막지 않는다 */ }

  // ── 화면 UI (노트 · 전체 보기 · 도움말 · 알림) ───────────────────────
  const $ = (id) => document.getElementById(id);
  let ui = {};
  function fmtTime(sec) { sec = Math.max(0, Math.floor(sec)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`; }
  function syncUI() {
    const rt = trans ? trans.to : R[cur];
    if (!rt) return;
    const s = rt.s;
    ui.noteText.textContent = rt.def.beats[s.beat].note || "";
    ui.noteMeta.innerHTML = `${rt.def.title}<br>${rt.i + 1}.${s.beat + 1} · ${s.beat + 1}/${s.n}<br><span id="note-clock">${fmtTime(startedAt ? (performance.now() - startedAt) / 1000 : 0)}</span>`;
    const hash = `#/${rt.i + 1}/${s.beat + 1}`;
    if (location.hash !== hash) history.replaceState(null, "", hash);
    syncPresenter(rt);
    ui.over.querySelectorAll("button").forEach((b, i) => b.setAttribute("aria-current", String(i === rt.i)));
  }
  // ── 발표자 창 (W): 두 번째 화면에 노트 · 다음 내용 · 경과 시간 ──────────────
  let pw = null;
  function nextNote(rt) {
    const s = rt.s;
    if (s.beat < s.n - 1) return rt.def.beats[s.beat + 1].note || "";
    const nx = R[rt.i + 1];
    return nx ? `[${nx.def.title}] ${nx.def.beats[0].note || ""}` : "(끝)";
  }
  function syncPresenter(rt) {
    if (!pw || pw.closed) return;
    const d = pw.document, s = rt.s;
    d.getElementById("t").textContent = `${rt.i + 1}. ${rt.def.title}  ·  ${s.beat + 1}/${s.n}`;
    d.getElementById("n").textContent = rt.def.beats[s.beat].note || "";
    d.getElementById("x").textContent = nextNote(rt);
  }
  function openPresenter() {
    if (pw && !pw.closed) { pw.focus(); return; }
    pw = window.open("", "vibe-presenter", "width=1000,height=680");
    if (!pw) { toast("팝업이 막혀 있습니다 — 주소창에서 팝업을 허용해 주세요"); return; }
    const d = pw.document;
    d.title = "발표자 노트 — 바이브 코딩";
    d.body.innerHTML = `<style>
      body{margin:0;background:#0b0d12;color:#eef1f7;font:26px/1.6 "Pretendard Variable","Apple SD Gothic Neo",system-ui,sans-serif;display:grid;grid-template-rows:auto 1fr auto;height:100vh}
      header{display:flex;justify-content:space-between;align-items:baseline;padding:22px 32px;border-bottom:1px solid #1f2430;color:#98a0b3;font-size:18px}
      #c{font:500 40px "Geist Mono",ui-monospace,monospace;color:#fff}
      main{padding:28px 32px;overflow:auto;white-space:pre-line}
      footer{padding:18px 32px 26px;border-top:1px solid #1f2430;color:#7d8497;font-size:19px;white-space:pre-line}
      footer b{color:#a9b2ff;font-weight:500;margin-right:10px}
    </style><header><span id="t"></span><span id="c">0:00</span></header><main id="n"></main><footer><b>다음</b><span id="x"></span></footer>`;
    d.addEventListener("keydown", onKey);
    syncUI();
  }

  let toastTimer = 0, quietToast = false;
  function toast(msg) {
    if (quietToast) return;
    ui.toast.textContent = msg; ui.toast.hidden = false; ui.toast.classList.remove("out");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { ui.toast.classList.add("out"); toastTimer = setTimeout(() => (ui.toast.hidden = true), 400); }, 1400);
  }
  const thumbs = [];
  async function buildOverview() {
    ui.over.textContent = "";
    const grid = document.createElement("div"); grid.className = "grid";
    ui.over.append(grid);
    for (let i = 0; i < R.length; i++) {
      const rt = R[i];
      const b = document.createElement("button");
      const cv = thumbs[i] || document.createElement("canvas");
      cv.width = 480; cv.height = 270;
      const label = document.createElement("span");
      label.innerHTML = `<i>${String(i + 1).padStart(2, "0")}</i>${rt.def.title}`;
      b.append(cv, label);
      b.addEventListener("click", () => { toggleOverview(false); if (i !== cur) goScene(i, { dir: i > cur ? 1 : -1 }); });
      grid.append(b);
      if (!thumbs[i]) {
        thumbs[i] = cv;
        await ensure(rt); g.park(rt, false);
        const save = { beat: rt.s.beat, clocks: rt.s.clocks.slice(), time: rt.s.time };
        settle(rt, rt.s.n - 1);
        g.with169(() => paint(rt, thumbT, false));
        g.toCanvas(thumbT, cv);
        rt.s.beat = save.beat; rt.s.clocks.set(save.clocks); rt.s.time = save.time;
        if (Math.abs(i - cur) > 1) g.park(rt, true);
      }
    }
    syncUI();
  }
  function toggleOverview(force) {
    const show = force ?? ui.over.hidden;
    ui.over.hidden = !show;
    if (show) buildOverview().then(() => ui.over.querySelector('[aria-current="true"]')?.focus());
    else g.r.domElement.focus();
  }
  function startSound() {
    if (window.Snd && !window.Snd.started) {
      window.Snd.start(); syncMood(R[cur]);
      toast("소리 켬 · M 음소거 · B 배경음악");
    }
  }

  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // 입력창(예: 실시간 Q&A 질문 칸)에 글자를 칠 때는 발표 조작으로 받지 않는다
    const tg = e.target;
    if (tg && (tg.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName))) return;
    const k = e.key;
    startSound();
    if (!startedAt) startedAt = performance.now();
    if (k === "m" || k === "M") { if (window.Snd) toast(window.Snd.toggleMute() ? "음소거" : "소리 켬"); e.preventDefault(); return; }
    if (k === "b" || k === "B") { if (window.Snd) toast(window.Snd.toggleMusic() ? "배경음악 켬" : "배경음악 끔"); e.preventDefault(); return; }
    if (!ui.over.hidden) { if (k === "Escape" || k === "o" || k === "O") { toggleOverview(false); e.preventDefault(); } return; }
    if (["ArrowRight", "ArrowDown", " ", "PageDown", "Enter"].includes(k)) { if (!e.repeat) next(); }
    else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(k)) { if (!e.repeat) prev(); }
    else if (k === "Home") goScene(0, { instant: true });
    else if (k === "End") goScene(R.length - 1, { instant: true, beat: R[R.length - 1].def.beats.length - 1, fromEnd: true });
    else if (k === "n" || k === "N") ui.notes.hidden = !ui.notes.hidden;
    else if (k === "w" || k === "W") openPresenter();
    else if (k === "o" || k === "O" || k === "Escape") { if (!ui.help.hidden && k === "Escape") ui.help.hidden = true; else toggleOverview(true); }
    else if (k === "f" || k === "F") document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.().catch(() => {});
    else if (k === "p" || k === "P") { chrome = !chrome; toast(chrome ? "진행 표시 켬" : "진행 표시 끔"); }
    else if (k === "a" || k === "A") { auto = !auto; beatTimer = 0; toast(auto ? "자동 진행" : "수동 진행"); }
    else if (k === "." ) { blackTarget = blackTarget ? 0 : 1; }
    else if (k === "?" || k === "h" || k === "H") ui.help.hidden = !ui.help.hidden;
    else return;
    e.preventDefault();
  }

  function bindInput() {
    const cv = g.r.domElement;
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    let downX = 0, downY = 0, downT = 0;
    cv.addEventListener("pointerdown", (e) => { startSound(); if (!startedAt) startedAt = performance.now(); downX = e.clientX; downY = e.clientY; downT = performance.now(); });
    cv.addEventListener("pointerup", (e) => {
      const dx = e.clientX - downX, dy = e.clientY - downY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) return dx < 0 ? next() : prev();
      if (performance.now() - downT > 600 || Math.hypot(dx, dy) > 10) return;
      e.clientX < window.innerWidth * 0.25 ? prev() : next();
    });
    cv.addEventListener("contextmenu", (e) => { e.preventDefault(); prev(); });
    let idle = 0;
    window.addEventListener("pointermove", (e) => {
      mouse.tx = (e.clientX / window.innerWidth) * 2 - 1; mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
      document.body.classList.remove("idle");
      clearTimeout(idle); idle = setTimeout(() => document.body.classList.add("idle"), 2200);
    });
    window.addEventListener("hashchange", fromHash);
  }
  function fromHash() {
    const m = location.hash.match(/^#\/(\d+)(?:\/(\d+))?/);
    if (!m) return false;
    const i = clamp(+m[1] - 1, 0, R.length - 1), b = (+m[2] || 1) - 1;
    const rt = trans ? trans.to : R[cur];
    if (rt && rt.i === i && rt.s.beat === b && rt.inst) return true;
    goScene(i, { instant: true, beat: b, fromEnd: true });
    return true;
  }

  // ── 크기 · 품질 ───────────────────────────────────────────────────
  const params = new URLSearchParams(location.search);
  let qi = params.has("q") ? -1 : 0;
  function onResize() {
    const dpr = +(params.get("dpr") || Math.min(window.devicePixelRatio || 1, 2));
    g.resize(window.innerWidth, window.innerHeight, dpr);
    Deck.text.refresh();
    for (const rt of R) if (rt.inst && rt.inst.resize) rt.inst.resize();
  }
  let ema = 16, slowFor = 0, fastFor = 0, settleFor = 0;
  function adapt(ms) {
    if (qi < 0 || document.hidden || ms > 250) return;
    ema = ema * 0.92 + ms * 0.08;
    settleFor += ms;
    if (settleFor < 1500) return;
    if (ema > 22) { slowFor += ms; fastFor = 0; } else if (ema < 13.5) { fastFor += ms; slowFor = 0; } else { slowFor = Math.max(0, slowFor - ms); fastFor = Math.max(0, fastFor - ms); }
    if (slowFor > 900 && qi < QUALITY.length - 1) { qi++; g.setQuality(QUALITY[qi]); slowFor = 0; settleFor = 0; ema = 15; }
    else if (fastFor > 8000 && qi > 0) { qi--; g.setQuality(QUALITY[qi]); fastFor = 0; settleFor = 0; }
  }

  // ── 루프 ──────────────────────────────────────────────────────────
  let beatTimer = 0;
  let paused = false;
  function frame(now) {
    requestAnimationFrame(frame);
    if (paused) { lastNow = now; return; }
    const ms = lastNow ? now - lastNow : 16; lastNow = now;
    const dt = Math.min(0.05, Math.max(0, ms / 1000));
    clock += dt;
    adapt(ms);
    mouse.x = damp(mouse.x, mouse.tx, 3, dt); mouse.y = damp(mouse.y, mouse.ty, 3, dt);
    black = damp(black, blackTarget, 7, dt);

    let out;
    if (trans) {
      trans.t += dt * trans.speed;
      trans.p = clamp(trans.t / trans.dur);
      step(trans.from, dt); step(trans.to, dt);
      trans.from.s.exit = trans.p; trans.to.s.enter = trans.p;
      const pa = paint(trans.from, ldrA, false);
      const pb = paint(trans.to, ldrB, true);
      suppress = false;
      const tp = transPass(trans.name);
      tp.u.tA.value = ldrA.texture; tp.u.tB.value = ldrB.texture;
      tp.u.uP.value = trans.p; tp.u.uDir.value = trans.dir; tp.u.uAspect.value = g.W / g.H;
      tp.render(ldrT);
      out = ldrT;
      g.present(out, { grain: lerp(pa.grain ?? 0.035, pb.grain ?? 0.035, trans.p), black, time: clock });
      if (trans.p >= 1) finishTrans();
    } else {
      const rt = R[cur];
      step(rt, dt);
      const p = paint(rt, ldrA, true);
      suppress = false;
      g.present(ldrA, { grain: p.grain ?? 0.035, black, time: clock });
      if (auto) {
        beatTimer += dt;
        const b = rt.def.beats[rt.s.beat];
        if (beatTimer > (b.dur ?? 3) + (b.hold ?? 2.5)) { beatTimer = 0; if (cur === R.length - 1 && rt.s.beat === rt.s.n - 1) auto = false; else next(); }
      }
    }
    drawHud(dt);
    const clk = document.getElementById("note-clock");
    const el = startedAt ? fmtTime((performance.now() - startedAt) / 1000) : "0:00";
    if (clk && !ui.notes.hidden) clk.textContent = el;
    if (pw && !pw.closed) { const c = pw.document.getElementById("c"); if (c && c.textContent !== el) c.textContent = el; }
  }

  // ── 시작 ──────────────────────────────────────────────────────────
  async function start() {
    const canvas = $("stage");
    ui = { notes: $("notes"), noteText: $("note-text"), noteMeta: $("note-meta"), over: $("over"), help: $("help"), toast: $("toast"), load: $("load"), bar: $("load-bar") };
    try {
      g = Deck.createGfx(canvas);
    } catch (e) {
      console.error(e);
      ui.load.innerHTML = "<p>이 발표는 WebGL 2가 필요합니다. 최신 Chrome · Edge · Safari · Firefox에서 열어 주세요.</p>";
      return;
    }
    Deck.gfx = g;
    if (params.get("q")) g.q = clamp(+params.get("q"), 0.3, 1.5);
    Deck.text.bind(() => g.ppu, () => [g.W, g.H]);
    Deck.shapes.bind(() => g.ppu);
    onResize();
    hdr = g.target({ hdr: true, depth: true, samples: 4 });
    ldrA = g.target({ hdr: false }); ldrB = g.target({ hdr: false }); ldrT = g.target({ hdr: false });
    thumbT = g.target({ hdr: false, w: 960, h: 540 });

    try {
      await Promise.race([
        Promise.all([200, 300, 400, 500, 600, 700, 800].map((w) => document.fonts.load(`${w} 64px "Pretendard Variable"`, "가A"))
          .concat([document.fonts.load(`500 32px "Geist Mono"`, "A0")])),
        new Promise((r) => setTimeout(r, 4000)),
      ]);
    } catch {}

    R = scenes.map((def, i) => {
      const bl = lin(def.bg || "#000000");
      const rt = { def, i, inst: null, edges: {}, bgColor: new T.Color(bl[0], bl[1], bl[2]) };
      rt.s = makeState(rt);
      return rt;
    });
    hud = makeHud();

    // 셰이더를 미리 컴파일해서 첫 전환 때 끊기지 않게 한다
    const quick = params.has("quick");
    const hashIdx = (() => { const m = location.hash.match(/^#\/(\d+)/); return m ? clamp(+m[1] - 1, 0, R.length - 1) : 0; })();
    const order = quick ? [hashIdx] : R.map((_, i) => i);
    for (let n = 0; n < order.length; n++) {
      const rt = R[order[n]];
      await ensure(rt);
      for (let b = 0; b < rt.s.n; b++) {
        settle(rt, b); rt.s.clocks[b] = (rt.def.beats[b].dur ?? 3) * 0.5; paint(rt, ldrA, false);
        settle(rt, b); paint(rt, ldrA, false);
      }
      reset(rt);
      if (ui.bar) ui.bar.style.transform = `scaleX(${(n + 1) / order.length})`;
      g.gl.finish();
      await new Promise((r) => requestAnimationFrame(r));
      if (Math.abs(order[n] - hashIdx) > 1) g.park(rt, true);
    }
    if (!quick) for (const name in transitions) { const tp = transPass(name); tp.u.tA.value = ldrA.texture; tp.u.tB.value = ldrB.texture; tp.render(ldrT); }
    const snapFor = R.find((rt) => rt.def.snapshots);
    if (!quick && snapFor) { await buildSnapshots(snapFor.def.id); for (const rt of R) if (Math.abs(rt.i - hashIdx) > 1) g.park(rt, true); }

    bindInput();
    if (!fromHash()) await goScene(0, { instant: true });
    else await new Promise((r) => setTimeout(r, 0));
    await ensure(R[cur]);
    ui.load.classList.add("done");
    setTimeout(() => ui.load.remove(), 900);
    canvas.focus();
    requestAnimationFrame(frame);
    setTimeout(() => { if (window.Snd && !window.Snd.started) toast("아무 키나 누르면 소리가 켜집니다"); }, 1200);
    // 시험용: 원하는 장면·비트·시각을 멈춘 화면으로 그린다 (headless 스크린샷)
    const freeze = (post) => { g.present(ldrA, { grain: post.grain ?? 0.035, black: 0, time: clock }); drawHud(1); };
    window.__deck = {
      R, go: goScene, next, prev, get cur() { return cur; }, get trans() { return trans; }, settle, paint, g,
      pause(v = true) { paused = v; },
      async seek(i, beat = 0, t = 999, time = 12) {
        document.getElementById("load")?.remove(); ui.toast.hidden = true; clearTimeout(toastTimer); quietToast = true;
        paused = true; trans = null; cur = i;
        const rt = R[i]; await ensure(rt);
        if (rt.def.snapshots) await buildSnapshots(rt.def.id);
        g.park(rt, false);
        settle(rt, beat); rt.s.clocks[beat] = t; rt.s.time = time;
        const post = paint(rt, ldrA, false);
        freeze(post); syncUI();
        return post;
      },
      async seekTrans(i, p, time = 12) {
        document.getElementById("load")?.remove(); ui.toast.hidden = true; clearTimeout(toastTimer); quietToast = true;
        paused = true;
        const a = R[i - 1], b = R[i]; await ensure(a); await ensure(b);
        if (b.def.snapshots) await buildSnapshots(b.def.id);
        g.park(a, false); g.park(b, false);
        settle(a, a.s.n - 1); a.s.time = time; reset(b); b.s.time = p * 1.2; b.s.clocks[0] = p * 1.2;
        a.s.exit = p; b.s.enter = p;
        const pa = paint(a, ldrA, false), pb = paint(b, ldrB, false);
        const name = b.def.transition || "fade", tp = transPass(name);
        tp.u.tA.value = ldrA.texture; tp.u.tB.value = ldrB.texture; tp.u.uP.value = p; tp.u.uDir.value = 1; tp.u.uAspect.value = g.W / g.H;
        tp.render(ldrT);
        g.present(ldrT, { grain: 0.035, black: 0, time: clock }); cur = i; drawHud(1); cur = i;
      },
      async perf(i, beat = 0, n = 30) {
        const rt = R[i]; await ensure(rt);
        if (rt.def.snapshots) await buildSnapshots(rt.def.id);
        g.park(rt, false); settle(rt, beat);
        const px = new Uint8Array(4);
        const sync = () => g.r.readRenderTargetPixels(ldrA, 0, 0, 1, 1, px); // GPU가 끝날 때까지 기다리게 한다
        paint(rt, ldrA, false); sync();
        const t0 = performance.now();
        for (let k = 0; k < n; k++) { rt.s.time += 1 / 60; paint(rt, ldrA, false); g.present(ldrA, {}); sync(); }
        return (performance.now() - t0) / n;
      },
    };
  }

  Deck.start = start;
  Deck.go = (i, o) => goScene(i, o);
  Deck.next = () => next();
  Deck.prev = () => prev();
})();
