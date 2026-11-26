// 04 · 실험이 공짜가 되면
// 밝은 스튜디오 벽. 비트 1: 커서가 시제품 한 장을 한 요소씩 공들여 만든다.
// 비트 2: 카메라가 물러나며 그 카드에서 변형 시안 수십 장이 쏟아져 나와 벽면 격자에 붙는다.
// 비트 3: 나머지는 어두워지고, 커서가 하나를 눌러 고르면 그 카드가 조명 아래로 떠오르고 선택 상자가 감싼다.
(() => {
  const { TAU, clamp, lerp, ease, prog, rng, hash } = Deck.util;
  const INK = "#16171c", MUTED = "#6d707b", ACCENT = "#3a49ee";
  const COLS = 9, ROWS = 5, CW = 176, CH = 110, GX = 22, GY = 22, N = COLS * ROWS;
  const HERO = 22, PICK = 15;                     // 가운데 칸 / 오른쪽 위 칸
  const GRID_Y = -100;                             // 격자 중심 (벽 좌표, 화면 y=640)
  const D = 540 / Math.tan((15 * Math.PI) / 180);  // 이 거리에서 벽 1단위 = 화면 1px
  const MW = 320, MH = 200;                        // 시안 그림의 설계 단위
  const cell = (i) => { const c = i % COLS, r = Math.floor(i / COLS); return [(c - (COLS - 1) / 2) * (CW + GX), GRID_Y + ((ROWS - 1) / 2 - r) * (CH + GY)]; };
  const gdist = (i, j) => Math.hypot((i % COLS) - (j % COLS), Math.floor(i / COLS) - Math.floor(j / COLS));

  // ── 시안(앱 화면) 그리기 ─────────────────────────────────────────────
  const F = (s, w = 500) => `${w} ${s}px "Pretendard Variable", Pretendard, "Apple SD Gothic Neo", sans-serif`;
  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  const box = (c, x, y, w, h, r, col) => { rr(c, x, y, w, h, r); c.fillStyle = col; c.fill(); };
  const bar = (c, x, y, w, h, col) => box(c, x, y, w, h, h / 2, col);
  const dot = (c, x, y, r, col) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = col; c.fill(); };
  const say = (c, str, x, y, size, weight, col, align = "left") => { c.font = F(size, weight); c.fillStyle = col; c.textAlign = align; c.textBaseline = "alphabetic"; c.fillText(str, x, y); };
  function pal(r, hue = Math.floor(r() * 360), dark = r() < 0.2) {
    const h2 = (hue + 25 + Math.floor(r() * 70)) % 360;
    return {
      hue, dark,
      bg: dark ? `hsl(${hue} 20% 10%)` : "#ffffff",
      panel: dark ? `hsl(${hue} 16% 15%)` : `hsl(${hue} 32% 97%)`,
      line: dark ? `hsl(${hue} 12% 24%)` : `hsl(${hue} 18% 90%)`,
      text: dark ? "#eceef5" : "#1b1e29",
      faint: dark ? `hsl(${hue} 10% 38%)` : `hsl(${hue} 10% 80%)`,
      mid: dark ? `hsl(${hue} 12% 55%)` : `hsl(${hue} 9% 56%)`,
      accent: `hsl(${hue} 74% ${dark ? 64 : 56}%)`,
      accent2: `hsl(${h2} 72% 62%)`,
      soft: dark ? `hsl(${hue} 40% 20%)` : `hsl(${hue} 85% 95%)`,
      img1: `hsl(${hue} 70% ${dark ? 45 : 62}%)`, img2: `hsl(${h2} 75% ${dark ? 30 : 76}%)`,
    };
  }
  function photo(c, x, y, w, h, rad, P, k = 0) {
    c.save(); rr(c, x, y, w, h, rad); c.clip();
    const g = c.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, P.img1); g.addColorStop(1, P.img2); c.fillStyle = g; c.fillRect(x, y, w, h);
    const ga = c.globalAlpha;
    c.globalAlpha = ga * 0.7; dot(c, x + w * (0.68 + 0.1 * Math.sin(k)), y + h * 0.3, h * 0.13, "rgba(255,255,255,.75)");
    c.globalAlpha = ga;
    c.fillStyle = "rgba(10,12,30,.16)"; c.beginPath(); c.moveTo(x, y + h);
    c.lineTo(x + w * 0.28, y + h * 0.48); c.lineTo(x + w * 0.5, y + h * 0.78); c.lineTo(x + w * 0.72, y + h * 0.55); c.lineTo(x + w, y + h * 0.88); c.lineTo(x + w, y + h); c.closePath(); c.fill();
    c.fillStyle = "rgba(10,12,30,.12)"; c.beginPath(); c.moveTo(x, y + h); c.lineTo(x + w * 0.45, y + h * 0.7); c.lineTo(x + w, y + h); c.closePath(); c.fill();
    c.restore();
  }
  // 요소별 등장(시제품을 쌓아 올릴 때): 투명도 + 살짝 올라오기
  const el = (c, A, k, fn) => { const a = A(k); if (a <= 0.001) return; c.save(); c.globalAlpha *= a; c.translate(0, (1 - a) * 6); fn(); c.restore(); };

  const T = {
    landing(c, P, r, A, real) {
      el(c, A, 0, () => { c.fillStyle = P.panel; c.fillRect(0, 0, MW, 26); c.fillStyle = P.line; c.fillRect(0, 26, MW, 0.8); dot(c, 16, 13, 5.5, P.accent);
        real ? say(c, real.brand, 26, 16.6, 8.6, 700, P.text) : bar(c, 26, 10.5, 30, 5, P.text); });
      el(c, A, 1, () => { if (real) { ["소개", "기능", "요금"].forEach((s, i) => say(c, s, 196 + i * 22, 16, 6.4, 500, P.mid)); }
        else [0, 1, 2].forEach((i) => bar(c, 190 + i * 26, 11, 18, 3.6, P.faint));
        box(c, 270, 6.5, 40, 13, 6.5, P.accent); real ? say(c, "시작", 290, 15.4, 6, 700, "#fff", "center") : bar(c, 280, 11.5, 20, 3, "rgba(255,255,255,.8)"); });
      el(c, A, 2, () => { if (real) { say(c, real.h1, 18, 62, 16.5, 700, P.text); say(c, real.h2, 18, 82, 16.5, 700, P.text); }
        else { bar(c, 18, 50, 128, 11, P.text); bar(c, 18, 66, 96, 11, P.text); } });
      el(c, A, 3, () => { real ? say(c, real.sub, 18, 98, 6.6, 400, P.mid) : (bar(c, 18, 88, 124, 4, P.faint), bar(c, 18, 96, 92, 4, P.faint)); });
      el(c, A, 4, () => { box(c, 18, 108, 66, 17, 8.5, P.accent); real ? say(c, real.cta, 51, 119, 6.2, 700, "#fff", "center") : bar(c, 30, 115, 40, 3.4, "rgba(255,255,255,.85)");
        rr(c, 90, 108, 46, 17, 8.5); c.strokeStyle = P.line; c.lineWidth = 1; c.stroke(); real ? say(c, "둘러보기", 113, 119, 6.2, 500, P.text, "center") : bar(c, 100, 115, 26, 3.4, P.faint); });
      el(c, A, 5, () => { photo(c, 170, 38, 134, 92, 9, P, 1); box(c, 182, 104, 62, 18, 5, P.bg); dot(c, 192, 113, 4.5, P.accent2); bar(c, 200, 109, 34, 3.4, P.text); bar(c, 200, 115, 22, 3, P.faint); });
      const feats = real ? real.feats : [];
      [0, 1, 2].forEach((k) => el(c, A, 6 + k, () => {
        const x = 18 + k * 98; box(c, x, 142, 88, 46, 7, P.panel);
        box(c, x + 8, 150, 11, 11, 3.5, k === 1 ? P.accent2 : P.accent);
        if (real) { say(c, feats[k], x + 8, 173, 7, 700, P.text); bar(c, x + 8, 177.5, 58, 3, P.faint); }
        else { bar(c, x + 8, 167, 44, 4.5, P.text); bar(c, x + 8, 176, 62, 3, P.faint); }
      }));
    },
    dashboard(c, P, r) {
      c.fillStyle = P.dark ? P.panel : `hsl(${P.hue} 34% 17%)`; c.fillRect(0, 0, 58, MH);
      dot(c, 17, 17, 6, P.accent);
      for (let k = 0; k < 5; k++) box(c, 12, 38 + k * 20, 34, 9, 3, k === 1 ? P.accent : "rgba(255,255,255,.14)");
      bar(c, 70, 12, 58, 6, P.text); box(c, 196, 8, 84, 13, 6.5, P.panel); dot(c, 300, 14.5, 6, P.accent2);
      for (let k = 0; k < 3; k++) {
        const x = 70 + k * 82; box(c, x, 30, 74, 40, 6, P.panel); bar(c, x + 8, 38, 28, 3.4, P.faint); bar(c, x + 8, 47, 40 - k * 6, 8, P.text);
        c.strokeStyle = k === 2 ? P.accent2 : P.accent; c.lineWidth = 1.4; c.beginPath();
        for (let j = 0; j < 7; j++) { const px = x + 44 + j * 4, py = 60 - r() * 9; j ? c.lineTo(px, py) : c.moveTo(px, py); } c.stroke();
      }
      box(c, 70, 78, 164, 112, 7, P.panel);
      c.fillStyle = P.line; for (let k = 0; k < 4; k++) c.fillRect(80, 98 + k * 22, 144, 0.7);
      const pts = []; let v = 0.5; for (let j = 0; j <= 12; j++) { v = clamp(v + (r() - 0.45) * 0.28, 0.1, 0.95); pts.push([80 + j * 12, 178 - v * 72]); }
      c.beginPath(); pts.forEach(([x, y], j) => (j ? c.lineTo(x, y) : c.moveTo(x, y))); c.lineTo(224, 180); c.lineTo(80, 180); c.closePath();
      const g = c.createLinearGradient(0, 100, 0, 180); g.addColorStop(0, P.accent); g.addColorStop(1, "rgba(255,255,255,0)"); c.globalAlpha *= 0.25; c.fillStyle = g; c.fill(); c.globalAlpha /= 0.25;
      c.beginPath(); pts.forEach(([x, y], j) => (j ? c.lineTo(x, y) : c.moveTo(x, y))); c.strokeStyle = P.accent; c.lineWidth = 2; c.stroke();
      box(c, 242, 78, 68, 112, 7, P.panel);
      c.lineWidth = 7; const a0 = -Math.PI / 2, f1 = 0.35 + r() * 0.3;
      c.strokeStyle = P.accent; c.beginPath(); c.arc(276, 116, 18, a0, a0 + TAU * f1); c.stroke();
      c.strokeStyle = P.accent2; c.beginPath(); c.arc(276, 116, 18, a0 + TAU * f1 + 0.15, a0 + TAU * 0.86); c.stroke();
      c.strokeStyle = P.line; c.beginPath(); c.arc(276, 116, 18, a0 + TAU * 0.88, a0 + TAU * 0.98); c.stroke();
      for (let k = 0; k < 3; k++) { dot(c, 254, 150 + k * 12, 2.6, [P.accent, P.accent2, P.faint][k]); bar(c, 260, 148 + k * 12, 34 - k * 6, 3.4, P.faint); }
    },
    gallery(c, P, r) {
      bar(c, 14, 11, 52, 7, P.text); [0, 1, 2].forEach((i) => box(c, 206 + i * 34, 9, 28, 11, 5.5, i ? P.panel : P.accent));
      for (let k = 0; k < 6; k++) {
        const x = 14 + (k % 3) * 100, y = 30 + Math.floor(k / 3) * 84;
        const Q = { ...P, img1: `hsl(${(P.hue + k * 34) % 360} 62% 64%)`, img2: `hsl(${(P.hue + k * 34 + 60) % 360} 70% 78%)` };
        photo(c, x, y, 92, 58, 6, Q, k);
        bar(c, x, y + 63, 54 - (k % 2) * 12, 4.5, P.text); bar(c, x, y + 71, 34, 3, P.faint);
      }
    },
    chat(c, P, r) {
      c.fillStyle = P.panel; c.fillRect(0, 0, MW, 28); dot(c, 18, 14, 7.5, P.accent2); bar(c, 31, 9, 46, 5, P.text); bar(c, 31, 17.5, 28, 3.2, P.faint);
      let y = 38;
      for (let k = 0; k < 6 && y < 150; k++) {
        const left = k % 2 === 0, w = 64 + r() * 110, h = r() < 0.35 ? 28 : 18;
        const x = left ? 14 : MW - 14 - w;
        box(c, x, y, w, h, 8, left ? P.panel : P.accent);
        const tc = left ? P.faint : "rgba(255,255,255,.7)";
        bar(c, x + 8, y + 7, w - 22, 3.4, tc); if (h > 20) bar(c, x + 8, y + 15, w * 0.5, 3.4, tc);
        y += h + 7;
      }
      box(c, 12, MH - 28, MW - 24, 18, 9, P.panel); bar(c, 22, MH - 21, 90, 3.6, P.faint); dot(c, MW - 22, MH - 19, 6.5, P.accent);
    },
    kanban(c, P, r) {
      bar(c, 12, 10, 60, 7, P.text); box(c, 252, 8, 56, 12, 6, P.accent);
      const tags = [P.accent, P.accent2, `hsl(${(P.hue + 160) % 360} 60% 60%)`];
      for (let k = 0; k < 3; k++) {
        const x = 12 + k * 102; box(c, x, 26, 94, 166, 8, P.panel); bar(c, x + 8, 34, 34, 4, P.mid);
        let y = 44; const n = 2 + Math.floor(r() * 3);
        for (let j = 0; j < n && y < 168; j++) {
          const h = 24 + Math.floor(r() * 18); box(c, x + 6, y, 82, h, 5, P.bg);
          bar(c, x + 11, y + 5, 18, 4.5, tags[Math.floor(r() * 3)]); bar(c, x + 11, y + 13, 62 - r() * 20, 3.4, P.text);
          if (h > 30) bar(c, x + 11, y + 20, 40, 3, P.faint);
          y += h + 6;
        }
      }
    },
    pricing(c, P, r) {
      bar(c, 108, 13, 104, 8, P.text); bar(c, 130, 26, 60, 4, P.faint);
      for (let k = 0; k < 3; k++) {
        const mid = k === 1, x = 22 + k * 94, y = mid ? 40 : 46, h = mid ? 148 : 140;
        box(c, x, y, 86, h, 9, mid ? P.accent : P.panel);
        const tc = mid ? "#fff" : P.text, fc = mid ? "rgba(255,255,255,.55)" : P.faint;
        bar(c, x + 10, y + 12, 26, 4, fc); bar(c, x + 10, y + 24, 44, 11, tc);
        for (let j = 0; j < 4; j++) { dot(c, x + 13, y + 52 + j * 13, 2.2, mid ? "#fff" : P.accent); bar(c, x + 19, y + 50 + j * 13, 46 - r() * 14, 3.4, fc); }
        box(c, x + 10, y + h - 24, 66, 13, 6.5, mid ? "#fff" : P.accent);
      }
    },
    article(c, P, r) {
      c.fillStyle = P.line; c.fillRect(0, 20, MW, 0.8); bar(c, 14, 8, 40, 6, P.text); [0, 1, 2].forEach((i) => bar(c, 214 + i * 30, 9, 22, 3.6, P.faint));
      photo(c, 14, 28, 198, 74, 7, P, 2);
      bar(c, 14, 110, 168, 9, P.text); bar(c, 14, 123, 118, 9, P.text);
      for (let k = 0; k < 5; k++) bar(c, 14, 141 + k * 9.5, 196 - r() * 48, 3.4, P.faint);
      box(c, 222, 28, 86, 162, 7, P.panel);
      for (let k = 0; k < 4; k++) { const y = 36 + k * 38; photo(c, 229, y, 26, 26, 5, { ...P, img1: `hsl(${(P.hue + k * 50) % 360} 60% 66%)` }, k); bar(c, 260, y + 5, 40, 3.6, P.text); bar(c, 260, y + 13, 28, 3, P.faint); }
    },
    mobile(c, P, r) {
      const g = c.createLinearGradient(0, 0, MW, MH); g.addColorStop(0, P.soft); g.addColorStop(1, P.dark ? P.bg : "#ffffff");
      c.fillStyle = g; c.fillRect(0, 0, MW, MH);
      bar(c, 18, 62, 74, 9, P.text); bar(c, 18, 76, 56, 9, P.text); bar(c, 18, 94, 70, 3.6, P.faint); bar(c, 18, 102, 54, 3.6, P.faint);
      box(c, 18, 116, 46, 14, 7, P.accent);
      c.save(); c.shadowColor = "rgba(20,20,50,.18)"; c.shadowBlur = 10; c.shadowOffsetY = 4; box(c, 118, 10, 98, 182, 15, P.dark ? P.panel : "#fff"); c.restore();
      bar(c, 152, 16, 30, 4, P.line);
      bar(c, 128, 30, 50, 6, P.text);
      for (let k = 0; k < 5; k++) { const y = 46 + k * 24; dot(c, 134, y + 7, 7, [P.accent, P.accent2, P.faint][k % 3]); bar(c, 146, y + 2, 50 - r() * 16, 4, P.text); bar(c, 146, y + 9, 34, 3, P.faint); }
      c.fillStyle = P.line; c.fillRect(124, 170, 86, 0.8);
      for (let k = 0; k < 4; k++) box(c, 132 + k * 20, 177, 9, 9, 3, k === 0 ? P.accent : P.faint);
      box(c, 236, 40, 70, 46, 8, P.dark ? P.panel : "#fff"); bar(c, 244, 50, 34, 4, P.faint); bar(c, 244, 60, 46, 8, P.text);
      box(c, 236, 96, 70, 30, 8, P.accent2);
    },
  };
  const KINDS = ["dashboard", "gallery", "landing", "chat", "kanban", "pricing", "article", "mobile"];

  // 카드 하나 그리기 (설계 단위 320×200을 w×h 픽셀에)
  function drawCard(c, w, h, i, A = () => 1) {
    const r = rng(1000 + i * 7);
    let P, kind, real = null;
    if (i === HERO) { P = pal(r, 236, false); kind = "landing"; real = { brand: "바이브", h1: "생각을 바로", h2: "화면으로", sub: "말로 설명하면, 바로 만들어집니다.", cta: "무료로 시작하기", feats: ["빠르게", "함께", "안전하게"] }; }
    else if (i === PICK) { P = pal(r, 168, false); P.accent = "hsl(168 62% 40%)"; P.accent2 = "hsl(36 92% 60%)"; P.img1 = "hsl(176 55% 52%)"; P.img2 = "hsl(42 90% 76%)"; P.panel = "hsl(168 30% 96%)"; kind = "landing"; real = { brand: "말하면", h1: "말하면,", h2: "만들어진다", sub: "한 줄로 시작하는 나만의 도구.", cta: "지금 만들기", feats: ["한 줄", "바로", "고르기"] }; }
    else { P = pal(r); kind = KINDS[(i * 5 + Math.floor(hash(i) * 3)) % KINDS.length]; }
    c.save(); c.scale(w / MW, h / MH);
    c.fillStyle = P.bg; c.fillRect(0, 0, MW, MH);
    T[kind](c, P, r, A, real);
    c.restore();
  }

  // ── 셰이더 ─────────────────────────────────────────────────────────
  const LIGHT = /* glsl */ `
uniform vec2 uSpotC; uniform float uSpot, uSpotR, uDimAll;
vec3 lightAt(vec2 w){
  float key=.93+.14*smoothstep(900.,-900.,w.x*.6-w.y*.8);
  float fall=1.-.13*smoothstep(600.,1900.,length(w-vec2(-320.,260.)));
  vec3 c=vec3(1.,.988,.962)*key*fall;
  c*=1.-uDimAll*.30;
  vec2 d=w-uSpotC; float sp=exp(-dot(d,d)/(uSpotR*uSpotR));
  c+=vec3(1.,.965,.9)*sp*uSpot*.62;
  return c;
}
float sdR(vec2 p, vec2 b, float r){ vec2 q=abs(p)-b+r; return length(max(q,0.))+min(max(q.x,q.y),0.)-r; }`;

  Deck.scene({
    id: "experiments",
    title: "실험이 공짜가 되면",
    bg: "#e9e6df",
    ink: "#1a1a1f",
    mood: 0.6,
    transition: "flash",
    beats: [
      { dur: 4.4, note: "시제품 하나를 만드는 데도 시간이 꽤 들던 때에는, 신중하게 하나를 골라서 공들여 만들었습니다." },
      { dur: 3.4, note: "만드는 비용이 거의 사라지면 전략이 바뀝니다.\n여러 버전을 만들어 보고, 직접 써 보고, 고릅니다." },
      { dur: 3.0, note: "그러면 중요한 능력도 바뀝니다. 만드는 손보다, 무엇이 좋은지 알아보는 눈이 중요해집니다." },
    ],
    create(ctx) {
      const { T: THREE, g } = ctx;
      const sc = new THREE.Scene();
      const shared = { uSpotC: { value: new THREE.Vector2() }, uSpot: { value: 0 }, uSpotR: { value: 280 }, uDimAll: { value: 0 } };

      // 벽
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(40000, 24000), new THREE.ShaderMaterial({
        uniforms: { ...shared },
        vertexShader: "varying vec2 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xy; gl_Position=projectionMatrix*viewMatrix*w; }",
        fragmentShader: Deck.glsl.noise + LIGHT + /* glsl */ `
          varying vec2 vW;
          void main(){
            float n=fbm(vW*.0045), n2=vnoise(vW*.09), n3=vnoise(vW*.55);
            vec3 alb=vec3(.875,.862,.835)*(.985+.035*(n-.5)+.014*(n2-.5)+.008*(n3-.5));
            gl_FragColor=vec4(alb*lightAt(vW),1.);
          }`,
      }));
      wall.renderOrder = 0; sc.add(wall);

      // 시안 아틀라스 (작은 카드 45장) + 크게 보일 두 장은 따로 고해상도
      const TW = 384, TH = 240;
      const atlas = document.createElement("canvas"); atlas.width = TW * COLS; atlas.height = TH * ROWS;
      const ac = atlas.getContext("2d");
      for (let i = 0; i < N; i++) { ac.save(); ac.translate((i % COLS) * TW, Math.floor(i / COLS) * TH); drawCard(ac, TW, TH, i); ac.restore(); }
      const atlasTex = new THREE.CanvasTexture(atlas);
      Object.assign(atlasTex, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, anisotropy: 8 });
      atlasTex.colorSpace = THREE.SRGBColorSpace;
      const hiTex = (draw) => {
        const cv = document.createElement("canvas"); cv.width = 1024; cv.height = 640;
        const t = new THREE.CanvasTexture(cv); Object.assign(t, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, anisotropy: 8 }); t.colorSpace = THREE.SRGBColorSpace;
        return { cv, c: cv.getContext("2d"), t, key: null, draw };
      };
      const heroHi = hiTex((c, A) => drawCard(c, 1024, 640, HERO, A));
      const pickHi = hiTex((c) => drawCard(c, 1024, 640, PICK));
      pickHi.draw(pickHi.c); pickHi.t.needsUpdate = true;

      // 재질은 카드마다 새로 만든다(clone은 텍스처까지 복제해서 GPU에 아틀라스를 여러 번 올린다)
      const cardMat = (tex) => new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,   // 날아가며 기운 카드끼리 서로 파고들지 않게: 깊이 대신 거리순으로 겹친다
        uniforms: { ...shared, tMap: { value: tex }, uUv: { value: new THREE.Vector4(0, 0, 1, 1) }, uDim: { value: 0 }, uSat: { value: 1 }, uAlpha: { value: 1 }, uLift: { value: 0 }, uSize: { value: new THREE.Vector2(CW, CH) } },
        vertexShader: "varying vec2 vUv; varying vec2 vW; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.); vW=w.xy; gl_Position=projectionMatrix*viewMatrix*w; }",
        fragmentShader: LIGHT + /* glsl */ `
          uniform sampler2D tMap; uniform vec4 uUv; uniform float uDim, uSat, uAlpha, uLift; uniform vec2 uSize;
          varying vec2 vUv; varying vec2 vW;
          void main(){
            vec2 p=(vUv-.5)*uSize; float d=sdR(p, uSize*.5, 7.); float aa=max(fwidth(d),.05);
            float a=1.-smoothstep(-aa,aa,d);
            vec3 tex=texture2D(tMap, uUv.xy+vUv*uUv.zw).rgb;
            vec3 c=tex*lightAt(vW)*(1.+uLift*.05);
            c*=1.-.07*smoothstep(-3.*aa-1.2,-aa,d);
            float l=dot(c,vec3(.2126,.7152,.0722));
            c=mix(vec3(l),c,uSat)*(1.-uDim);
            gl_FragColor=vec4(c,a*uAlpha);
          }`,
      });
      const shadowMat = () => new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { uExt: { value: new THREE.Vector2(1, 1) }, uHalf: { value: new THREE.Vector2(CW / 2, CH / 2) }, uCast: { value: new THREE.Vector4() }, uContact: { value: 0.16 }, uAlpha: { value: 1 } },
        vertexShader: "uniform vec2 uExt; varying vec2 vP; void main(){ vP=position.xy*uExt; vec4 w=modelMatrix*vec4(vP,0.,1.); gl_Position=projectionMatrix*viewMatrix*w; }",
        fragmentShader: /* glsl */ `
          uniform vec2 uHalf; uniform vec4 uCast; uniform float uContact, uAlpha; varying vec2 vP;
          float sdR(vec2 p, vec2 b, float r){ vec2 q=abs(p)-b+r; return length(max(q,0.))+min(max(q.x,q.y),0.)-r; }
          void main(){
            float a1=uContact*(1.-smoothstep(-4.,8.,sdR(vP-vec2(0.,-2.5),uHalf,8.)));
            float a2=uCast.w*(1.-smoothstep(-uCast.z,uCast.z*1.4,sdR(vP-uCast.xy,uHalf,8.)));
            float a=1.-(1.-a1)*(1.-a2);
            gl_FragColor=vec4(vec3(.05,.04,.03),a*uAlpha);
          }`,
      });
      const geo = new THREE.PlaneGeometry(CW, CH), sgeo = new THREE.PlaneGeometry(1, 1);
      const cards = [];
      for (let i = 0; i < N; i++) {
        const m = new THREE.Mesh(geo, cardMat(i === HERO ? heroHi.t : i === PICK ? pickHi.t : atlasTex));
        const u = m.material.uniforms;
        if (i !== HERO && i !== PICK) u.uUv.value.set((i % COLS) / COLS, 1 - (Math.floor(i / COLS) + 1) / ROWS, 1 / COLS, 1 / ROWS);
        m.renderOrder = 2;
        const sh = new THREE.Mesh(sgeo, shadowMat()); sh.renderOrder = 1;
        sc.add(sh, m);
        cards.push({ m, sh, u, su: sh.material.uniforms });
      }
      const cam = ctx.camera(30, 10, 30000);

      // ── 겹레이어 ──
      const titles = ["하나를 공들여 만든다", "여러 개 만들어 보고 고른다", "고르는 눈이 실력이 된다"].map((t, i) =>
        ctx.text(t, { size: 96, weight: i === 2 ? 500 : 400, tracking: -0.035, color: i === 2 ? ACCENT : INK }));
      const cap = ctx.text("시제품 1개", { size: 26, weight: 500, family: "mono", color: MUTED, tracking: 0.02 });
      const cursor = ctx.panel(34, 46, { ppu: 3, draw(c) {
        c.save(); c.translate(3, 3);
        c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 30); c.lineTo(7.4, 23.6); c.lineTo(12.6, 35.4); c.lineTo(17.6, 33.2); c.lineTo(12.6, 21.8); c.lineTo(22.2, 21.8); c.closePath();
        c.shadowColor = "rgba(0,0,0,.28)"; c.shadowBlur = 5; c.shadowOffsetY = 2;
        c.fillStyle = "#111318"; c.fill(); c.shadowColor = "transparent"; c.lineWidth = 2.2; c.strokeStyle = "#ffffff"; c.lineJoin = "round"; c.stroke();
        c.restore();
      } });
      cursor.redraw("arrow");
      const ring = ctx.shape("circle", { fill: null, stroke: ACCENT, line: 2.5 });
      const sel = ctx.shape("select", { stroke: ACCENT, line: 2.4, handle: 8.5, knob: true, glow: 0.18, glowColor: ACCENT, glowRadius: 10 });

      // 시제품 쌓기 일정
      const EL = 9, elT = (k) => 0.6 + k * 0.36;
      const CLICK = [[16, 13], [290, 13], [72, 70], [84, 97], [51, 117], [236, 82], [62, 165], [160, 165], [258, 165]];
      const V = new THREE.Vector3();
      const toWorld = (i, u, v, xy, z) => V.set(xy[0] + (u / MW - 0.5) * CW, xy[1] + (0.5 - v / MH) * CH, z);

      return {
        render(s, hdr) {
          const a0 = s.at(0), a1 = s.at(1), a2 = s.at(2);
          // ── 카메라 ──
          const [hx, hy] = cell(HERO), [px, py] = cell(PICK);
          const pull = prog(a1, 0, 1.9, ease.inOut3);
          const push = prog(a2, 1.0, 2.2, ease.inOut3);
          const d0 = lerp(D * 0.235, D * 0.205, prog(a0, 0, 4.5, ease.out2));
          let cx = lerp(hx, 0, pull), cy = lerp(hy + 24, 0, pull), cz = lerp(d0, D, pull);
          cz = lerp(cz, D * 0.975, push);
          const drift = Math.sin(s.time * 0.21) * 5;
          cam.position.set(cx + s.mouse.x * 16 + drift, cy - s.mouse.y * 9, cz);
          cam.lookAt(cx + drift * 0.5, cy, 0);

          // ── 시제품 그리기 (요소가 바뀔 때만 다시 그림) ──
          const bt = Math.max(0, a0);
          const A = (k) => prog(bt, elT(k), 0.3, ease.out3);
          const hk = bt < elT(0) ? "e" : bt > elT(EL - 1) + 0.4 ? "f" : String(Math.round(bt * 40));
          if (hk !== heroHi.key) { heroHi.key = hk; heroHi.c.clearRect(0, 0, 1024, 640); heroHi.draw(heroHi.c, A); heroHi.t.needsUpdate = true; }

          // ── 카드 배치 ──
          const dim = prog(a2, 1.0, 1.2, ease.inOut2);
          const lift = prog(a2, 1.15, 1.25, ease.inOut3);
          let landed = 1;
          cards.forEach((C, i) => {
            const [x1, y1] = cell(i);
            let x = x1, y = y1, z = 3, rz = 0, ry = 0, rx = 0, k = 1, alpha = 1;
            if (i !== HERO) {
              const d = gdist(i, HERO), t0 = 0.5 + d * 0.11 + hash(i * 3.3) * 0.1, dur = 0.9;
              const q = prog(a1, t0, dur, ease.inOut3);
              if (a1 > t0 + dur) landed++;
              s.cue("land" + i, a1 > t0 + dur - 0.05, "tock", { vol: 0.05 });
              if (q <= 0) { C.m.visible = C.sh.visible = false; return; }
              // 처음 20%는 시제품 밑에서 미끄러져 나오고, 그다음 들려서 제자리로 날아간다
              const arc = Math.sin(Math.PI * clamp((q - 0.18) / 0.82));
              x = lerp(hx, x1, q); y = lerp(hy, y1, q) + arc * (16 + d * 5);
              z = lerp(1, 3, q) + arc * (60 + d * 24);
              k = lerp(0.9, 1, ease.out3(q));
              const land = Math.max(0, a1 - t0 - dur);
              const wob = Math.exp(-land * 5) * Math.sin(land * 17) * (a1 > t0 + dur ? 1 : 0);
              rz = (1 - q) * (hash(i * 7.1) - 0.5) * 0.5 + wob * 0.03 * (hash(i) - 0.5);
              ry = arc * (hash(i * 2.7) - 0.5) * 0.7 + wob * 0.05; rx = arc * (hash(i * 5.3) - 0.5) * 0.5 - wob * 0.04;
              alpha = clamp(q * 5);
            } else {
              alpha = prog(a0, 0, 0.5);
            }
            if (i === PICK) {
              x = lerp(x, 170, lift); y = lerp(y, -42, lift); z = lerp(z, 880, lift); k *= lerp(1, 1.22, lift);
              ry += Math.sin(s.time * 0.5) * 0.02 * lift; rx += Math.cos(s.time * 0.43) * 0.015 * lift;
            }
            C.m.visible = C.sh.visible = true;
            C.m.position.set(x, y, z); C.m.rotation.set(rx, ry, rz); C.m.scale.setScalar(k);
            const mine = i === PICK;
            if (!mine) k *= 1 - dim * 0.025;
            C.u.uDim.value = mine ? 0 : dim * 0.36; C.u.uSat.value = mine ? 1 : 1 - dim * 0.72;
            C.u.uAlpha.value = alpha; C.u.uLift.value = mine ? lift : 0;
            const zz = Math.max(0, z - 3);
            C.sh.position.set(x, y, 0.5); C.sh.rotation.set(0, 0, rz); C.sh.scale.setScalar(1);
            const off = [zz * 0.3, -zz * 0.42], blur = 6 + zz * 0.2;
            const half = [(CW * k) / 2, (CH * k) / 2];
            C.su.uHalf.value.set(...half);
            C.su.uCast.value.set(off[0], off[1], blur, 0.26 * clamp(1 - zz / 1500) * (mine ? 1 : 1 - dim * 0.4));
            C.su.uExt.value.set(2 * (half[0] + Math.abs(off[0]) + blur * 2.5 + 10), 2 * (half[1] + Math.abs(off[1]) + blur * 2.5 + 10));
            C.su.uContact.value = 0.17 * clamp(1 - zz / 40); C.su.uAlpha.value = alpha;
          });
          shared.uDimAll.value = dim;
          const pc = cards[PICK].m.position;
          shared.uSpotC.value.set(pc.x * 0.55, pc.y * 0.55); shared.uSpot.value = prog(a2, 1.2, 1.0, ease.out2); shared.uSpotR.value = 420;
          ctx.draw(sc, cam, hdr);

          // ── 제목 · 숫자 ──
          titles.forEach((t, i) => {
            const pin = s.p(i, 0.05, 1.0, ease.linear), pout = i < 2 ? s.p(i + 1, 0, 0.55, ease.linear) : 0;
            t.at(120, 178).show(pin, { style: "rise", stagger: 0.35, out: pout });
          });
          const count = s.beat >= 1 && a1 >= 0 ? landed : 1;
          s.ticks("count", count, "tick");
          const capStr = a2 >= 0.4 ? `시안 ${N}개 중 하나` : count > 1 ? `시안 ${String(count).padStart(2, "0")}개` : "시제품 1개";
          cap.set(capStr).at(124, 246).show(s.p(0, 0.5, 0.8, ease.linear), { style: "fade" });

          // ── 커서 · 클릭 ──
          const proj = (wx, wy, wz) => ctx.project(V.set(wx, wy, wz), cam);
          let cur = null, clickAt = -1, clickXY = null;
          if (s.beat === 0 || (a1 >= 0 && a1 < 0.6)) {
            // 요소를 하나씩 찍으며 쌓는다
            const t = bt;
            let k = 0; while (k < EL && t > elT(k) - 0.36) k++;
            const kk = Math.max(0, k - 1);
            const from = kk > 0 ? CLICK[kk - 1] : [MW + 60, MH + 40], to = CLICK[kk];
            const m = prog(t, elT(kk) - 0.34, 0.3, ease.inOut3);
            let u = lerp(from[0], to[0], m), v = lerp(from[1], to[1], m);
            const leave = prog(t, elT(EL - 1) + 0.3, 0.7, ease.inOut2) + prog(a1, 0, 0.5);
            u = lerp(u, MW + 90, clamp(leave)); v = lerp(v, MH + 60, clamp(leave));
            const w = toWorld(HERO, u, v, cell(HERO), 3);
            cur = { p: ctx.project(w, cam), a: prog(t, 0.2, 0.4) * (1 - clamp(leave)), press: 1 - 0.14 * Math.sin(Math.PI * clamp((t - elT(kk)) / 0.16)) * (t > elT(kk) ? 1 : 0) };
            const lastK = (() => { let j = -1; for (let q = 0; q < EL; q++) if (t >= elT(q)) j = q; return j; })();
            if (lastK >= 0 && t - elT(lastK) < 0.45) { clickAt = t - elT(lastK); clickXY = ctx.project(toWorld(HERO, CLICK[lastK][0], CLICK[lastK][1], cell(HERO), 3), cam); }
            for (let q = 0; q < EL; q++) s.cue("el" + q, t > elT(q), "click");
          } else if (s.beat === 2) {
            // 하나를 골라 누른다
            const pp = cards[PICK].m.position;
            const target = proj(pp.x + 18, pp.y - 10, pp.z);
            const start = [g.view.x1 - 220, g.view.y1 - 120];
            const m = prog(a2, 0.2, 0.75, ease.inOut3);
            const leave = prog(a2, 2.0, 0.6);
            const pt = [lerp(start[0], target[0], m), lerp(start[1], target[1], m)];
            cur = { p: pt, a: prog(a2, 0.1, 0.3) * (1 - leave), press: 1 - 0.14 * Math.sin(Math.PI * clamp((a2 - 0.95) / 0.16)) * (a2 > 0.95 ? 1 : 0) };
            if (a2 > 0.95 && a2 < 1.4) { clickAt = a2 - 0.95; clickXY = pt; }
            s.cue("pick", a2 > 0.95, "click");
            s.cue("pickc", a2 > 1.05, "ding", { note: 79 });
            s.cue("lift", a2 > 1.2, "whoosh", { up: true, dur: 0.7 });
          }
          if (cur && cur.a > 0.01) cursor.place(cur.p[0] - 3, cur.p[1] - 3, cur.press).alpha(cur.a); else cursor.alpha(0);
          if (clickXY && clickAt >= 0) { const q = clamp(clickAt / 0.42); ring.circle(clickXY[0], clickXY[1], 6 + 26 * ease.out3(q)).alpha((1 - q) * 0.8); } else ring.alpha(0);

          // ── 선택 상자 ──
          const sp = prog(a2, 0.95, 0.55, ease.linear);
          if (sp > 0) {
            const pp = cards[PICK].m;
            pp.updateMatrixWorld();
            let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
            for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
              V.set((u * CW) / 2, (v * CH) / 2, 0).applyMatrix4(pp.matrixWorld);
              const [qx, qy] = ctx.project(V, cam); x0 = Math.min(x0, qx); y0 = Math.min(y0, qy); x1 = Math.max(x1, qx); y1 = Math.max(y1, qy);
            }
            const pad = 9;
            sel.rect(x0 - pad, y0 - pad, x1 - x0 + pad * 2, y1 - y0 + pad * 2).appear(sp);
          } else sel.alpha(0);

          s.cue("pull", a1 > 0.05, "whoosh", { up: false, dur: 1.2 });
          return { tone: "none", exposure: 1.03, bloom: 0.08, threshold: 1.05, knee: 0.3, vignette: 0.14, grain: 0.022, contrast: 1.02, saturation: 1.02 };
        },
      };
    },
  });
})();
