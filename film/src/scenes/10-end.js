// 10 · 마무리
// 1장의 성운으로 돌아온다. 이 발표를 만든 프롬프트가 입력되고, 그 창에서 지금까지의 장면들이 필름처럼 흘러나온다.
// 마지막 비트: 밤이 걷히고 구름 바다 위로 해가 뜬다. "질문 있으신가요?"
(() => {
  const { clamp, lerp, ease, prog } = Deck.util;
  const ACCENT = "#8f9cff";
  const PROMPT = "바이브 코딩을 소개하는 10분 발표를 만들어 줘.\n장면마다 움직이는 그림으로.";
  const ORDER = ["prompt", "stairs", "loop", "experiments", "agents", "fit", "drift", "habits", "balance"];

  // 해 뜨는 구름 바다: 높이장 구름을 레이마칭하고, 해를 등진 가장자리는 은빛으로 빛나게
  const CLOUDS = /* glsl */ `${Deck.glsl.noise}
uniform float uAspect, uRise, uFov; uniform vec3 uCam, uFwd, uRight, uUp, uSun;
vec3 skyBase(vec3 rd){
  float sd=max(dot(rd,uSun),0.), h=max(rd.y,0.);
  vec3 zen=mix(vec3(.012,.025,.09), vec3(.018,.055,.24), uRise), mid=mix(vec3(.09,.06,.14), vec3(.36,.19,.30), uRise), hor=mix(vec3(.40,.18,.12), vec3(1.35,.50,.17), uRise);
  vec3 c=mix(hor, mid, smoothstep(0.,.12,h)); c=mix(c, zen, smoothstep(.06,.62,h));
  c+=vec3(1.,.42,.16)*pow(sd,4.)*(.3+.8*uRise)*smoothstep(-.1,.2,1.-h);
  return c;
}
vec3 skyHalo(vec3 rd){ float sd=max(dot(rd,uSun),0.); return skyBase(rd)+vec3(1.,.68,.4)*pow(sd,48.)*2.6*uRise; }
vec3 sky(vec3 rd){
  float sd=max(dot(rd,uSun),0.);
  vec3 c=skyHalo(rd);
  c+=vec3(1.,.92,.78)*smoothstep(.99962,.99985,sd)*36.*uRise;
  vec2 cp=rd.xz/max(rd.y,.04)*.55+vec2(uTime*.004,0.);
  float ci=smoothstep(.56,.92,fbm(cp*1.4))*smoothstep(0.,.3,rd.y);
  c=mix(c, c*1.1+vec3(1.,.66,.45)*.3*uRise, ci*.55);
  return c;
}
float H(vec2 p){
  float big=fbm3(p*.03+vec2(uTime*.002,0.));
  float puff=1.-voronoi(p*.085+vec2(uTime*.003,0.)).x; puff=puff*puff*(3.-2.*puff);
  float m=smoothstep(.3,.75,big);
  return m*6.5+puff*3.4*m+vnoise(p*.35)*.6-1.8;
}
void main(){
  vec2 q=(vUv-.5)*vec2(uAspect,1.)*2.*tan(uFov*.5);
  vec3 rd=normalize(uFwd+q.x*uRight+q.y*uUp);
  vec3 col=sky(rd);
  if(rd.y<.02){
    float t=(uCam.y-8.5)/max(-rd.y,1e-3); t=max(t,0.);
    float hit=-1.;
    for(int i=0;i<56;i++){
      vec3 p=uCam+rd*t;
      float h=H(p.xz);
      float d=p.y-h;
      if(d<.02){ hit=t; break; }
      t+=max(.06,d*.55)+t*.004;
      if(t>520.) break;
    }
    if(hit>0.){
      vec3 p=uCam+rd*hit; float e=.35+hit*.004;
      float h0=H(p.xz);
      vec3 n=normalize(vec3(h0-H(p.xz+vec2(e,0.)), e, h0-H(p.xz+vec2(0.,e))));
      float dif=pow(clamp(dot(n,uSun)*.5+.5,0.,1.),3.);
      float facing=clamp(dot(n,-rd),0.,1.);
      float back=pow(max(dot(rd,uSun),0.),8.)*pow(1.-facing,4.);
      float ao=mix(.28,1.,smoothstep(-1.5,8.,h0));
      vec3 sunC=mix(vec3(.5,.24,.18), vec3(1.,.56,.3), uRise)*2.2;
      vec3 skyC=mix(vec3(.03,.035,.08), vec3(.11,.14,.27), uRise);
      vec3 c=vec3(.95,.93,.92)*(sunC*dif*ao*.8+skyC*ao*1.1)+sunC*back*2.8*uRise;
      float fog=max(1.-exp(-hit*.0042), smoothstep(300.,515.,hit));
      col=mix(c, skyHalo(normalize(vec3(rd.x,max(rd.y,.004),rd.z))), fog);
    } else col=skyHalo(normalize(vec3(rd.x,max(rd.y,.004),rd.z)));
  }
  o=vec4(col,1.);
}`;

  Deck.scene({
    id: "end",
    title: "마무리",
    bg: "#030409",
    ink: "#ffffff",
    mood: 0.4,
    transition: "dissolve",
    snapshots: true,
    beats: [
      { dur: 6.2, note: "처음에 말씀드린 것처럼, 이 발표도 AI와 대화하면서 만들었습니다.\n다만 그대로 받아쓰지 않았습니다. 장면마다 돌려 보고, 고치고, 직접 확인했습니다. 오늘 이야기한 방식 그대로입니다." },
      { dur: 4, note: "질문 받겠습니다." },
    ],
    create(ctx) {
      const { T, g } = ctx;
      const nebT = ctx.target({ scale: 0.5 }), cloudT = ctx.target({ scale: 0.5 });
      const neb = ctx.pass(Deck.lib.nebula + `void main(){ o=vec4(nebula(vUv),1.); }`, {
        uAspect: 16 / 9, uBurst: 0, uRing: 0, uWarm: 0.4, uLift: 0, uFocus: new T.Vector2(0.5, 0.6), uDrift: new T.Vector2(),
      });
      const clouds = ctx.pass(CLOUDS, {
        uAspect: 16 / 9, uRise: 0, uFov: 0.9, uCam: new T.Vector3(), uFwd: new T.Vector3(), uRight: new T.Vector3(), uUp: new T.Vector3(), uSun: new T.Vector3(),
      });
      const mix = ctx.pass(`uniform sampler2D tA, tB; uniform float uK; void main(){ o=vec4(mix(texture(tA,vUv).rgb, texture(tB,vUv).rgb, uK),1.); }`, { tA: null, tB: null, uK: 0 });
      const space = new T.Scene(); const stars = Deck.lib.stars(T, 1500, 23); space.add(stars);

      // ── 겹레이어 ──
      const head = ctx.text("이 발표도 이렇게 만들었습니다", { size: 84, weight: 300, tracking: -0.035, align: "center", valign: "middle" });
      const box = ctx.shape("rect", { fill: "#0c0f1c", fillAlpha: 0.66, stroke: "#c9d0ff", strokeAlpha: 0.16, line: 1.5, radius: 36, shadow: { y: 24, blur: 70, alpha: 0.5 } });
      const dot = ctx.shape("circle", { fill: ACCENT, glow: 0.55, glowColor: ACCENT, glowRadius: 10 });
      const prompt = ctx.text(PROMPT, { size: 36, weight: 400, color: "#e9ecf8", leading: 1.62, valign: "top", tracking: -0.01 });
      const caret = ctx.shape("rect", { fill: ACCENT, radius: 2 });
      const cap = ctx.text("그다음은 오늘 이야기한 그대로 — 돌려 보고, 고치고, 확인하고, 다시.", { size: 30, weight: 400, color: "#aab1cc", align: "center", valign: "middle" });
      const q = ctx.text("질문 있으신가요?", { size: 136, weight: 300, tracking: -0.04, valign: "middle", color: "#ffffff", shadow: { blur: 40, alpha: 0.16, y: 6, color: "#1a1020" } });
      const thanks = ctx.text("감사합니다", { size: 34, weight: 400, tracking: 0.2, valign: "middle", color: "#ffffff", shadow: { blur: 22, alpha: 0.2, y: 3, color: "#1a1020" } });
      const credit = ctx.text("형식 영감: ‘The Last Boring Slide’ (claude.ai 공개 아티팩트)  ·  글꼴: Pretendard, Geist Mono (SIL OFL)  ·  three.js (MIT)", {
        size: 19, weight: 400, valign: "middle", color: "#ffffff", shadow: { blur: 14, alpha: 0.35, y: 2, color: "#1a1020" },
      });
      const BOX = { cx: 960, cy: 400, w: 1180, h: 190 };

      // ── 필름: 앞 장면들의 스냅숏을 원근 카드로 (LDR에 직접, 색 그대로) ──
      const film = new T.Scene();
      const fcam = new T.PerspectiveCamera(28, 16 / 9, 0.1, 100);
      fcam.position.set(0, 0, 16); fcam.lookAt(0, 0, 0);
      const CW = 1.6, CH = CW * 9 / 16;
      const cardMat = () => new T.RawShaderMaterial({
        glslVersion: T.GLSL3, transparent: true, depthTest: false, depthWrite: false, side: T.DoubleSide,
        blending: T.CustomBlending, blendSrc: T.OneFactor, blendDst: T.OneMinusSrcAlphaFactor, blendSrcAlpha: T.OneFactor, blendDstAlpha: T.OneMinusSrcAlphaFactor,
        uniforms: { tA: { value: null }, uA: { value: 1 }, uGlow: { value: 0 } },
        vertexShader: `precision highp float; in vec3 position; in vec2 uv; uniform mat4 projectionMatrix, modelViewMatrix; out vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
        fragmentShader: `precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D tA; uniform float uA, uGlow;
          float box(vec2 p, vec2 b, float r){ vec2 q=abs(p)-b+r; return length(max(q,0.))+min(max(q.x,q.y),0.)-r; }
          void main(){ vec2 p=(vUv-.5)*vec2(16.,9.); float d=box(p, vec2(8.,4.5), .28); float a=1.-smoothstep(-.03,.03,d);
            float sh=(1.-smoothstep(-.2,.9,box(p-vec2(0.,-.35), vec2(8.,4.5), .5)))*.55;
            vec3 c=texture(tA, vUv).rgb; float edge=1.-smoothstep(0.,.07,abs(d)); c=mix(c, vec3(1.), edge*.35*a);
            c+=vec3(.55,.6,1.)*uGlow*(1.-a)*exp(-max(d,0.)*1.4)*.0;
            float al=a+sh*(1.-a)*.8; vec3 rgb=c*a; o=vec4(rgb, al)*uA; }`,
      });
      const cards = ORDER.map((id, i) => {
        const m = new T.Mesh(new T.PlaneGeometry(CW * 1.1, CH * 1.1), cardMat());
        m.geometry.attributes.uv.array.forEach((_, k, arr) => { if (k % 2 === 0) arr[k] = (arr[k] - 0.5) * 1.1 + 0.5; else arr[k] = (arr[k] - 0.5) * 1.1 + 0.5; });
        m.geometry.attributes.uv.needsUpdate = true;
        m.userData.id = id; film.add(m); return m;
      });
      // 카드 셰이더는 uv 0..1 밖이면 그림자만 그린다 → 플레인을 1.1배로 키우고 uv를 펼쳐 둔다
      const lay = (i) => {
        const n = ORDER.length, u = i / (n - 1) - 0.5;
        const ang = u * 1.25;
        return { x: Math.sin(ang) * 10.5, z: Math.cos(ang) * 10.5 - 10.5, y: -2.0 + u * u * 0.8, ry: -ang * 0.9, rx: -0.1 };
      };

      return {
        overlayDraw(s, ldr) {
          const a0 = s.at(0), a1 = s.at(1);
          if (a0 < 3.2 && a1 < 0) return;
          let any = false;
          cards.forEach((m, i) => {
            const tex = Deck.snapshots[m.userData.id];
            m.material.uniforms.tA.value = tex || null;
            const L = lay(i);
            const p = prog(a0, 3.3 + Math.abs(i - 4) * 0.12 + i * 0.03, 1.1, ease.out4);
            const away = a1 >= 0 ? prog(a1, 0.05 + i * 0.05, 1.2, ease.in3) : 0;
            const sx = 0, sy = 1.05, sz = 0.5;
            m.position.set(lerp(sx, L.x, p), lerp(sy, L.y, p) + away * 3.2 + Math.sin(s.time * 0.6 + i) * 0.04 * p, lerp(sz, L.z, p) + away * 2);
            m.rotation.set(L.rx * p, L.ry * p, Math.sin(s.time * 0.4 + i * 1.7) * 0.012);
            m.scale.setScalar(lerp(0.15, 1, p));
            m.material.uniforms.uA.value = clamp(p * 1.6) * (1 - away) * (tex ? 1 : 0);
            m.visible = m.material.uniforms.uA.value > 0.002;
            any = any || m.visible;
            s.cue("card" + i, a0 > 3.3 + Math.abs(i - 4) * 0.12 + i * 0.03, "tick");
          });
          if (!any) return;
          g.fit(fcam);
          g.r.setRenderTarget(ldr);
          g.r.render(film, fcam);
        },
        render(s, hdr) {
          const a0 = s.at(0), a1 = s.at(1);
          const vw = g.view, asp = g.W / g.H;
          const dawn = a1 >= 0 ? prog(a1, 0.1, 2.6, ease.inOut3) : 0;
          const rise = a1 >= 0 ? prog(a1, 0.3, 4.5, ease.out2) : 0;
          // 밤
          if (dawn < 1) {
            neb.u.uAspect.value = asp; neb.u.uTime.value = s.time + 140;
            neb.u.uDrift.value.set(s.mouse.x * 0.02 - s.time * 0.002, -s.mouse.y * 0.012 + 0.15);
            neb.u.uLift.value = 0.02 + dawn * 0.3; neb.u.uWarm.value = 0.4 + dawn;
            neb.render(nebT);
          }
          // 새벽
          if (dawn > 0) {
            const u = clouds.u;
            u.uAspect.value = asp; u.uTime.value = s.time; u.uRise.value = 0.25 + 0.75 * rise;
            const cy = 12.5 + rise * 1.5, cz = -s.time * 1.6;
            u.uCam.value.set(Math.sin(s.time * 0.05) * 2, cy, cz);
            const pitch = lerp(0.0, -0.075, rise) + s.mouse.y * -0.01, yaw = s.mouse.x * 0.02;
            const fwd = new T.Vector3(Math.sin(yaw), Math.sin(pitch), -Math.cos(yaw)).normalize();
            const right = new T.Vector3().crossVectors(fwd, new T.Vector3(0, 1, 0)).normalize();
            const up = new T.Vector3().crossVectors(right, fwd).normalize();
            u.uFwd.value.copy(fwd); u.uRight.value.copy(right); u.uUp.value.copy(up);
            const el = lerp(-0.035, 0.02, rise);
            u.uSun.value.set(0.33, Math.sin(el), -Math.cos(el)).normalize();
            u.uFov.value = (45 * Math.PI) / 180 * (asp < 16 / 9 ? (16 / 9) / asp : 1);
            clouds.render(cloudT);
          }
          if (dawn <= 0) ctx.copy(nebT, hdr);
          else if (dawn >= 1) ctx.copy(cloudT, hdr);
          else { mix.u.tA.value = nebT.texture; mix.u.tB.value = cloudT.texture; mix.u.uK.value = dawn; mix.render(hdr); }
          if (dawn < 1) {
            stars.material.uniforms.uTime.value = s.time; stars.material.uniforms.uPpu.value = g.ppu;
            stars.material.uniforms.uShift.value.set(-s.mouse.x * 14 - s.time * 1.5, -s.mouse.y * 9);
            stars.material.uniforms.uA.value = 1 - dawn;
            ctx.draw(space, ctx.ortho, hdr);
          }

          // 첫 비트: 제목 · 프롬프트 창 · 설명
          const out = a1 >= 0 ? prog(a1, 0, 0.9, ease.inOut3) : 0;
          head.show(prog(a0, 0.1, 1.3, ease.linear), { style: "rise", stagger: 0.35, out: a1 >= 0 ? prog(a1, 0, 0.8, ease.linear) : 0, outStyle: "blur" });
          head.at(960, 205 - out * 30);
          const bIn = prog(a0, 0.4, 0.9, ease.out4);
          const ba = bIn * (1 - out);
          const by = BOX.cy - out * 40 + (1 - bIn) * 24;
          box.center(BOX.cx, by, BOX.w * lerp(0.94, 1, bIn), BOX.h).alpha(ba);
          dot.circle(BOX.cx - BOX.w / 2 + 52, by - BOX.h / 2 + 62, 7 * (0.8 + 0.2 * Math.sin(s.time * 3))).alpha(ba);
          const tt = a0 - 1.0, CPS = 15;
          const nT = clamp(Math.floor(tt * CPS), 0, prompt.n);
          s.ticks("type", nT, "key");
          prompt.at(BOX.cx - BOX.w / 2 + 96, by - BOX.h / 2 + 36);
          prompt.alpha = ba;
          prompt.animate((gl, o) => { const k = clamp((tt * CPS - gl.n) * 2.5); o.alpha = k; o.dy = (1 - ease.out3(k)) * 8; });
          if (ba > 0.5) {
            const cp = prompt.caret(clamp(Math.ceil(tt * CPS), 0, prompt.n));
            const on = nT < prompt.n || Math.floor(s.time * 1.9) % 2 === 0;
            caret.rect(cp.x + 4, cp.y - 22, 3, 44).alpha(on ? ba : 0);
          } else caret.alpha(0);
          cap.at(960, 948 - out * 30).show(prog(a0, 4.8, 1.0, ease.linear), { style: "blur", stagger: 0.5, out: out });
          s.cue("films", a0 > 3.3, "sweep", { up: true, dur: 0.8 });

          // 둘째 비트: 질문
          const qa = a1 >= 0 ? prog(a1, 1.1, 1.6, ease.linear) : 0;
          q.at(120, 300).show(qa, { style: "blur", stagger: 0.4 });
          thanks.at(124, 420).show(a1 >= 0 ? prog(a1, 2.1, 1.2, ease.linear) : 0, { style: "fade", stagger: 0.3 });
          credit.at(120, 1022).show(a1 >= 0 ? prog(a1, 2.6, 1.2, ease.linear) : 0, { style: "fade", stagger: 0.2 });
          credit.alpha = 0.78;
          s.cue("dawn", a1 > 0.2, "swell", { root: 53, vol: 0.07 });
          s.cue("q", a1 > 1.2, "shimmer", { vol: 0.04 });

          const night = 1 - dawn;
          return {
            bloom: lerp(0.6, 0.55, dawn), threshold: lerp(0.7, 1.2, dawn), exposure: lerp(1.05, 0.9, dawn), vignette: lerp(0.45, 0.32, dawn),
            grain: lerp(0.045, 0.032, dawn), ca: 0.4 * night, contrast: lerp(1.05, 1.08, dawn), saturation: lerp(1.06, 1.14, dawn), warm: dawn * 0.15,
          };
        },
      };
    },
  });
})();
