// 01 · 한 줄로 시작
// 깊은 우주의 성운 앞에 유리 같은 프롬프트 창. 한 줄이 입력되고, 보내는 순간 글자들이 빛 입자로 흩어져 날아가
// 위쪽에서 "바이브 코딩"이라는 제목으로 다시 모인다. (성운·별은 10장에서도 다시 쓴다)
(() => {
  const { clamp, lerp, ease, prog, rng } = Deck.util;
  const PROMPT = "10분짜리 바이브 코딩 발표 만들어 줘";
  const TITLE = "바이브 코딩";
  const ACCENT = "#8f9cff";
  const NP = 9000;

  // ── 공용: 성운 배경 (HDR, 선형) ──────────────────────────────────────
  Deck.lib = Deck.lib || {};
  Deck.lib.nebula = /* glsl */ `${Deck.glsl.noise}
uniform float uAspect, uBurst, uRing, uWarm, uLift; uniform vec2 uFocus, uDrift;
vec3 nebula(vec2 uv){
  vec2 p=(uv-.5)*vec2(uAspect,1.)+uDrift;
  float t=uTime*.012;
  vec2 q=p*1.15;
  vec2 w=vec2(fbm(q+vec2(0.,t)), fbm(q+vec2(5.2,1.3)-t));
  float n=fbm(q+1.7*w+vec2(t*.6,-t*.3));
  float n2=fbm(q*2.3-w*.9+9.1);
  float r0=length(p*vec2(.8,1.1));
  vec3 c=vec3(.0035,.0045,.010)+vec3(.010,.012,.030)*exp(-r0*1.6);
  float d=smoothstep(.44,1.02,n);
  vec3 neb=mix(vec3(.060,.080,.40), vec3(.30,.075,.46), smoothstep(.30,.85,n2));
  neb=mix(neb, vec3(.05,.20,.34), smoothstep(.62,.9,fbm(q*.7-4.))*.55);
  neb=mix(neb, vec3(.62,.30,.26), smoothstep(.70,1.05,n)*(.35+.65*uWarm));
  c+=neb*d*d*(.62+uLift);
  c*=mix(1.,.35,smoothstep(.50,.80,n2)*(1.-d));
  vec2 f=(uv-uFocus)*vec2(uAspect,1.); float r=length(f);
  c+=vec3(.42,.47,1.)*uBurst*(exp(-r*5.)*.75+exp(-r*18.)*1.7);
  c+=vec3(.42,.48,1.)*uBurst*exp(-abs(f.y)*170.)*exp(-abs(f.x)*2.2)*1.1;
  float ring=exp(-pow((r-uRing*1.25)/.010,2.))*pow(1.-uRing,2.)*step(.001,uRing);
  c+=vec3(.5,.56,1.)*ring*.9;
  return c;
}`;
  // 별: 점 하나하나가 깜빡인다. 깊이에 따라 시차가 다르다.
  Deck.lib.stars = (T, n = 1500, seed = 11) => {
    const r = rng(seed), pos = new Float32Array(n * 3), aux = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = -400 + r() * 2720; pos[i * 3 + 1] = -300 + r() * 1680; pos[i * 3 + 2] = 0;
      const big = r() < 0.04;
      aux[i * 4] = big ? 2.2 + r() * 2.2 : 0.7 + r() * 1.3;      // 크기
      aux[i * 4 + 1] = r() * 6.28;                               // 위상
      aux[i * 4 + 2] = big ? 1.6 + r() * 2.5 : 0.15 + r() * 0.7;  // 밝기
      aux[i * 4 + 3] = 0.2 + r() * 0.8;                          // 깊이
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.BufferAttribute(pos, 3));
    geo.setAttribute("aux", new T.BufferAttribute(aux, 4));
    const mat = new T.RawShaderMaterial({
      glslVersion: T.GLSL3, transparent: true, depthTest: false, depthWrite: false, blending: T.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPpu: { value: 1 }, uShift: { value: new T.Vector2() }, uA: { value: 1 } },
      vertexShader: `precision highp float; in vec3 position; in vec4 aux; uniform mat4 projectionMatrix, modelViewMatrix; uniform float uTime, uPpu; uniform vec2 uShift;
        out float vB; void main(){ vec2 p=position.xy+uShift*aux.w; float tw=.6+.4*sin(uTime*(1.2+aux.w*2.)+aux.y); vB=aux.z*tw;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,0.,1.); gl_PointSize=max(1.,aux.x*uPpu*1.6); }`,
      fragmentShader: `precision highp float; in float vB; out vec4 o; uniform float uA; void main(){ vec2 d=gl_PointCoord-.5; float r=length(d)*2.; float a=exp(-r*r*5.)+.6*exp(-r*r*40.); o=vec4(vec3(.82,.86,1.)*vB*a*uA,1.); }`,
    });
    const pts = new T.Points(geo, mat); pts.frustumCulled = false;
    return pts;
  };

  Deck.scene({
    id: "prompt",
    title: "한 줄로 시작",
    bg: "#030409",
    ink: "#ffffff",
    mood: 0.3,
    transition: "fade",
    beats: [
      { dur: 3.4, note: "(아무 키나 눌러 소리를 켠 뒤, 프롬프트가 끝까지 입력될 때까지 잠깐 기다립니다.)\n안녕하세요. 오늘 발표는 이 한 줄에서 시작합니다." },
      { dur: 3.6, note: "말로 시키면 만들어진다. 오늘은 이 방식을 '바이브 코딩'이라고 부르겠습니다.\n사실 이 발표 자료도 이렇게 만들었습니다. 그 이야기는 마지막에 하겠습니다." },
    ],
    create(ctx) {
      const { T, g } = ctx;
      const nebT = ctx.target({ scale: 0.5 });
      const neb = ctx.pass(Deck.lib.nebula + `void main(){ o=vec4(nebula(vUv),1.); }`, {
        uAspect: 16 / 9, uBurst: 0, uRing: 0, uWarm: 0, uLift: 0, uFocus: new T.Vector2(0.5, 0.58), uDrift: new T.Vector2(),
      });
      const space = new T.Scene();
      const stars = Deck.lib.stars(T);
      space.add(stars);

      // ── 겹레이어 ──
      const box = ctx.shape("rect", { fill: "#0c0f1c", fillAlpha: 0.66, stroke: "#c9d0ff", strokeAlpha: 0.16, line: 1.5, radius: 56, shadow: { y: 24, blur: 70, alpha: 0.55 } });
      const dot = ctx.shape("circle", { fill: ACCENT, glow: 0.55, glowColor: ACCENT, glowRadius: 10 });
      const prompt = ctx.text(PROMPT, { size: 38, weight: 400, color: "#e9ecf8", valign: "middle", tracking: -0.01, order: 12 });
      const caret = ctx.shape("rect", { fill: ACCENT, radius: 2 });
      const btn = ctx.shape("circle", { fill: "#2a3050" });
      const arrow1 = ctx.shape("line", { stroke: "#0b0d18", line: 5 });
      const arrow2 = ctx.shape("line", { stroke: "#0b0d18", line: 5 });
      const title = ctx.text(TITLE, { size: 232, weight: 300, tracking: -0.045, align: "center", valign: "middle", color: "#ffffff", order: 14 });
      const sub = ctx.text("말로 만드는 소프트웨어", { size: 42, weight: 300, tracking: 0.14, align: "center", valign: "middle", color: "#b8bfe6", order: 14 });
      title.at(960, 455); sub.at(960, 612);

      // ── 입자: 프롬프트 글자 → 제목 글자 ──
      const BOX0 = { cx: 960, cy: 560, w: 1100, h: 112 };
      const TX0 = BOX0.cx - BOX0.w / 2 + 104;
      prompt.at(TX0, BOX0.cy);
      const boxY = (t) => lerp(BOX0.cy, 918, prog(t, 0.15, 1.1, ease.inOut3));
      const src = prompt.points(NP, { seed: 3, res: 0.7 });
      const dst = title.points(NP, { seed: 5, res: 0.5 });
      const r = rng(21);
      const geo = new T.BufferGeometry();
      const pos = new Float32Array(NP * 3), a0 = new Float32Array(NP * 4), a1 = new Float32Array(NP * 4), a2 = new Float32Array(NP * 4);
      const tw = title.width;
      for (let i = 0; i < NP; i++) {
        const sx = src[i * 2], sy = src[i * 2 + 1], dx = dst[i * 2], dy = dst[i * 2 + 1];
        const ns = clamp((sx - TX0) / prompt.width), nd = clamp((dx - (960 - tw / 2)) / tw);
        const tD = 0.08 + ns * 0.42 + r() * 0.1;
        const tA = 1.15 + nd * 0.55 + r() * 0.18;
        const syy = sy + (boxY(tD) - BOX0.cy);
        pos[i * 3] = sx; pos[i * 3 + 1] = syy;
        a0[i * 4] = sx; a0[i * 4 + 1] = syy; a0[i * 4 + 2] = dx; a0[i * 4 + 3] = dy;
        a1[i * 4] = tD; a1[i * 4 + 1] = tA; a1[i * 4 + 2] = r(); a1[i * 4 + 3] = r();
        a2[i * 4] = (r() - 0.5) * 2; a2[i * 4 + 1] = r(); a2[i * 4 + 2] = (r() - 0.5) * 2; a2[i * 4 + 3] = r() < 0.035 ? 1 : 0;
      }
      geo.setAttribute("position", new T.BufferAttribute(pos, 3));
      geo.setAttribute("a0", new T.BufferAttribute(a0, 4));
      geo.setAttribute("a1", new T.BufferAttribute(a1, 4));
      geo.setAttribute("a2", new T.BufferAttribute(a2, 4));
      const pmat = new T.RawShaderMaterial({
        glslVersion: T.GLSL3, transparent: true, depthTest: false, depthWrite: false, blending: T.AdditiveBlending,
        uniforms: { uT: { value: -1 }, uTime: { value: 0 }, uPpu: { value: 1 }, uGain: { value: 1 } },
        vertexShader: /* glsl */ `precision highp float;
          in vec3 position; in vec4 a0, a1, a2; uniform mat4 projectionMatrix, modelViewMatrix; uniform float uT, uTime, uPpu;
          out vec3 vC; out float vA;
          vec2 bez(vec2 p0, vec2 p1, vec2 p2, vec2 p3, float t){ float u=1.-t; return u*u*u*p0+3.*u*u*t*p1+3.*u*t*t*p2+t*t*t*p3; }
          void main(){
            vec2 s=a0.xy, d=a0.zw; float tD=a1.x, tA=a1.y;
            float k=clamp((uT-tD)/(tA-tD),0.,1.);
            float e=k<.5?4.*k*k*k:1.-pow(-2.*k+2.,3.)/2.;
            vec2 c1=s+vec2(a2.x*160., -220.-a2.y*260.);
            vec2 c2=d+vec2(a2.z*200., 170.+a1.w*150.);
            vec2 p=bez(s,c1,c2,d,e);
            p+=vec2(sin(k*9.+a1.z*20.), cos(k*7.+a1.w*20.))*sin(3.14159*k)*26.;
            float after=max(uT-tA,0.);
            // 도착 뒤: 대부분은 사라지고, 일부는 제목에서 불씨처럼 천천히 떠오른다
            float stay=a2.w;
            float cyc=fract(uTime*.11+a1.z*7.);
            float ember=stay*smoothstep(.6,1.6,after);
            p+=ember*vec2(sin(uTime*.8+a1.w*30.)*10., -cyc*90.);
            float born=smoothstep(tD-.02, tD+.12, uT);
            float fade=mix(1.-smoothstep(.05,.75,after), sin(3.14159*cyc)*.55, ember);
            float flash=exp(-pow((uT-tA)/.12,2.))*1.8;
            vA=born*fade;
            vec3 cold=vec3(.42,.48,1.), hot=vec3(1.,.96,.92);
            vC=mix(vec3(.9), cold, smoothstep(0.,.25,k));
            vC=mix(vC, hot, smoothstep(.75,1.,k))*(1.+flash)*(1.6+a1.z*1.4);
            gl_Position=projectionMatrix*modelViewMatrix*vec4(p,0.,1.);
            gl_PointSize=max(1.,(1.6+a1.w*1.8)*uPpu*(1.+.6*sin(3.14159*k)));
          }`,
        fragmentShader: `precision highp float; in vec3 vC; in float vA; out vec4 o; uniform float uGain;
          void main(){ vec2 d=gl_PointCoord-.5; float r2=dot(d,d)*4.; float a=exp(-r2*3.); o=vec4(vC*a*vA*uGain,1.); }`,
      });
      const parts = new T.Points(geo, pmat); parts.frustumCulled = false;
      const fly = new T.Scene(); fly.add(parts);

      return {
        render(s, hdr) {
          const a0t = s.at(0), a1t = s.at(1);
          const send = a1t >= 0 ? a1t : -1;
          const vw = g.view;
          // 배경
          const burst = send > 0 ? Math.exp(-Math.pow((send - 1.55) / 0.5, 2)) * 0.5 + prog(send, 1.2, 1.5) * 0.035 : 0;
          const ring = send > 1.3 ? clamp((send - 1.3) / 1.6) : 0;
          Object.assign(neb.u.uAspect, { value: g.W / g.H });
          neb.u.uTime.value = s.time + 40; neb.u.uBurst.value = burst; neb.u.uRing.value = ring; neb.u.uLift.value = prog(send, 1.3, 2, ease.out2) * 0.05;
          neb.u.uDrift.value.set(s.mouse.x * 0.02 + s.time * 0.002, -s.mouse.y * 0.012);
          neb.u.uFocus.value.set((960 - vw.x0) / vw.w, 1 - (455 - vw.y0) / vw.h);
          neb.render(nebT);
          ctx.copy(nebT, hdr);
          stars.material.uniforms.uTime.value = s.time; stars.material.uniforms.uPpu.value = g.ppu;
          stars.material.uniforms.uShift.value.set(-s.mouse.x * 14 - s.time * 1.5, -s.mouse.y * 9);
          ctx.draw(space, ctx.ortho, hdr);
          if (send >= 0) {
            pmat.uniforms.uT.value = send; pmat.uniforms.uTime.value = s.time; pmat.uniforms.uPpu.value = g.ppu;
            pmat.uniforms.uGain.value = 1;
            ctx.draw(fly, ctx.ortho, hdr);
          }

          // 프롬프트 창 (보내면 아래로 작아진다)
          const tt = a0t - 0.9, CPS = 13;
          const nTyped = clamp(Math.floor(tt * CPS), 0, prompt.n);
          const typed = nTyped >= prompt.n;
          s.ticks("type", nTyped, "key");
          const k = lerp(1, 0.6, prog(send, 0.15, 1.1, ease.inOut3));
          const cy = send >= 0 ? boxY(send) : BOX0.cy;
          const boxIn = prog(a0t, 0, 0.9, ease.out4);
          const bw = BOX0.w * k * lerp(0.92, 1, boxIn), bh = BOX0.h * k;
          const bx = 960 - bw / 2;
          const dim = lerp(1, 0.62, prog(send, 0.6, 1));
          box.center(960, cy + (1 - boxIn) * 30, bw, bh).alpha(boxIn * dim);
          box.style({ radius: bh / 2 });
          const listen = 0.75 + 0.25 * Math.sin(s.time * 3.2);
          dot.circle(bx + 50 * k, cy, 7 * k * (typed ? 1 : listen)).alpha(boxIn * dim);
          // 입력된 글자: 하나씩 살짝 떠오르며. 보낸 직후에는 입자로 바뀌어 사라졌다가, 작은 창에 흐리게 다시 나타난다
          const tx = bx + 104 * k;
          prompt.at(tx, cy); prompt.scale = k;
          const back = prog(send, 1.4, 0.8);
          prompt.alpha = boxIn * (send >= 0 ? Math.max(back * 0.75, 0) : 1);
          prompt.animate((gl, o) => {
            const ty = clamp((tt * CPS - gl.n) * 2.5);
            o.alpha = ty; o.dy = (1 - ease.out3(ty)) * 8;
            if (send >= 0) {
              const ns = clamp((gl.cx) / prompt.width);
              const gone = prog(send, 0.04 + ns * 0.42, 0.18);
              o.alpha = ty * Math.max(1 - gone, back);
              o.dy -= (1 - back) * gone * 16;
            }
          });
          if (send < 0 && boxIn > 0.5) {
            const cp = prompt.caret(clamp(Math.ceil(tt * CPS), 0, prompt.n));
            const on = !typed || Math.floor(s.time * 1.9) % 2 === 0;
            caret.rect(cp.x + 4, cy - 23, 3, 46).alpha(on ? 0.95 : 0);
          } else caret.alpha(0);
          // 보내기 버튼
          const bxc = bx + bw - 56 * k;
          const press = send >= 0 ? 1 - 0.12 * Math.sin(Math.PI * clamp(send / 0.25)) : 1;
          const ready = typed ? 1 : 0;
          btn.style({ fill: ready ? ACCENT : "#2a3050", glow: ready ? 0.35 * dim : 0, glowColor: ACCENT, glowRadius: 14 });
          btn.circle(bxc, cy, 33 * k * press).alpha(boxIn * dim);
          const ak = k * press, aw = typed ? 1 : 0.35;
          arrow1.style({ stroke: typed ? "#0b0d18" : "#8a91b8" });
          arrow2.style({ stroke: typed ? "#0b0d18" : "#8a91b8" });
          arrow1.style({ line: 5 * ak }).path([[bxc, cy + 13 * ak], [bxc, cy - 13 * ak]]).alpha(boxIn * dim * (0.65 + 0.35 * aw));
          arrow2.style({ line: 5 * ak }).path([[bxc - 11 * ak, cy - 2 * ak], [bxc, cy - 13 * ak], [bxc + 11 * ak, cy - 2 * ak]]).alpha(boxIn * dim * (0.65 + 0.35 * aw));

          // 제목: 입자가 도착하는 자리부터 또렷해진다
          if (send > 0) {
            title.animate((gl, o) => {
              const nd = clamp((gl.cx + tw / 2) / tw);
              const q = prog(send, 1.05 + nd * 0.55, 0.7, ease.out3);
              o.alpha = q; o.blur = (1 - q) * 30; o.scale = 1 + (1 - q) * 0.05;
            });
            sub.show(prog(send, 2.0, 1.0, ease.linear), { style: "blur", stagger: 0.5 });
          } else { title.hide(); sub.hide(); }

          s.cue("send", send > 0, "send");
          s.cue("burst", send > 1.45, "swell", { root: 53, vol: 0.075 });
          for (let i = 0; i < title.n; i++) s.cue("g" + i, send > 1.2 + (i / Math.max(1, title.n - 1)) * 0.55, "chime", { note: 79 + [0, 2, 4, 7, 9][i % 5], vol: 0.035 });
          return { bloom: 0.62, threshold: 0.7, knee: 0.6, radius: 1.05, exposure: 1.05, vignette: 0.45, grain: 0.045, ca: 0.5, contrast: 1.05, saturation: 1.06 };
        },
      };
    },
  });
})();
