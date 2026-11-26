// 06 · 어디에 쓰면 좋을까
// 아침 햇살이 창틀 모양으로 비스듬히 떨어지는 종이 벽. 카드가 종이처럼 내려앉고(잘 맞는 일 → 조심할 일),
// 마지막 비트에서 여덟 장이 "틀렸을 때 치르는 비용" 축 위로 다시 늘어선다.
// 벽·햇빛·그림자는 HDR 셰이더 한 장, 카드는 글자를 구워 넣은 종이 한 장씩(겹칠 때도 글자가 엉키지 않게) 같은 햇빛을 받는다.
(() => {
  const { clamp, lerp, ease, prog, hash, lin } = Deck.util;
  const INK = "#17181c", MUTED = "#6b6e78", GOOD = "#1f8a5b", WARN = "#c2410c";
  const CARDS = [
    // [제목, 설명, 종류(0 잘 맞음 · 1 조심), 비용 순위(1 낮음 ~ 8 높음)]
    ["프로토타입", "아이디어를 빨리 눈으로 확인", 0, 2],
    ["사내 도구", "쓰는 사람이 적고 고치기 쉬움", 0, 4],
    ["일회성 스크립트", "한 번 돌리고 버리는 코드", 0, 1],
    ["학습과 탐색", "처음 보는 라이브러리 익히기", 0, 3],
    ["인증 · 보안", "작은 실수가 큰 사고로", 1, 8],
    ["결제 · 개인정보", "틀리면 되돌리기 어려움", 1, 7],
    ["대규모 레거시", "맥락이 코드 밖에 있음", 1, 5],
    ["규제 대상 시스템", "설명할 책임이 따름", 1, 6],
  ];
  const W0 = 800, H0 = 118, W1 = 330, K1 = 0.8;
  const AX = { x0: 120, x1: 1800, y: 800 };
  const rankX = (r) => 262 + (r - 1) * 199;
  const rankY = (r) => (r % 2 ? 490 : 630);
  const slot0 = (i) => [(i < 4 ? 120 : 1000) + W0 / 2, 389 + (i % 4) * 140];

  // 햇빛(창틀 + 잎 그림자): 벽과 카드가 같은 식을 쓴다
  const SUN = Deck.glsl.noise + Deck.glsl.sdf + /* glsl */ `
const vec3 AMB=vec3(.845,.842,.835); const vec3 SUNC=vec3(1.,.92,.78)*.235;
float sunAt(vec2 p, float t){
  vec2 lp=rot2(-.5)*(p-vec2(1010.,-150.)); lp.x+=lp.y*.42;
  const vec2 pane=vec2(300.,360.); const float mul=26.;
  vec2 cs=pane+mul; vec2 f=fract(lp/cs)*cs;
  float bl=7.+clamp(lp.y,0.,2000.)*.028;
  float px=smoothstep(mul*.5-bl,mul*.5+bl,f.x)*smoothstep(mul*.5-bl,mul*.5+bl,cs.x-f.x);
  float py=smoothstep(mul*.5-bl,mul*.5+bl,f.y)*smoothstep(mul*.5-bl,mul*.5+bl,cs.y-f.y);
  float outer=1.-smoothstep(-bl,bl,sdBox2(lp-cs, cs-vec2(mul*.5)));
  vec2 sw=vec2(sin(t*.37)*.05+sin(t*1.13)*.015, cos(t*.29)*.04);
  float lf=fbm(lp*.0085+sw+4.);
  float leaf=smoothstep(.52,.68,lf)*.7+smoothstep(.6,.72,fbm(lp*.02+sw*2.+9.))*.25;
  return outer*px*py*(1.-min(leaf,.85));
}`;

  const FRAG = SUN + /* glsl */ `
uniform vec4 uView; uniform float uPx;
uniform vec4 uCard[8]; uniform vec4 uCardB[8];
uniform vec3 uGood, uWarn; uniform vec4 uAxis;
// rot2(a)*v 는 v를 -a만큼 돌린다 → 카드 좌표로 되돌리기
float sdc(vec2 p, int i){ vec4 a=uCard[i], b=uCardB[i]; vec2 q=rot2(a.z)*(p-a.xy); return sdRound2(q, b.xy, 14.); }
void main(){
  vec2 p=vec2(uView.x+vUv.x*uView.z, uView.y+(1.-vUv.y)*uView.w);
  float fib=vnoise(p*vec2(.9,.22))*.5+vnoise(p*.35)*.5;
  vec3 paper=vec3(.93,.912,.876)*(.982+.03*(fbm(p*.004)-.5)+.016*(fib-.5));
  float sun=sunAt(p,uTime);
  float ao=0., sh=0.;
  for(int i=0;i<8;i++){
    vec4 a=uCard[i], b=uCardB[i]; if(a.w<.002) continue;
    float lift=b.z;
    float d1=sdc(p-vec2(3.+lift*.16, 7.+lift*.4), i);
    ao=1.-(1.-ao)*(1.-.17*a.w*clamp(1.-lift/700.,0.,1.)*(1.-smoothstep(-14.-lift*.3, 16.+lift*.55, d1)));
    float d2=sdc(p-vec2(1.,1.3)*(8.+lift*.85), i);
    sh=1.-(1.-sh)*(1.-.9*a.w*(1.-smoothstep(-3.-lift*.12, 4.+lift*.2, d2)));
  }
  vec3 col=paper*(AMB*(1.-ao)+SUNC*sun*(1.-sh));
  if(uAxis.w>0.){
    float x0=uAxis.x, x1=uAxis.y, y=uAxis.z, dr=uAxis.w;
    float xe=mix(x0,x1,clamp(dr,0.,1.));
    float dl=sdSeg(p, vec2(x0,y), vec2(xe,y));
    float ah=clamp((dr-.96)/.04,0.,1.);
    float da=min(sdSeg(p, vec2(x1,y), vec2(x1-20.*ah,y-12.*ah)), sdSeg(p, vec2(x1,y), vec2(x1-20.*ah,y+12.*ah)));
    float d=min(dl, mix(1e5,da,step(.001,ah)))-2.2;
    float k=clamp((p.x-x0)/(x1-x0),0.,1.);
    vec3 ink=mix(uGood, uWarn, smoothstep(.15,.85,k));
    col=mix(col, ink*(AMB+SUNC*sun*.6), 1.-smoothstep(-uPx,uPx,d));
  }
  o=vec4(col,1.);
}`;

  // 카드 한 장(겹레이어): 종이 + 색 띠 + 구워 둔 글자, 벽과 같은 햇빛
  const CVERT = /* glsl */ `precision highp float;
in vec3 position; uniform mat4 projectionMatrix, modelViewMatrix; uniform vec4 uBox; uniform float uRot; out vec2 vL;
void main(){ vec2 q=position.xy*(uBox.zw+vec2(4.)); vL=q; float s=sin(uRot), c=cos(uRot);
  vec2 p=uBox.xy+vec2(q.x*c-q.y*s, q.x*s+q.y*c); gl_Position=projectionMatrix*modelViewMatrix*vec4(p,0.,1.); }`;
  const CFRAG = SUN + Deck.glsl.color + /* glsl */ `
in vec2 vL; out vec4 o;
uniform sampler2D tText; uniform vec4 uBox; uniform float uRot, uK, uA, uPx, uLift; uniform vec3 uStrip; uniform vec2 uTex;
void main(){
  vec2 hb=uBox.zw*.5;
  float d=sdRound2(vL, hb, 14.*uK);
  float m=1.-smoothstep(-uPx,uPx,d);
  if(m*uA<=.001) discard;
  vec3 c=vec3(.995,.99,.982);
  float strip=1.-smoothstep(-uPx,uPx,(vL.x+hb.x)-9.*uK);
  c=mix(c, uStrip, strip);
  c*=1.-smoothstep(-5.,-.5,d)*.06;
  c*=1.+.03*smoothstep(-hb.y,-hb.y+30.,-vL.y);
  float s=sin(uRot), cs=cos(uRot);
  vec2 wp=uBox.xy+vec2(vL.x*cs-vL.y*s, vL.x*s+vL.y*cs);
  vec3 lc=AMB*(1.+uLift*.0004)+SUNC*sunAt(wp,uTime);
  vec3 rgb=toSrgb(c*lc);
  vec2 uv=(vL+hb)/uK/uTex;
  vec4 tx=(uv.x>0.&&uv.x<1.&&uv.y>0.&&uv.y<1.)?texture(tText,uv):vec4(0.);
  rgb=mix(rgb, tx.rgb, tx.a);
  o=vec4(rgb*m*uA, m*uA);
}`;

  Deck.scene({
    id: "fit",
    title: "어디에 쓰면 좋을까",
    bg: "#efe9df",
    ink: "#1a1a1f",
    mood: 0.5,
    transition: "wipe",
    beats: [
      { dur: 2.2, note: "그럼 어디에 쓰면 좋을까요. 먼저 잘 맞는 일들입니다.\n공통점은 빨리 만들어 보는 게 중요하고, 틀려도 금방 고칠 수 있다는 것입니다." },
      { dur: 2.0, note: "반대로 조심해야 할 일들입니다. 코드가 그럴듯해 보여도, 틀렸을 때 피해가 크거나 되돌리기 어렵습니다." },
      { dur: 3.2, note: "그래서 기준은 하나로 정리됩니다. 이 코드가 틀렸을 때 치르는 비용이 얼마인가.\n비용이 작으면 과감하게, 크면 더 꼼꼼하게 확인합니다." },
    ],
    create(ctx) {
      const { T, g } = ctx;
      const bg = ctx.pass(FRAG, {
        uView: new T.Vector4(), uPx: 1, uGood: new T.Vector3(...lin(GOOD)), uWarn: new T.Vector3(...lin(WARN)), uAxis: new T.Vector4(),
        uCard: { value: Array.from({ length: 8 }, () => new T.Vector4()) }, uCardB: { value: Array.from({ length: 8 }, () => new T.Vector4()) },
      });
      const U = bg.u; // pass가 {value}로 감싼 유니폼

      // 카드: 글자를 미리 구운 캔버스 + 셰이더 종이
      const PPU = 2.5;
      const QUAD = new T.BufferGeometry();
      QUAD.setAttribute("position", new T.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
      QUAD.setIndex([0, 1, 2, 0, 2, 3]);
      const cards = CARDS.map(([title, sub, kind]) => {
        const cv = document.createElement("canvas"); cv.width = W0 * PPU; cv.height = H0 * PPU;
        const c = cv.getContext("2d"); c.scale(PPU, PPU); c.textBaseline = "alphabetic";
        const font = Deck.text.fontOf;
        c.font = font(38, 600, "sans"); c.fillStyle = INK; if ("letterSpacing" in c) c.letterSpacing = "-0.5px"; c.fillText(title, 46, 48);
        c.font = font(25, 400, "sans"); c.fillStyle = MUTED; if ("letterSpacing" in c) c.letterSpacing = "0px"; c.fillText(sub, 46, 90);
        const tex = new T.CanvasTexture(cv);
        Object.assign(tex, { flipY: false, generateMipmaps: true, minFilter: T.LinearMipmapLinearFilter, magFilter: T.LinearFilter, anisotropy: 4 });
        tex.colorSpace = T.NoColorSpace;
        const mat = new T.RawShaderMaterial({
          glslVersion: T.GLSL3, vertexShader: CVERT, fragmentShader: "precision highp float; precision highp int;\nuniform float uTime;\n" + CFRAG,
          transparent: true, depthTest: false, depthWrite: false, side: T.DoubleSide,
          blending: T.CustomBlending, blendSrc: T.OneFactor, blendDst: T.OneMinusSrcAlphaFactor, blendSrcAlpha: T.OneFactor, blendDstAlpha: T.OneMinusSrcAlphaFactor,
          uniforms: {
            tText: { value: tex }, uBox: { value: new T.Vector4() }, uRot: { value: 0 }, uK: { value: 1 }, uA: { value: 0 }, uPx: { value: 1 }, uLift: { value: 0 },
            uStrip: { value: new T.Vector3(...lin(kind ? WARN : GOOD)) }, uTex: { value: new T.Vector2(W0, H0) }, uTime: { value: 0 },
          },
        });
        const mesh = new T.Mesh(QUAD, mat); mesh.frustumCulled = false;
        ctx.overlay.add(mesh);
        return { mesh, u: mat.uniforms };
      });

      const head0 = ctx.text("어디에 쓰면 좋을까", { size: 96, weight: 400, tracking: -0.035, color: INK });
      const head1 = ctx.text([{ t: "기준은 하나: " }, { t: "틀렸을 때 치르는 비용", color: WARN, weight: 500 }], { size: 84, weight: 400, tracking: -0.035, color: INK });
      const colHead = [ctx.text("잘 맞는 일", { size: 40, weight: 600, color: GOOD, tracking: -0.01 }), ctx.text("조심할 일", { size: 40, weight: 600, color: WARN, tracking: -0.01 })];
      const dashes = CARDS.map(([, , k]) => ctx.shape("line", { stroke: k ? WARN : GOOD, strokeAlpha: 0.55, line: 2, dash: 9 }));
      const dots = CARDS.map(([, , k]) => ctx.shape("circle", { fill: k ? WARN : GOOD, stroke: "#ffffff", line: 3 }));
      const low = ctx.text([{ t: "작다 · ", color: MUTED, weight: 500 }, { t: "과감하게", color: GOOD, weight: 600 }], { size: 30, tracking: -0.01 });
      const high = ctx.text([{ t: "꼼꼼하게", color: WARN, weight: 600 }, { t: " · 크다", color: MUTED, weight: 500 }], { size: 30, tracking: -0.01, align: "right" });

      // 카드 상태: 시간에 대한 순수 함수
      const moveOf = (a2, rank) => prog(a2, 0.2 + (rank - 1) * 0.07, 1.05, ease.inOut3);
      function cardState(s, i) {
        const [, , kind, rank] = CARDS[i];
        const a = s.at(kind), a2 = s.at(2);
        const delay = 0.3 + (i % 4) * 0.16, t = a - delay;
        if (a < 0 || t <= 0) return null;
        // 내려앉기: 보는 쪽으로 살짝 들려 크게 보이다가 제자리에 눕는다
        const q = clamp(t / 0.7), e = ease.out3(q);
        let [cx, cy] = slot0(i);
        const r0 = (hash(i * 3.7) - 0.5) * 0.12 + (kind ? -0.035 : 0.035);
        const land = Math.max(0, t - 0.7);
        let rot = r0 * (1 - e) + 0.008 * Math.exp(-land * 7) * Math.sin(land * 16) * (t > 0.7 ? 1 : 0);
        cy -= (1 - e) * 26; cx += (1 - e) * (kind ? 16 : -16);
        const kd = lerp(1.08, 1, e);
        let lift = (1 - e) * 170, w = W0 * kd, k = kd;
        const alpha = clamp(t * 5);
        // 3비트: 비용 축 위로 다시 늘어선다
        if (a2 > 0) {
          const m = moveOf(a2, rank), arc = Math.sin(Math.PI * m), as = 1 + arc * 0.04;
          cx = lerp(cx, rankX(rank), m); cy = lerp(cy, rankY(rank), m) - arc * 24;
          w = lerp(W0, W1, m) * kd * as; k = lerp(kd, K1, m) * as;
          rot = lerp(rot, 0, m) + arc * (hash(i * 9.1) - 0.5) * 0.08;
          lift = Math.max(lift, arc * 110);
        }
        return { cx, cy, w, h: H0 * k, k, rot, lift, alpha, kind, rank, land: t > 0.7 };
      }

      return {
        render(s, hdr) {
          const vw = g.view, px = 1 / Math.max(0.25, g.ppu), time = s.time + 30;
          U.uView.value.set(vw.x0, vw.y0, vw.w, vw.h); U.uPx.value = px; U.uTime.value = time;
          const a2 = s.at(2);
          const st = CARDS.map((_, i) => cardState(s, i));
          st.forEach((c, i) => {
            const A = U.uCard.value[i], B = U.uCardB.value[i], cu = cards[i].u;
            if (!c) { A.set(0, 0, 0, 0); B.set(1, 1, 0, 0); cu.uA.value = 0; cards[i].mesh.visible = false; return; }
            A.set(c.cx, c.cy, c.rot, c.alpha); B.set(c.w / 2, c.h / 2, c.lift, c.kind);
            cards[i].mesh.visible = true;
            cu.uBox.value.set(c.cx, c.cy, c.w, c.h); cu.uRot.value = c.rot; cu.uK.value = c.k; cu.uA.value = c.alpha;
            cu.uPx.value = px * 1.1; cu.uLift.value = c.lift; cu.uTime.value = time;
            cards[i].mesh.renderOrder = 2 + i * 0.01 + c.lift * 0.001;
          });
          U.uAxis.value.set(AX.x0, AX.x1, AX.y, prog(a2, 0.85, 1.0, ease.inOut3));
          bg.render(hdr);

          // 제목
          const outA = s.p(2, 0, 0.55, ease.linear);
          head0.at(120, 178).show(s.p(0, 0.05, 0.9, ease.linear), { style: "rise", stagger: 0.35, out: outA });
          head1.at(120, 178).show(s.p(2, 0.25, 1.0, ease.linear), { style: "rise", stagger: 0.3 });
          colHead[0].at(120, 296).show(s.p(0, 0.12, 0.6, ease.linear), { style: "rise", out: outA });
          colHead[1].at(1000, 296).show(s.p(1, 0.02, 0.6, ease.linear), { style: "rise", out: outA });

          st.forEach((c, i) => {
            if (!c) { dashes[i].alpha(0); dots[i].alpha(0); return; }
            s.cue("land" + i, c.land, "stamp", { vol: 0.16 });
            const dq = prog(a2, 1.55 + c.rank * 0.05, 0.5, ease.out3);
            if (dq > 0) {
              const y0 = c.cy + c.h / 2 + 6, y1 = lerp(y0, AX.y - 9, dq);
              dashes[i].path([[c.cx, y0], [c.cx, y1]]).alpha(0.9);
              const dp = prog(a2, 1.9 + c.rank * 0.05, 0.4, ease.linear);
              dots[i].circle(c.cx, AX.y, Math.max(0.01, 8 * ease.outBack(dp, 2.4))).alpha(clamp(dp * 4));
            } else { dashes[i].alpha(0); dots[i].alpha(0); }
          });
          low.at(AX.x0, AX.y + 64).show(s.p(2, 1.7, 0.7, ease.linear), { style: "rise", stagger: 0.3 });
          high.at(AX.x1, AX.y + 64).show(s.p(2, 1.9, 0.7, ease.linear), { style: "rise", stagger: 0.3 });

          s.cue("axis", a2 > 0.85, "sweep", { up: true, dur: 0.9 });
          s.cue("move", a2 > 0.2, "whoosh", { up: true, dur: 0.8 });
          s.cue("dots", a2 > 1.9, "chime", { note: 76, vol: 0.06 });
          return { tone: "none", exposure: 1.0, bloom: 0.05, threshold: 1.1, knee: 0.3, vignette: 0.15, grain: 0.022, warm: 0.1, contrast: 1.02, saturation: 1.02 };
        },
      };
    },
  });
})();
