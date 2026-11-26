// 07 · 작은 오차는 쌓인다
// 별이 가득한 밤, 젖은 소금 사막. 지평선 끝에 목적지를 알리는 빛기둥이 서 있다.
// 1비트: 확인 없이 그린 붉은 빛의 궤적이 조금씩 휘어 어둠 속으로 멀어진다.
// 2비트: 길 위에 청록빛 확인 관문이 켜지고, 초록 궤적이 관문을 지날 때마다 의도한 길로 돌아와 빛기둥에 닿는다.
// 궤적·관문·빛기둥은 젖은 바닥에 비치고(거울상 + 반사율), 바닥은 위에서 본 빛 지도(캔버스)를 받아 궤적 둘레가 물든다.
(() => {
  const { clamp, lerp, ease, prog, rng } = Deck.util;
  const RED = [1.0, 0.26, 0.11], GREEN = [0.22, 1.0, 0.62], GATE = [0.25, 1.0, 0.85], BEACON = [1.0, 0.86, 0.66];
  const Z0 = 2, STEP = 0.4, N = 262;
  const ZEND = Z0 - STEP * N;          // 빛기둥 위치(약 -103)
  const GATES = [-22, -48, -74];
  const GATE_NAMES = ["테스트", "직접 실행", "코드 리뷰"];
  const GW = 2.5, GH = 2.7;             // 관문 반폭 · 높이

  // 같은 잡음으로 두 길을 만든다. guarded면 관문마다 의도한 방향(x=0)으로 다시 꺾는다.
  function makePath(guarded) {
    const r = rng(9), pts = [[0, Z0]];
    let ang = 0, x = 0, z = Z0, gi = 0;
    for (let i = 0; i < N; i++) {
      ang += (r() - 0.5) * 0.05 + 0.0021;
      if (guarded) {
        const zg = gi < GATES.length ? GATES[gi] : ZEND;
        const dz = z - zg;
        // 관문 앞 몇 걸음 동안 의도한 길(x=0)로 부드럽게 돌아와 관문을 정확히 지난다
        if (dz < 7 && dz > 0) ang = lerp(ang, Math.atan2(-x, Math.max(dz, 0.6)), 0.3);
        if (dz <= 0 && gi < GATES.length) { gi++; ang *= 0.15; }
      }
      ang = clamp(ang, -0.62, 0.62);
      x += Math.sin(ang) * STEP; z -= Math.cos(ang) * STEP;
      pts.push([x, z]);
    }
    return pts;
  }
  const FREE = makePath(false), SAFE = makePath(true);
  // 진행도(0..1) → 길 위의 점
  const at = (pts, p) => {
    const f = clamp(p) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), k = f - i;
    return [lerp(pts[i][0], pts[i + 1][0], k), lerp(pts[i][1], pts[i + 1][1], k)];
  };
  // 진행도에서 z가 처음으로 zg를 넘는 지점의 진행도
  const passP = (pts, zg) => { for (let i = 0; i < pts.length; i++) if (pts[i][1] <= zg) return i / (pts.length - 1); return 1; };
  const GATE_P = GATES.map((z) => passP(SAFE, z));

  const SKY = Deck.glsl.noise + Deck.glsl.color + /* glsl */ `
uniform vec3 uF, uR, uU; uniform float uTan, uAsp; uniform vec2 uBeacon; uniform float uBeam;
void main(){
  vec2 q=vUv*2.-1.;
  vec3 rd=normalize(uF+q.x*uAsp*uTan*uR+q.y*uTan*uU);
  float y=rd.y;
  vec3 c=mix(vec3(.030,.040,.085), vec3(.006,.009,.026), smoothstep(.0,.35,y));
  c=mix(c, vec3(.002,.003,.010), smoothstep(.3,.9,y));
  c+=vec3(.10,.055,.05)*exp(-max(y,0.)*26.)*.9;             // 지평선 아래쪽 옅은 잔광
  // 은하수: 비스듬한 띠
  vec3 mw=normalize(vec3(.55,.62,-.56));
  float band=exp(-pow(dot(rd,mw)/.16,2.));
  float dust=fbm(vec2(atan(rd.x,-rd.z)*5.,rd.y*8.)+3.);
  c+=vec3(.055,.06,.10)*band*(.4+.9*dust)*smoothstep(.02,.2,y);
  c*=1.-band*.35*smoothstep(.55,.8,fbm(vec2(atan(rd.x,-rd.z)*11.,rd.y*16.)));
  // 별
  vec2 sp=vec2(atan(rd.x,-rd.z), asin(clamp(rd.y,-1.,1.)))*vec2(320.,320.);
  for(int l=0;l<2;l++){
    vec2 g=sp*(l==0?1.:.55); vec2 id=floor(g), f=fract(g)-.5;
    vec3 h=hash32(id+float(l)*17.);
    float on=step(l==0?.965:.9, h.x);
    float tw=.6+.4*sin(uTime*(1.5+h.y*3.)+h.z*30.);
    float sz=l==0?.06:.11;
    c+=vec3(.78,.84,1.)*on*tw*smoothstep(sz,0.,length(f-(h.yz-.5)*.6))*(l==0?1.4:3.0)*(.4+.6*h.z)*smoothstep(-.01,.08,y);
  }
  // 빛기둥 주변의 퍼진 빛
  vec2 bq=(vUv-uBeacon)*vec2(uAsp,1.);
  c+=vec3(1.,.82,.62)*uBeam*(exp(-abs(bq.x)*30.)*exp(-max(bq.y,0.)*1.8)*step(0.,bq.y)*.3+exp(-length(bq)*10.)*.35);
  o=vec4(c,1.);
}`;

  // 바닥: 소금 결정(보로노이) + 젖은 반사 + 위에서 본 빛 지도
  const GROUND_V = /* glsl */ `precision highp float;
in vec3 position; uniform mat4 modelMatrix, viewMatrix, projectionMatrix; out vec3 vW;
void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`;
  const GROUND_F = Deck.glsl.noise + Deck.glsl.color + /* glsl */ `
in vec3 vW; out vec4 o; uniform vec3 cameraPosition; uniform sampler2D tLight; uniform vec4 uMap; uniform float uTime, uBeam; uniform vec3 uBeaconP;
vec3 skyR(vec3 rd){ float y=max(rd.y,0.); vec3 c=mix(vec3(.030,.040,.085), vec3(.006,.009,.026), smoothstep(.0,.35,y)); return c+vec3(.10,.055,.05)*exp(-y*26.)*.9; }
void main(){
  vec3 V=normalize(vW-cameraPosition);
  float dist=length(vW-cameraPosition);
  vec2 xz=vW.xz;
  vec3 vo=voronoi(xz*.62);
  float ridge=(1.-smoothstep(.0,.06,vo.y))*(.55+.45*smoothstep(4.,30.,dist));
  float wet=smoothstep(.35,.75,fbm(xz*.06+4.));
  vec3 crust=vec3(.013,.016,.026)*(.75+.5*vo.z)+vec3(.032,.038,.056)*ridge*(1.-wet*.7);
  // 빛 지도(궤적이 땅을 물들임)
  vec2 muv=(xz-uMap.xy)/uMap.zw;
  vec3 L=texture(tLight, muv).rgb*step(0.,muv.x)*step(muv.x,1.)*step(0.,muv.y)*step(muv.y,1.);
  crust+=L*(.55+.9*ridge)*(1.-.5*wet);
  // 빛기둥 둘레
  vec2 bd=xz-uBeaconP.xz; crust+=vec3(1.,.82,.62)*uBeam*exp(-length(bd)*.22)*.22;
  // 젖은 곳일수록, 비스듬히 볼수록 거울처럼
  float fre=pow(1.-abs(V.y),4.);
  float refl=clamp((.22+.6*wet)*(.35+.65*fre),0.,.92);
  vec3 R=reflect(V,vec3(0,1,0));
  vec3 sky=skyR(R);
  // 빛기둥이 젖은 바닥에 길게 비친다
  vec3 tb=uBeaconP-vW; float lb=length(tb.xz);
  vec2 r2=normalize(R.xz+1e-5), b2=tb.xz/max(lb,1e-3);
  float side=abs(r2.x*b2.y-r2.y*b2.x)*lb;
  float hb=R.y*lb/max(length(R.xz),1e-3);
  float streak=exp(-side*side/(.18+lb*.004))*step(0.,dot(r2,b2))*smoothstep(0.,.8,hb)*exp(-hb*.045);
  sky+=vec3(1.,.84,.64)*streak*uBeam*2.6*(.5+.5*wet);
  vec3 col=mix(crust, sky, refl*.85);
  // 멀리 갈수록 지평선 빛과 섞인다
  float fog=1.-exp(-dist*.011);
  col=mix(col, vec3(.035,.035,.07)+vec3(.10,.055,.05)*.6, fog*.85);
  o=vec4(col, 1.-refl*(1.-fog));
}`;

  // 궤적: 튜브의 길이 방향 uv.x로 그려진 만큼만 보이고, 머리가 가장 밝다
  const TRAIL_V = /* glsl */ `precision highp float;
in vec3 position; in vec2 uv; uniform mat4 modelMatrix, viewMatrix, projectionMatrix; out float vS;
void main(){ vS=uv.x; gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.); }`;
  const TRAIL_F = /* glsl */ `precision highp float;
in float vS; out vec4 o; uniform float uProg, uGain, uHead; uniform vec3 uColor;
void main(){ if(vS>uProg) discard; float h=exp(-(uProg-vS)*90.)*uHead; float tail=.65+.35*smoothstep(0.,.2,vS); o=vec4(uColor*(tail+h*5.)*uGain,1.); }`;

  const GLOW_V = /* glsl */ `precision highp float;
in vec3 position; uniform mat4 modelViewMatrix, projectionMatrix; out vec2 vP;
void main(){ vP=position.xy*2.; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
  const GLOW_F = /* glsl */ `precision highp float;
in vec2 vP; out vec4 o; uniform vec3 uColor; uniform float uGain;
void main(){ float r=length(vP); float a=exp(-r*r*7.)+.25*exp(-r*2.6)*(1.-smoothstep(.8,1.,r)); o=vec4(uColor*a*uGain,1.); }`;

  const BEAM_V = /* glsl */ `precision highp float;
in vec3 position; in vec3 normal; uniform mat4 modelMatrix, viewMatrix, projectionMatrix; uniform vec3 cameraPosition; out float vY; out float vF;
void main(){ vec4 w=modelMatrix*vec4(position,1.); vY=position.y; vec3 n=normalize(mat3(modelMatrix)*normal); vec3 v=normalize(cameraPosition-w.xyz); vF=abs(dot(n,v)); gl_Position=projectionMatrix*viewMatrix*w; }`;
  const BEAM_F = /* glsl */ `precision highp float;
in float vY; in float vF; out vec4 o; uniform vec3 uColor; uniform float uGain, uH;
void main(){ float k=clamp(vY/uH+.5,0.,1.); float a=pow(vF,2.5)*(1.-k)*(1.-k)*smoothstep(0.,.02,k); o=vec4(uColor*a*uGain,1.); }`;

  const GATE_F = /* glsl */ `precision highp float;
in float vS; out vec4 o; uniform float uGain; uniform vec3 uColor;
void main(){ o=vec4(uColor*uGain,1.); }`;
  const CURTAIN_V = /* glsl */ `precision highp float;
in vec3 position; in vec2 uv; uniform mat4 modelMatrix, viewMatrix, projectionMatrix; out vec2 vUv;
void main(){ vUv=uv; gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.); }`;
  const CURTAIN_F = /* glsl */ `precision highp float;
in vec2 vUv; out vec4 o; uniform float uGain, uTime; uniform vec3 uColor;
void main(){ float scan=.5+.5*sin(vUv.y*70.-uTime*6.); float edge=smoothstep(.75,1.,abs(vUv.x*2.-1.));
  o=vec4(uColor*uGain*(.3+.7*edge)*(.55+.45*scan)*(1.-vUv.y*.5),1.); }`;

  Deck.scene({
    id: "drift",
    title: "작은 오차는 쌓인다",
    bg: "#04050a",
    ink: "#ffffff",
    mood: 0.45,
    transition: "dissolve",
    beats: [
      { dur: 5.6, note: "AI가 만든 결과는 대부분 거의 맞습니다. 문제는 그 '거의'입니다.\n조금 어긋난 결과가 다음 요청의 출발점이 되고, 어긋남이 계속 쌓입니다." },
      { dur: 6.0, note: "그래서 중간중간 확인 지점이 필요합니다. 테스트, 직접 실행해 보기, 코드 리뷰.\n확인할 때마다 길이 다시 의도한 쪽으로 돌아옵니다." },
    ],
    create(ctx) {
      const { T, g } = ctx;
      const raw = (vs, fs, u, extra = {}) => new T.RawShaderMaterial({
        glslVersion: T.GLSL3, vertexShader: vs, fragmentShader: fs.startsWith("precision") ? fs : "precision highp float; precision highp int;\n" + fs,
        uniforms: u, transparent: true, depthWrite: false, blending: T.AdditiveBlending, ...extra,
      });
      const cam = ctx.camera(40, 0.1, 600);
      const fwd = new T.Vector3(), right = new T.Vector3(), up = new T.Vector3(), Y = new T.Vector3(0, 1, 0);

      // ── 하늘 ──
      const sky = ctx.pass(SKY, { uF: new T.Vector3(), uR: new T.Vector3(), uU: new T.Vector3(), uTan: 0.36, uAsp: 16 / 9, uBeacon: new T.Vector2(0.5, 0.6), uBeam: 0 });

      // ── 빛 지도 (위에서 본 궤적 빛) ──
      const MAP = { x0: -44, z0: ZEND - 14, w: 88, h: Z0 - (ZEND - 14) + 8 };
      const LW = 160, LH = Math.round((LW * MAP.h) / MAP.w);
      const lcv = document.createElement("canvas"); lcv.width = LW; lcv.height = LH;
      const lc = lcv.getContext("2d");
      const ltex = new T.CanvasTexture(lcv);
      Object.assign(ltex, { flipY: false, generateMipmaps: false, minFilter: T.LinearFilter, magFilter: T.LinearFilter });
      ltex.colorSpace = T.NoColorSpace;
      const toMap = ([x, z]) => [((x - MAP.x0) / MAP.w) * LW, ((z - MAP.z0) / MAP.h) * LH];
      const rgb = (c, k) => `rgb(${Math.round(clamp(c[0] * k) * 255)},${Math.round(clamp(c[1] * k) * 255)},${Math.round(clamp(c[2] * k) * 255)})`;
      function strokePath(pts, p, col, k) {
        const n = Math.max(1, Math.floor(clamp(p) * (pts.length - 1)));
        if (p <= 0) return;
        lc.lineCap = "round"; lc.lineJoin = "round";
        [[9, 0.05], [5, 0.1], [2.4, 0.22], [1.1, 0.45]].forEach(([w, a]) => {
          lc.globalAlpha = a; lc.strokeStyle = rgb(col, k); lc.lineWidth = w;
          lc.beginPath(); const s0 = toMap(pts[0]); lc.moveTo(s0[0], s0[1]);
          for (let i = 1; i <= n; i++) { const q = toMap(pts[i]); lc.lineTo(q[0], q[1]); }
          const hd = toMap(at(pts, p)); lc.lineTo(hd[0], hd[1]); lc.stroke();
        });
        lc.globalAlpha = 1;
      }
      let mapKey = "";

      // ── 바닥 ──
      const groundMat = new T.RawShaderMaterial({
        glslVersion: T.GLSL3, vertexShader: GROUND_V, fragmentShader: "precision highp float; precision highp int;\n" + GROUND_F,
        uniforms: { tLight: { value: ltex }, uMap: { value: new T.Vector4(MAP.x0, MAP.z0, MAP.w, MAP.h) }, uTime: { value: 0 }, uBeam: { value: 0 }, uBeaconP: { value: new T.Vector3(0, 0, ZEND) } },
        transparent: true, depthWrite: true,
      });
      const ground = new T.Mesh(new T.PlaneGeometry(900, 900), groundMat);
      ground.rotation.x = -Math.PI / 2; ground.position.z = -300;
      const groundScene = new T.Scene(); groundScene.add(ground);

      // ── 빛나는 것들 (본체와 바닥에 비친 거울상을 따로 만든다) ──
      const main = new T.Scene(), refl = new T.Scene();
      const mirror = new T.Group(); mirror.scale.y = -1; refl.add(mirror);
      const tube = (pts, h) => new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(([x, z]) => new T.Vector3(x, h, z))), 900, 0.055, 6, false);
      const trailMat = (c) => raw(TRAIL_V, TRAIL_F, { uProg: { value: 0 }, uGain: { value: 1 }, uHead: { value: 1 }, uColor: { value: new T.Vector3(...c) } });
      const mkTrail = (pts, c) => {
        const geo = tube(pts, 0.09), m1 = trailMat(c), m2 = trailMat(c);
        const a = new T.Mesh(geo, m1), b = new T.Mesh(geo, m2);
        a.frustumCulled = b.frustumCulled = false;
        main.add(a); mirror.add(b);
        return { a, b, m1, m2 };
      };
      const free = mkTrail(FREE, RED), safe = mkTrail(SAFE, GREEN);
      const glowMat = (c) => raw(GLOW_V, GLOW_F, { uColor: { value: new T.Vector3(...c) }, uGain: { value: 1 } }, { depthTest: false, side: T.DoubleSide });
      const mkGlow = (c, size) => {
        const a = new T.Mesh(new T.PlaneGeometry(1, 1), glowMat(c)), b = new T.Mesh(new T.PlaneGeometry(1, 1), glowMat(c));
        a.scale.setScalar(size); b.scale.setScalar(size); a.frustumCulled = b.frustumCulled = false;
        main.add(a); mirror.add(b);
        return { a, b, set(x, y, z, gain, s = size) { for (const m of [a, b]) { m.position.set(x, y, z); m.quaternion.copy(cam.quaternion); m.scale.setScalar(s); m.material.uniforms.uGain.value = gain * (m === b ? 0.45 : 1); m.visible = gain > 0.001; } } };
      };
      const headR = mkGlow(RED, 2.2), headG = mkGlow(GREEN, 2.2);
      // 의도한 길: 희미한 빛 점선
      const dots = [];
      for (let z = Z0 - 1; z > ZEND + 3; z -= 2.6) dots.push(z);
      const dotGeo = new T.BufferGeometry();
      dotGeo.setAttribute("position", new T.BufferAttribute(new Float32Array(dots.flatMap((z) => [0, 0.04, z])), 3));
      const dotMat = raw(`precision highp float; in vec3 position; uniform mat4 modelViewMatrix, projectionMatrix; uniform float uPpu; out float vD;
        void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); vD=-mv.z; gl_Position=projectionMatrix*mv; gl_PointSize=max(1.5, 46.*uPpu/vD); }`,
        `precision highp float; in float vD; out vec4 o; uniform float uGain; void main(){ vec2 d=gl_PointCoord-.5; float a=exp(-dot(d,d)*22.); o=vec4(vec3(.55,.66,.95)*a*uGain,1.); }`,
        { uGain: { value: 0 }, uPpu: { value: 1 } });
      const dotPts = new T.Points(dotGeo, dotMat); dotPts.frustumCulled = false; main.add(dotPts);
      // 빛기둥
      const beamMat = (gain, H) => raw(BEAM_V, BEAM_F, { uColor: { value: new T.Vector3(...BEACON) }, uGain: { value: gain }, uH: { value: H } }, { side: T.DoubleSide });
      const BH = 46;
      const core = new T.Mesh(new T.CylinderGeometry(0.26, 0.26, BH, 24, 1, true), beamMat(3.2, BH));
      const haze = new T.Mesh(new T.CylinderGeometry(2.2, 1.0, BH, 32, 1, true), beamMat(0.3, BH));
      for (const m of [core, haze]) { m.position.set(0, BH / 2, ZEND); m.frustumCulled = false; }
      main.add(core, haze);
      const beaconGlow = mkGlow(BEACON, 7);
      // 확인 관문: 빛나는 기둥 두 개와 가로대(골대 모양) + 안쪽의 엷은 막
      const frame = (() => {
        const parts = [];
        const post = (x) => { const gg = new T.CylinderGeometry(0.07, 0.07, GH, 12, 1); gg.translate(x, GH / 2, 0); return gg; };
        parts.push(post(-GW), post(GW));
        const bar = new T.CylinderGeometry(0.05, 0.05, GW * 2, 12, 1); bar.rotateZ(Math.PI / 2); bar.translate(0, GH, 0); parts.push(bar);
        const geo = new T.BufferGeometry();
        // 간단 병합
        const pos = [], uv = [], idx = []; let off = 0;
        for (const p of parts) { const P = p.getAttribute("position"), U = p.getAttribute("uv"), I = p.index;
          for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); uv.push(U.getX(i), U.getY(i)); }
          for (let i = 0; i < I.count; i++) idx.push(I.getX(i) + off); off += P.count; }
        geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); geo.setAttribute("uv", new T.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
        return geo;
      })();
      const gates = GATES.map((z) => {
        const m1 = raw(TRAIL_V, GATE_F, { uGain: { value: 0 }, uColor: { value: new T.Vector3(...GATE) } });
        const m2 = raw(TRAIL_V, GATE_F, { uGain: { value: 0 }, uColor: { value: new T.Vector3(...GATE) } });
        const a = new T.Mesh(frame, m1), b = new T.Mesh(frame, m2);
        a.position.set(0, 0, z); b.position.set(0, 0, z);
        const cg = new T.PlaneGeometry(GW * 2, GH, 1, 1); cg.translate(0, GH / 2, 0);
        const cm = raw(CURTAIN_V, CURTAIN_F, { uGain: { value: 0 }, uTime: { value: 0 }, uColor: { value: new T.Vector3(...GATE) } }, { side: T.DoubleSide });
        const curtain = new T.Mesh(cg, cm); curtain.position.set(0, 0, z);
        for (const m of [a, b, curtain]) m.frustumCulled = false;
        main.add(a, curtain); mirror.add(b);
        const fl = mkGlow(GATE, 1.2), fr = mkGlow(GATE, 1.2);
        return { z, a, b, m1, m2, cm, fl, fr };
      });

      // ── 글자 ──
      const sh = (a) => ({ blur: 24, alpha: a, y: 3, color: "#000000" });
      const head = ctx.text("작은 오차는 쌓인다", { size: 100, weight: 300, tracking: -0.035, color: "#f4f6fb", valign: "top", shadow: sh(0.35) });
      head.at(120, 92);
      const cap1 = ctx.text("조금 어긋난 결과가 다음 요청의 출발점이 됩니다", { size: 30, weight: 400, tracking: -0.01, color: "#c3c9da", valign: "top", shadow: sh(0.4) });
      cap1.at(124, 232);
      const line2 = ctx.text("확인 지점이 길을 되돌린다", { size: 46, weight: 400, tracking: -0.02, color: "#7ff0c6", valign: "top", shadow: sh(0.4) });
      line2.at(124, 226);
      const cap2 = ctx.text("테스트 · 직접 실행 · 코드 리뷰", { size: 29, weight: 400, tracking: -0.005, color: "#b9c3d6", valign: "top", shadow: sh(0.4) });
      cap2.at(124, 296);
      const gateLbl = GATE_NAMES.map((t) => ctx.text(t, { size: 26, weight: 500, tracking: 0.02, color: "#9ff5d8", align: "center", valign: "bottom", shadow: sh(0.55) }));
      const lblFree = ctx.text("확인 없이 간 길", { size: 26, weight: 500, color: "#ff9a80", align: "left", valign: "middle", shadow: sh(0.6) });
      const lblGoal = ctx.text("의도한 곳", { size: 24, weight: 500, tracking: 0.04, color: "#ffe3c2", align: "center", valign: "bottom", shadow: sh(0.6) });
      const gapLine = ctx.shape("line", { stroke: "#ff8a70", strokeAlpha: 0.9, line: 2, dash: 10 });

      const V = new T.Vector3();
      return {
        render(s, hdr) {
          const a0 = s.at(0), a1 = s.at(1);
          const pFree = prog(a0, 0.5, 4.4, ease.inOut2);
          const pSafe = prog(a1, 1.0, 4.4, ease.inOut2);
          const gatesIn = GATES.map((_, i) => prog(a1, 0.15 + i * 0.16, 0.6, ease.out3));
          const beam = 0.55 + 0.45 * prog(a1, 4.6, 1.2) ;

          // 카메라: 높은 곳에서 길을 내려다보며 천천히 앞으로
          const push = prog(a0, 0, 9, ease.inOut2) + prog(a1, 0, 9, ease.inOut2);
          const sway = Math.sin(s.time * 0.09) * 0.5;
          cam.position.set(-15.5 + sway + push * 1.2 + s.mouse.x * 0.6, 7.2 - push * 0.45 - s.mouse.y * 0.3, 12 - push * 2.2);
          cam.lookAt(-9.5 + sway * 0.3 + push * 0.4, 0, -40);
          g.fit(cam); cam.updateMatrixWorld();

          // 하늘
          fwd.set(0, 0, -1).applyQuaternion(cam.quaternion); right.set(1, 0, 0).applyQuaternion(cam.quaternion); up.set(0, 1, 0).applyQuaternion(cam.quaternion);
          const tanV = Math.tan((cam.fov * Math.PI) / 360);
          sky.u.uF.value.copy(fwd); sky.u.uR.value.copy(right); sky.u.uU.value.copy(up);
          sky.u.uTan.value = tanV; sky.u.uAsp.value = g.W / g.H; sky.u.uTime.value = s.time;
          V.set(0, 0, ZEND).project(cam); sky.u.uBeacon.value.set(V.x * 0.5 + 0.5, V.y * 0.5 + 0.5); sky.u.uBeam.value = beam;
          sky.render(hdr);

          // 빛 지도
          const key = `${pFree.toFixed(4)}|${pSafe.toFixed(4)}|${s.beat}`;
          if (key !== mapKey) {
            mapKey = key;
            lc.globalCompositeOperation = "source-over"; lc.fillStyle = "#000"; lc.fillRect(0, 0, LW, LH);
            lc.globalCompositeOperation = "lighter";
            strokePath(FREE, pFree, RED, s.beat >= 1 ? 0.35 : 1);
            strokePath(SAFE, pSafe, GREEN, 1);
            ltex.needsUpdate = true;
          }

          // 궤적
          const freeGain = s.beat >= 1 ? lerp(1, 0.28, prog(a1, 0, 0.8)) : 1;
          free.m1.uniforms.uProg.value = free.m2.uniforms.uProg.value = pFree;
          free.m1.uniforms.uGain.value = 2.4 * freeGain; free.m2.uniforms.uGain.value = 1.0 * freeGain;
          free.m1.uniforms.uHead.value = free.m2.uniforms.uHead.value = pFree < 1 ? 1 : 0;
          free.a.visible = free.b.visible = pFree > 0;
          safe.m1.uniforms.uProg.value = safe.m2.uniforms.uProg.value = pSafe;
          safe.m1.uniforms.uGain.value = 2.4; safe.m2.uniforms.uGain.value = 1.0;
          safe.m1.uniforms.uHead.value = safe.m2.uniforms.uHead.value = pSafe < 1 ? 1 : 0.3;
          safe.a.visible = safe.b.visible = pSafe > 0;
          const hf = at(FREE, pFree), hs = at(SAFE, pSafe);
          headR.set(hf[0], 0.12, hf[1], pFree > 0 && pFree < 1 ? 1.6 * freeGain : pFree >= 1 ? 0.7 * freeGain : 0);
          headG.set(hs[0], 0.12, hs[1], pSafe > 0 ? (pSafe < 1 ? 1.6 : 0.9) : 0);
          dotMat.uniforms.uGain.value = 0.55 + 0.25 * prog(a1, 0, 1); dotMat.uniforms.uPpu.value = g.ppu;

          // 관문
          gates.forEach((gt, i) => {
            const vis = gatesIn[i];
            const hit = s.beat >= 1 ? Math.exp(-Math.pow((pSafe - GATE_P[i]) / 0.018, 2)) : 0;
            const passed = s.beat >= 1 && pSafe >= GATE_P[i] ? 1 : 0;
            const gain = vis * (0.9 + passed * 0.7 + hit * 4);
            gt.m1.uniforms.uGain.value = gain * 1.4; gt.m2.uniforms.uGain.value = gain * 0.55 * Math.pow(vis, 6);
            gt.cm.uniforms.uGain.value = vis * (0.035 + hit * 0.4 + passed * 0.02); gt.cm.uniforms.uTime.value = s.time;
            gt.a.visible = gt.b.visible = vis > 0.002;
            gt.a.position.y = gt.b.position.y = -GH * (1 - vis);
            gt.cm.uniforms.uGain.value *= vis > 0.98 ? 1 : 0;
            gt.fl.set(-GW, 0.1, gt.z, vis * (0.7 + hit * 3)); gt.fr.set(GW, 0.1, gt.z, vis * (0.7 + hit * 3));
            s.cue("gate" + i, hit > 0.6, "chime", { note: 76 + [0, 4, 7][i], vol: 0.1 });
            s.cue("gin" + i, vis > 0.05, "pop", { pitch: 600 + i * 80, vol: 0.06 });
          });
          core.material.uniforms.uGain.value = 3.2 * beam; haze.material.uniforms.uGain.value = 0.3 * beam;
          beaconGlow.set(0, 0.3, ZEND, 1.2 * beam, 7 + 3 * prog(a1, 4.6, 1.2));
          groundMat.uniforms.uTime.value = s.time; groundMat.uniforms.uBeam.value = beam;

          // 그리기: 거울상 → 젖은 바닥 → 본체
          ctx.draw(refl, cam, hdr);
          ctx.draw(groundScene, cam, hdr);
          ctx.draw(main, cam, hdr);

          // 글자
          head.show(prog(a0, 0.05, 1.1, ease.linear), { style: "rise", stagger: 0.3 });
          cap1.show(prog(a0, 0.7, 0.9, ease.linear), { style: "blur", stagger: 0.35, out: prog(a1, 0, 0.45, ease.linear) });
          line2.show(prog(a1, 0.35, 0.9, ease.linear), { style: "rise", stagger: 0.35 });
          cap2.show(prog(a1, 0.9, 0.9, ease.linear), { style: "blur", stagger: 0.35 });
          gates.forEach((gt, i) => {
            const [x, y] = ctx.project(V.set(0, GH + 0.5 - GH * (1 - gatesIn[i]), gt.z), cam);
            const passed = s.beat >= 1 && pSafe >= GATE_P[i];
            gateLbl[i].at(x, y - 6);
            gateLbl[i].show(gatesIn[i] > 0 ? prog(a1, 0.45 + i * 0.16, 0.6, ease.linear) : 0, { style: "rise", stagger: 0.3 });
            gateLbl[i].alpha = passed ? 1 : 0.72;
          });
          const fe = FREE[FREE.length - 1];
          const [ex, ey] = ctx.project(V.set(fe[0], 0.1, fe[1]), cam);
          lblFree.at(ex + 26, ey);
          lblFree.show(prog(a0, 4.9, 0.7, ease.linear), { style: "blur", stagger: 0.3 });
          lblFree.alpha = lerp(1, 0.45, prog(a1, 0, 0.6));
          const [bx, by] = ctx.project(V.set(0, 0.1, ZEND), cam);
          lblGoal.at(bx, by - 175).show(prog(a0, 0.9, 0.8, ease.linear), { style: "fade" });
          // 벌어진 거리 (1비트 끝)
          const gq = prog(a0, 5.0, 0.6) * (1 - prog(a1, 0, 0.5));
          if (gq > 0) {
            const [gx0, gy0] = ctx.project(V.set(fe[0], 0.05, fe[1]), cam), [gx1, gy1] = ctx.project(V.set(0, 0.05, fe[1]), cam);
            gapLine.path([[gx1, gy1], [lerp(gx1, gx0, gq), lerp(gy1, gy0, gq)]]).alpha(gq * 0.9);
          } else gapLine.alpha(0);

          // 소리
          s.cue("drawR", a0 > 0.5, "sweep", { up: false, dur: 4.2 });
          s.cue("off", pFree >= 0.999 && a0 > 4.95, "buzz");
          s.cue("drawG", a1 > 1.0, "sweep", { up: true, dur: 4.2 });
          s.cue("goal", pSafe >= 0.999 && a1 > 5.35, "swell", { root: 57, vol: 0.07 });
          return { bloom: 0.95, threshold: 0.75, knee: 0.6, radius: 1.05, exposure: 1.0, tone: "agx", contrast: 1.08, saturation: 1.18, vignette: 0.48, grain: 0.05, ca: 0.45 };
        },
      };
    },
  });
})();
