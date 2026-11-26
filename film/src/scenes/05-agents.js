// 05 · 에이전트
// 비트 1: 어둠 속에 떠 있는 터미널 하나. 에이전트가 읽고, 고치고, 테스트하고, 실패하면 다시 고친다. 화면 빛이 검은 바닥에 번진다.
// 비트 2: 카메라가 물러나며, 둥글게 늘어선 터미널 열여덟 개가 차례로 켜진다. 각자 다른 일을 다른 속도로 한다.
// 비트 3: 벽 앞에 선 한 사람의 뒷모습. 터미널마다 결과가 빛줄기로 사람에게 모이고(받아들일지), 사람에게서 호박색 지시가 나간다(시킬지).
(() => {
  const { clamp, lerp, ease, prog, rng, noise, TAU } = Deck.util;
  const ACCENT = "#9aa6ff", AMBER = "#ffb46b", MUTED = "#a9b1cc";
  const RA = 9.5, COLS = 6, ROWS = 3, PW = 2.25, PH = 1.32, NT = COLS * ROWS;
  const HERO = 8;                         // 비트 1의 터미널 (가운데 줄, 왼쪽에서 셋째)
  const HEAD = [0.32, 1.42, -1.25];       // 사람 가슴 높이: 빛줄기가 모이는 곳
  const LINES = 12, VIS = 7;
  const LOG = [
    ["읽기", "src/app.ts"], ["검색", '"useAuth"'], ["수정", "hooks/useAuth.ts"], ["테스트", "12 통과 · 1 실패"],
    ["읽기", "tests/auth.test.ts"], ["수정", "hooks/useAuth.ts"], ["테스트", "13 통과"], ["빌드", "성공"],
    ["수정", "components/Login.tsx"], ["테스트", "13 통과"], ["정리", "변경 3개 파일"], ["완료", "검토를 기다리는 중"],
  ];
  const TASKS = [
    ["인증 버그 고치기", "hooks/useAuth.ts", "useAuth", "auth"], ["결제 테스트 추가", "billing/charge.ts", "charge", "charge"],
    ["검색 속도 개선", "search/index.ts", "rank", "search"], ["다크 모드", "theme/tokens.css", "--bg", "theme"],
    ["로그인 화면 다듬기", "ui/Login.tsx", "<Login", "login"], ["문서 정리", "docs/guide.md", "TODO", "links"],
    ["알림 기능", "notify/push.ts", "send(", "push"], ["이미지 압축", "media/resize.ts", "quality", "resize"],
    ["응답 캐시", "api/cache.ts", "ttl", "cache"], ["접근성 점검", "ui/Button.tsx", "aria-", "a11y"],
    ["로그 정리", "server/log.ts", "console.", "log"], ["설정 화면", "settings/Form.tsx", "onSubmit", "form"],
    ["CSV 내보내기", "export/csv.ts", "quote", "csv"], ["느린 쿼리 찾기", "db/orders.sql", "JOIN", "query"],
    ["번역 추가", "i18n/ko.json", "\"save\"", "i18n"], ["업로드 재시도", "upload/retry.ts", "backoff", "retry"],
    ["대시보드 차트", "charts/Line.tsx", "scale", "chart"], ["타입 오류 정리", "types/index.ts", "any", "types"],
  ];
  const VERB = { 읽기: "#8fa0ff", 검색: "#8fa0ff", 수정: "#5fd3c7", 빌드: "#ffc14d", 정리: "#b8a6ff", 완료: "#5ee0a0" };
  const verbColor = (v, obj) => (v === "테스트" ? (obj.includes("실패") ? "#ff7a6b" : "#5ee0a0") : VERB[v] || "#c9cfdd");

  function script(i, k) {
    if (i === HERO && k === 0) return { name: "인증 버그 고치기", lines: LOG };
    const tk = TASKS[(i * 5 + k * 7) % TASKS.length], r = rng(i * 31 + k * 17 + 3);
    const n = 6 + Math.floor(r() * 30), f2 = ["ui/App.tsx", "lib/util.ts", "api/client.ts", "styles/main.css"][Math.floor(r() * 4)];
    return {
      name: tk[0],
      lines: [["읽기", tk[1]], ["검색", `"${tk[2]}"`], ["수정", tk[1]], ["테스트", `${n} 통과 · 1 실패`], ["읽기", `tests/${tk[3]}.test.ts`], ["수정", tk[1]],
        ["테스트", `${n + 1} 통과`], ["빌드", "성공"], ["수정", f2], ["테스트", `${n + 1} 통과`], ["정리", `변경 ${2 + Math.floor(r() * 4)}개 파일`], ["완료", "검토를 기다리는 중"]],
    };
  }

  // 터미널 한 장 그리기 (논리 512×300)
  function drawTerm(c, w, h, st) {
    const rr = (x, y, ww, hh, r) => { c.beginPath(); c.roundRect(x, y, ww, hh, r); };
    rr(1, 1, w - 2, h - 2, 16);
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#0d1220"); gr.addColorStop(1, "#090c16");
    c.fillStyle = gr; c.fill();
    c.lineWidth = 1.5; c.strokeStyle = "rgba(150,165,255,0.28)"; c.stroke();
    ["#ff6b5b", "#ffc14d", "#5ee0a0"].forEach((col, i) => { c.beginPath(); c.arc(20 + i * 16, 18, 4.6, 0, TAU); c.fillStyle = col; c.globalAlpha = 0.9; c.fill(); });
    c.globalAlpha = 1;
    c.font = '500 12.5px "Geist Mono", "Pretendard Variable", monospace'; c.fillStyle = "#6f7899"; c.textBaseline = "middle";
    c.fillText(`에이전트 ${String(st.i + 1).padStart(2, "0")}`, 80, 18.5);
    c.font = '500 13.5px "Pretendard Variable", sans-serif'; c.fillStyle = "#c7cde6";
    c.fillText(st.name, 158, 18.5);
    c.fillStyle = "rgba(255,255,255,0.06)"; c.fillRect(12, 34, w - 24, 1);
    const first = Math.max(0, st.n - VIS);
    for (let k = first; k < st.n; k++) {
      const [verb, obj] = st.lines[k];
      const y = 58 + (k - first) * 29;
      const col = verbColor(verb, obj);
      const last = k === st.n - 1;
      c.globalAlpha = last ? 1 : 0.55 + 0.45 * ((k - first + 1) / VIS);
      rr(16, y - 10.5, 54, 21, 6); c.fillStyle = col; c.globalAlpha *= 0.16; c.fill();
      c.globalAlpha = last ? 1 : 0.8;
      c.font = '600 12.5px "Pretendard Variable", sans-serif'; c.fillStyle = col; c.textAlign = "center"; c.fillText(verb, 43, y + 0.5);
      c.textAlign = "left"; c.font = '450 14.5px "Geist Mono", "Pretendard Variable", monospace';
      c.fillStyle = verb === "완료" ? "#bdf5d9" : "#c9cfdd"; c.fillText(obj, 82, y + 0.5);
      if (last && verb !== "완료") { const tw = c.measureText(obj).width; c.fillStyle = "#9aa6ff"; c.fillRect(86 + tw, y - 8, 8, 16); }
    }
    c.globalAlpha = 1;
    const p = st.n / LINES, done = st.n >= LINES;
    rr(16, h - 26, w - 92, 5, 2.5); c.fillStyle = "rgba(255,255,255,0.08)"; c.fill();
    if (p > 0) { rr(16, h - 26, (w - 92) * p, 5, 2.5); c.fillStyle = done ? "#5ee0a0" : "#8f9cff"; c.fill(); }
    c.font = '500 12px "Geist Mono", monospace'; c.fillStyle = done ? "#5ee0a0" : "#7d86a8"; c.textAlign = "right";
    c.fillText(done ? "완료" : `${st.n}/${LINES}`, w - 16, h - 23.5); c.textAlign = "left";
  }

  // 사람: 단순한 도형으로 만든 뒷모습 (테두리에만 빛이 맺힌다)
  function person(T, mat) {
    const g = new T.Group();
    const add = (geo, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); g.add(m); return m; };
    add(new T.SphereGeometry(0.105, 32, 24), 0, 1.635, 0, 1, 1.12, 1.06);
    add(new T.CylinderGeometry(0.045, 0.05, 0.14, 16), 0, 1.5, 0);
    // 무릎까지 내려오는 코트 실루엣 (엉덩이 이음매가 보이지 않게)
    const prof = [[0.001, 1.455], [0.12, 1.45], [0.205, 1.415], [0.222, 1.35], [0.21, 1.2], [0.19, 1.06], [0.185, 0.95], [0.198, 0.8], [0.212, 0.64], [0.222, 0.52], [0.2, 0.5], [0.001, 0.5]].map(([r, y]) => new T.Vector2(r, y));
    add(new T.LatheGeometry(prof, 40), 0, 0, 0, 1, 1, 0.62);
    const limb = (a, b, r) => {
      const A = new T.Vector3(...a), B = new T.Vector3(...b), len = A.distanceTo(B);
      const m = new T.Mesh(new T.CapsuleGeometry(r, len, 6, 14), mat);
      m.position.copy(A).add(B).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), B.clone().sub(A).normalize());
      g.add(m);
    };
    limb([-0.205, 1.36, 0], [-0.245, 0.86, 0.03], 0.058);
    limb([0.205, 1.36, 0], [0.3, 1.06, -0.1], 0.058); limb([0.3, 1.06, -0.1], [0.37, 1.16, -0.44], 0.05);
    limb([-0.095, 0.6, 0], [-0.105, 0.06, 0.02], 0.075);
    limb([0.095, 0.6, 0], [0.11, 0.06, -0.02], 0.075);
    return g;
  }

  const BG = /* glsl */ `${Deck.glsl.noise}
uniform float uAspect, uWall, uWarm; uniform vec2 uWallC;
void main(){
  vec2 uv=vUv; vec2 p=(uv-.5)*vec2(uAspect,1.);
  vec3 c=mix(vec3(.0018,.0024,.0042), vec3(.0045,.0060,.0110), smoothstep(1.1,.2,uv.y));
  float h=fbm(vec2(p.x*1.3+uTime*.01, p.y*2.4)*1.2);
  vec2 w=(uv-uWallC)*vec2(uAspect,1.);
  c+=vec3(.010,.020,.040)*uWall*exp(-dot(w*vec2(.55,1.4),w*vec2(.55,1.4))*2.)*(.7+.6*h);
  c+=vec3(.05,.028,.010)*uWarm*exp(-dot(w,w)*3.)*(.6+.4*h);
  o=vec4(c,1.);
}`;

  Deck.scene({
    id: "agents",
    title: "에이전트",
    bg: "#030407",
    ink: "#ffffff",
    mood: 0.7,
    transition: "slide",
    beats: [
      { dur: 5.5, note: "요즘 도구는 답을 한 줄 주고 끝나지 않습니다.\n파일을 읽고, 고치고, 테스트를 돌려 보고, 실패하면 다시 고칩니다. 이런 도구를 에이전트라고 부릅니다." },
      { dur: 4.2, note: "그리고 이런 에이전트를 여러 개 동시에 돌릴 수 있습니다. 각자 다른 일을 맡깁니다." },
      { dur: 4.0, note: "그러면 사람에게 남는 일은 두 가지입니다.\n무엇을 시킬지 정하는 것, 그리고 돌아온 결과 중 무엇을 받아들일지 판단하는 것." },
    ],
    create(ctx) {
      const { T, g } = ctx;
      const bgT = ctx.target({ scale: 0.5 });
      const bg = ctx.pass(BG, { uAspect: 16 / 9, uWall: 0, uWarm: 0, uWallC: new T.Vector2(0.5, 0.55) });
      const U = { uMul: { value: 1 }, uTime: { value: 0 } };
      const world = new T.Scene();
      const mirror = new T.Group(); world.add(mirror);
      const add = { transparent: true, depthWrite: false, blending: T.AdditiveBlending };
      const VS = `varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vW;
        void main(){ vUv=uv; vec4 wp=modelMatrix*vec4(position,1.); vW=wp.xyz; vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-wp.xyz); gl_Position=projectionMatrix*viewMatrix*wp; }`;

      // ── 터미널 ──
      const backMat = new T.ShaderMaterial({
        uniforms: { ...U }, vertexShader: VS,
        fragmentShader: `uniform float uMul; varying vec3 vN; varying vec3 vV; void main(){ float f=1.-abs(dot(normalize(vN),normalize(vV))); gl_FragColor=vec4(vec3(.006,.008,.014)+vec3(.05,.06,.12)*pow(f,3.)*uMul,1.); }`,
      });
      const backGeo = new T.BoxGeometry(PW * 0.985, PH * 0.97, 0.05);
      const order = [];
      const terms = [];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c, phi = ((-50 + c * 20) * Math.PI) / 180;
        const pos = new T.Vector3(RA * Math.sin(phi), 0.95 + r * 1.45, -RA * Math.cos(phi));
        const nrm = new T.Vector3(-Math.sin(phi), 0, Math.cos(phi));
        const ppu = i === HERO ? 2.2 : 1.3;
        const panel = ctx.panel(512, 300, { ppu, add: false, flipY: true, srgb: true, draw: drawTerm });
        const tu = { map: { value: panel.texture }, uOn: { value: 0 }, uGain: { value: 2.1 } };
        const screen = new T.Mesh(new T.PlaneGeometry(PW, PH), new T.ShaderMaterial({
          uniforms: { ...U, ...tu }, vertexShader: VS, transparent: true,
          fragmentShader: `uniform sampler2D map; uniform float uMul, uOn, uGain; varying vec2 vUv;
            void main(){ vec4 t=texture2D(map,vUv); vec2 d=vUv-.5; float vig=1.-dot(d,d)*.55; float scan=.95+.05*sin(vUv.y*520.);
              vec3 c=t.rgb*uGain*vig*scan*uOn; gl_FragColor=vec4(c*uMul, t.a); }`,
        }));
        const grp = new T.Group(); grp.position.copy(pos); grp.rotation.y = -phi; mirror.add(grp);
        const back = new T.Mesh(backGeo, backMat); back.position.z = -0.032; grp.add(back, screen);
        terms.push({ i, r, c, pos, nrm, panel, tu, grp, front: pos.clone().addScaledVector(nrm, 0.05) });
      }
      // 켜지는 순서: 첫 터미널에서 가까운 순
      const dist = terms.map((t) => t.pos.distanceTo(terms[HERO].pos) + rng(t.i + 9)() * 0.8);
      const rank = dist.map((d, i) => i).sort((a, b) => dist[a] - dist[b]);
      rank.forEach((ti, k) => (order[ti] = k));
      const speed = terms.map((t) => (t.i === HERO ? 1.45 : 1.05 + rng(t.i * 3 + 1)() * 1.35));
      const bootAt = (i) => 0.55 + order[i] * 0.11;

      function termState(i, s) {
        const a0 = s.at(0), a1 = s.at(1);
        const per = LINES / speed[i] + 2.8;
        // 첫 터미널은 비트 1에서 첫 일을 끝낸 채 멈춰 있다가, 비트 2부터 다음 일을 이어 간다
        const tau = i === HERO ? Math.min(a0 - 0.7, per - 0.05) + Math.max(0, a1) : a1 - bootAt(i) - 0.35;
        if (tau < 0) return { k: 0, n: 0, tau };
        const k = Math.floor(tau / per);
        const n = Math.min(LINES, Math.floor((tau - k * per) * speed[i]) + 1);
        return { k, n, tau };
      }

      // ── 사람 ──
      const pu = { uLit: { value: 0 }, uWarm: { value: 0 } };
      const pmat = new T.ShaderMaterial({
        uniforms: { ...U, ...pu }, vertexShader: VS,
        fragmentShader: `uniform float uMul, uLit, uWarm; varying vec3 vN; varying vec3 vV; varying vec3 vW;
          void main(){ vec3 n=normalize(vN), v=normalize(vV); float f=1.-max(dot(n,v),0.);
            float cool=pow(f,4.)*(.25+.75*max(dot(n,normalize(vec3(0.,.3,-1.))),0.));
            float warm=pow(f,5.)*max(dot(n,normalize(vec3(1.,.4,-.6))),0.);
            vec3 c=vec3(.0012,.0014,.002)+vec3(.30,.38,1.)*cool*.9*uLit+vec3(1.,.55,.22)*warm*2.2*uWarm;
            gl_FragColor=vec4(c*uMul,1.); }`,
      });
      const man = person(T, pmat); man.position.set(HEAD[0], 0, HEAD[2]); mirror.add(man);
      const aura = new T.Mesh(new T.PlaneGeometry(1, 1), new T.ShaderMaterial({
        uniforms: { ...U, ...pu }, vertexShader: VS, ...add, side: T.DoubleSide,
        fragmentShader: `uniform float uMul, uWarm; varying vec2 vUv; void main(){ vec2 d=vUv-.5; float r=length(d*vec2(1.,.8))*2.;
          float a=(exp(-r*r*4.5)*.6+exp(-r*r*26.)*1.1)*smoothstep(1.,.55,r); gl_FragColor=vec4(vec3(1.,.58,.25)*a*uWarm*uMul,1.); }`,
      }));
      aura.scale.set(2.6, 3.2, 1); aura.position.set(HEAD[0], 1.25, HEAD[2] - 0.32); mirror.add(aura);

      // ── 빛줄기: 터미널 → 사람(결과, 남색) / 사람 → 터미널(지시, 호박색) ──
      const headV = new T.Vector3(...HEAD);
      const streamU = { uTerm: { value: terms.map((t) => t.front) }, uNrm: { value: terms.map((t) => t.nrm) }, uHead: { value: headV }, uPx: { value: 800 } };
      const mkStream = (perTerm, seed, dir, color, size, amt) => {
        const n = perTerm * NT, r = rng(seed), aux = new Float32Array(n * 4);
        for (let k = 0; k < n; k++) {
          aux[k * 4] = k % NT; aux[k * 4 + 1] = dir > 0 ? r() : Math.floor(r() * 4) / 4 + r() * 0.06; aux[k * 4 + 2] = dir > 0 ? 0.16 + r() * 0.16 : 0.22; aux[k * 4 + 3] = r();
        }
        const geo = new T.BufferGeometry();
        geo.setAttribute("position", new T.BufferAttribute(new Float32Array(n * 3), 3)); geo.setAttribute("aux", new T.BufferAttribute(aux, 4));
        const u = { uAmt: { value: 0 }, uT: { value: 0 } };
        const pts = new T.Points(geo, new T.ShaderMaterial({
          uniforms: { ...U, ...streamU, ...u }, ...add,
          vertexShader: `attribute vec4 aux; uniform vec3 uTerm[${NT}]; uniform vec3 uNrm[${NT}]; uniform vec3 uHead; uniform float uT, uAmt, uPx; varying float vB;
            vec3 bez(vec3 a, vec3 b, vec3 c, vec3 d, float t){ float u=1.-t; return u*u*u*a+3.*u*u*t*b+3.*u*t*t*c+t*t*t*d; }
            void main(){ int i=int(aux.x+.5); vec3 A=uTerm[i], N=uNrm[i];
              float u=fract(aux.y+uT*aux.z); ${dir > 0 ? "" : "u=1.-u;"}
              vec3 c1=A+N*2.4+vec3(0.,.95,0.);
              vec3 c2=uHead+vec3(0.,.85,-2.4);
              vec3 p=bez(A,c1,c2,uHead,u);
              p+=(fract(vec3(aux.w*13.1,aux.w*7.7,aux.w*3.3))-.5)*.07*sin(3.1416*u);
              vB=uAmt*smoothstep(0.,.1,u)*smoothstep(1.,.86,u)*(.5+.5*aux.w);
              vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=max(1.,${size.toFixed(3)}*uPx/-mv.z); }`,
          fragmentShader: `uniform float uMul; varying float vB; void main(){ vec2 d=gl_PointCoord-.5; float a=exp(-dot(d,d)*13.); gl_FragColor=vec4(vec3(${color})*vB*a*${amt.toFixed(2)}*uMul,1.); }`,
        }));
        pts.frustumCulled = false; mirror.add(pts);
        return u;
      };
      const inU = mkStream(70, 71, 1, ".55,.62,1.", 0.026, 2.2);
      const outU = mkStream(12, 83, -1, "1.,.62,.28", 0.05, 3.0);
      // 가는 실선 (빛줄기의 길)
      const lineMat = new T.LineBasicMaterial({ color: new T.Color(0.3, 0.36, 1.0), ...add, opacity: 0 });
      terms.forEach((t) => {
        const A = t.front, c1 = A.clone().addScaledVector(t.nrm, 2.4).add(new T.Vector3(0, 0.95, 0)), c2 = headV.clone().add(new T.Vector3(0, 0.85, -2.4));
        const curve = new T.CubicBezierCurve3(A, c1, c2, headV);
        mirror.add(new T.Line(new T.BufferGeometry().setFromPoints(curve.getPoints(48)), lineMat));
      });

      // ── 화면 빛에 떠오르는 먼지 ──
      const ND = 900, rd = rng(91), dpos = new Float32Array(ND * 3), daux = new Float32Array(ND * 4);
      for (let k = 0; k < ND; k++) {
        const a = ((-60 + rd() * 120) * Math.PI) / 180, rr = 2 + rd() * 8;
        dpos[k * 3] = Math.sin(a) * rr; dpos[k * 3 + 1] = 0.2 + rd() * 5; dpos[k * 3 + 2] = -Math.cos(a) * rr + 1.5;
        daux[k * 4] = rd() * TAU; daux[k * 4 + 1] = 0.3 + rd() * 0.7; daux[k * 4 + 2] = rd(); daux[k * 4 + 3] = rd();
      }
      const dgeo = new T.BufferGeometry(); dgeo.setAttribute("position", new T.BufferAttribute(dpos, 3)); dgeo.setAttribute("aux", new T.BufferAttribute(daux, 4));
      const dustU = { uWall: { value: 0 }, uHero: { value: terms[HERO].pos } };
      const dust = new T.Points(dgeo, new T.ShaderMaterial({
        uniforms: { ...U, ...dustU, uPx: streamU.uPx }, ...add,
        vertexShader: `attribute vec4 aux; uniform float uTime, uWall, uPx; uniform vec3 uHero; varying float vB;
          void main(){ vec3 p=position+vec3(sin(uTime*.1*aux.y+aux.x)*.5, sin(uTime*.06+aux.x*3.)*.3, cos(uTime*.08*aux.y+aux.x)*.5);
            float near=exp(-dot(p-uHero,p-uHero)*.25);
            float wall=smoothstep(11.,5.,length(p.xz))*uWall;
            vec4 mv=modelViewMatrix*vec4(p,1.); vB=(.05+.1*aux.z)*(near+wall*.8);
            gl_Position=projectionMatrix*mv; gl_PointSize=max(1.,(.016+.02*aux.w)*uPx/-mv.z); }`,
        fragmentShader: `uniform float uMul; varying float vB; void main(){ vec2 d=gl_PointCoord-.5; float a=exp(-dot(d,d)*12.); gl_FragColor=vec4(vec3(.7,.78,1.)*vB*a*2.*uMul,1.); }`,
      }));
      dust.frustumCulled = false; mirror.add(dust);

      // ── 바닥 ──
      const floorU = { uTerm: streamU.uTerm, uNrm: streamU.uNrm, uOn: { value: new Array(NT).fill(0) }, uWarmP: { value: new T.Vector4(HEAD[0], 0, HEAD[2], 0) } };
      const floor = new T.Mesh(new T.PlaneGeometry(90, 90), new T.ShaderMaterial({
        uniforms: { ...U, ...floorU }, transparent: true,
        blending: T.CustomBlending, blendSrc: T.OneFactor, blendDst: T.OneMinusSrcAlphaFactor,
        vertexShader: `varying vec3 vW; void main(){ vec4 wp=modelMatrix*vec4(position,1.); vW=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`,
        fragmentShader: `${Deck.glsl.noise}
          uniform vec3 uTerm[${NT}]; uniform vec3 uNrm[${NT}]; uniform float uOn[${NT}]; uniform vec4 uWarmP; uniform float uMul; varying vec3 vW;
          void main(){
            vec3 v=normalize(cameraPosition-vW); float fr=pow(1.-max(v.y,0.),4.);
            float n=fbm(vW.xz*.8)*.6+fbm(vW.xz*7.)*.4;
            float refl=mix(.32,.8,fr)*(.84+.16*n);
            float dist=length(vW.xz-cameraPosition.xz); float far=1.-smoothstep(10.,30.,dist);
            vec3 pool=vec3(0.);
            for(int i=0;i<${NT};i++){ vec3 d=vW-uTerm[i]; float ff=max(dot(normalize(d),uNrm[i]),0.); pool+=vec3(.16,.22,.55)*.5*uOn[i]*ff/(1.+dot(d,d)*.6); }
            vec2 wd=vW.xz-uWarmP.xz; pool+=vec3(1.,.55,.22)*uWarmP.w*.55*exp(-dot(wd,wd)*1.6);
            vec3 base=vec3(.0022,.0026,.0045)*(.8+.4*n);
            gl_FragColor=vec4((base*(1.-refl)*far+pool*(.75+.25*n))*uMul, (1.-refl)*far*.94);
          }`,
      }));
      floor.rotation.x = -Math.PI / 2; world.add(floor);

      const cam = ctx.camera(30, 0.05, 200);
      const heroT = terms[HERO];
      const right = new T.Vector3(Math.cos(-((-10 * Math.PI) / 180)), 0, -Math.sin(-((-10 * Math.PI) / 180)));
      const P1 = heroT.pos.clone().addScaledVector(heroT.nrm, 4.7).addScaledVector(right, -0.55).add(new T.Vector3(0, 0.14, 0));
      const L1 = heroT.pos.clone().addScaledVector(right, -0.6).add(new T.Vector3(0, 0.08, 0));
      const P2 = new T.Vector3(0, 2.85, 9.4), L2 = new T.Vector3(0, 2.6, -7.8);
      const P3 = new T.Vector3(0.55, 2.35, 6.2), L3 = new T.Vector3(0.05, 2.62, -7.8);
      const _p = new T.Vector3(), _l = new T.Vector3();

      // ── 글자 ──
      const sh = { blur: 26, alpha: 0.7 };
      const H1 = ctx.text("에이전트", { size: 112, weight: 300, tracking: -0.04, shadow: sh });
      const S1 = ctx.text("읽고, 고치고, 돌려 본다", { size: 38, weight: 400, color: MUTED, tracking: -0.01, shadow: sh });
      const H2 = ctx.text("여럿이 동시에", { size: 112, weight: 300, tracking: -0.04, shadow: sh });
      const S2 = ctx.text("각자 다른 일을, 각자의 속도로", { size: 38, weight: 400, color: MUTED, tracking: -0.01, shadow: sh });
      const H3 = ctx.text("사람의 일은 방향과 판단", { size: 96, weight: 300, tracking: -0.04, shadow: sh });
      const S3 = ctx.text([{ t: "무엇을 시킬지", color: AMBER }, { t: "  ·  ", color: "#6e7690" }, { t: "무엇을 받아들일지", color: ACCENT }], { size: 40, weight: 400, tracking: -0.01, shadow: sh });

      return {
        render(s, hdr) {
          const a0 = s.at(0), a1 = s.at(1), a2 = s.at(2);
          U.uTime.value = s.time;
          const e1 = prog(a1, 0, 3.2, ease.inOut3), e2 = prog(a2, 0, 2.9, ease.inOut3);
          // 카메라: 터미널 앞 → 넓게 → 사람 어깨 너머
          _p.copy(P1).lerp(P2, e1).lerp(P3, e2);
          _l.copy(L1).lerp(L2, e1).lerp(L3, e2);
          const hand = 0.03;
          _p.x += noise(s.time * 0.3) * hand + s.mouse.x * 0.25 * (e1 + e2 * 0.5); _p.y += noise(s.time * 0.27 + 9) * hand - s.mouse.y * 0.15 * e1;
          cam.position.copy(_p); cam.lookAt(_l);
          cam.userData.fov = lerp(lerp(30, 36, e1), 38, e2);
          ctx.fit(cam); cam.updateMatrixWorld();

          // 터미널 상태 · 다시 그리기(줄 수가 바뀔 때만)
          let heroN = 0;
          terms.forEach((t) => {
            const st = termState(t.i, s);
            const sc = script(t.i, st.k);
            t.panel.redraw(`${st.k}:${st.n}`, { i: t.i, n: st.n, name: sc.name, lines: sc.lines });
            const on = t.i === HERO ? prog(a0, 0, 0.6, ease.out2) : prog(a1, bootAt(t.i), 0.3, ease.out2);
            const flash = t.i === HERO ? 0 : Math.exp(-Math.pow((a1 - bootAt(t.i) - 0.06) / 0.05, 2)) * 1.6;
            t.tu.uOn.value = on + flash;
            t.grp.visible = on > 0.001 || flash > 0.01;
            floorU.uOn.value[t.i] = on;
            if (t.i === HERO) heroN = st.n;
            if (t.i !== HERO) s.cue("on" + t.i, a1 > bootAt(t.i), "tick", { vol: 0.5 });
          });
          s.ticks("log", heroN, "blip", { note: 86 });
          s.cue("fail", heroN >= 4 && a1 < 0, "buzz");
          s.cue("done", heroN >= LINES && a1 < 0, "ding", { note: 84 });
          s.cue("pull", a1 > 0.05, "whoosh", { up: false, dur: 1.6 });
          s.cue("join", a2 > 0.4, "swell", { root: 50, vol: 0.06 });

          // 사람 · 빛줄기
          const lit = prog(a1, 1.2, 1.5) * 0.6 + prog(a2, 0, 1.4) * 0.4;
          const warm = prog(a2, 0.5, 1.4, ease.inOut2);
          pu.uLit.value = lit; pu.uWarm.value = warm;
          aura.quaternion.copy(cam.quaternion);
          floorU.uWarmP.value.w = warm;
          const flow = prog(a2, 0.3, 1.6, ease.inOut2);
          inU.uAmt.value = flow; inU.uT.value = s.time;
          outU.uAmt.value = prog(a2, 1.2, 1.2, ease.inOut2); outU.uT.value = s.time;
          lineMat.opacity = flow * 0.16;
          dustU.uWall.value = e1;
          streamU.uPx.value = hdr.height / (2 * Math.tan((cam.fov * Math.PI) / 360));

          bg.u.uAspect.value = g.W / g.H; bg.u.uTime.value = s.time;
          bg.u.uWall.value = 0.35 + e1 * 0.9; bg.u.uWarm.value = warm * 0.8;
          bg.render(bgT); ctx.copy(bgT, hdr);

          const r = ctx.r;
          mirror.scale.y = -1; mirror.updateMatrixWorld(true); floor.visible = false; U.uMul.value = 0.24;
          const lo = lineMat.opacity; lineMat.opacity = lo * 0.24;
          ctx.draw(world, cam, hdr);
          lineMat.opacity = lo;
          mirror.scale.y = 1; mirror.updateMatrixWorld(true); mirror.visible = false; floor.visible = true; U.uMul.value = 1;
          ctx.draw(world, cam, hdr);
          r.setRenderTarget(hdr); r.clear(false, true, false);
          mirror.visible = true; floor.visible = false;
          ctx.draw(world, cam, hdr);

          // 글자
          const o1 = prog(a1, 0, 0.6, ease.inOut3), o2 = prog(a2, 0, 0.6, ease.inOut3);
          H1.at(118, 196).show(prog(a0, 0.1, 1.1, ease.linear), { style: "rise", out: o1, outStyle: "blur", stagger: 0.3 });
          S1.at(122, 274).show(prog(a0, 0.5, 1.0, ease.linear), { style: "blur", out: o1, stagger: 0.4 });
          H2.at(118, 196).show(prog(a1, 0.5, 1.1, ease.linear), { style: "rise", out: o2, outStyle: "blur", stagger: 0.3 });
          S2.at(122, 274).show(prog(a1, 0.9, 1.0, ease.linear), { style: "blur", out: o2, stagger: 0.4 });
          H3.at(118, 186).show(prog(a2, 0.4, 1.2, ease.linear), { style: "rise", stagger: 0.3 });
          S3.at(122, 262).show(prog(a2, 1.0, 1.1, ease.linear), { style: "blur", stagger: 0.45 });

          return { bloom: 0.8 + warm * 0.15, threshold: 0.75, knee: 0.7, radius: 1.0, exposure: 1.0, vignette: 0.46, grain: 0.045, ca: 0.4, contrast: 1.06, saturation: 1.05 };
        },
      };
    },
  });
})();
