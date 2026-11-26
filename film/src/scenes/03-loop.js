// 03 · 바이브 코딩이란
// 비트 1: 어두운 안개 속 큰 글자로 정의. 뒤쪽에 초점이 나간 빛의 고리가 희미하게 떠 있다.
// 비트 2: 그 고리가 초점이 맞으며 3D 빛의 링으로 그려진다. 네 노드(말하기·생성·실행·확인)를 흰 혜성이 돌고, 지날 때마다 노드가 빛난다.
//         윤이 나는 검은 바닥에 링이 비친다.
// 비트 3: 혜성이 끊김 없이 빨라지고, 꼬리가 길어져 링 전체가 빛으로 차오른다. 입자가 소용돌이치고 카메라가 낮게 다가간다.
(() => {
  const { clamp, lerp, ease, prog, rng, noise, TAU } = Deck.util;
  const ACCENT = "#9aa6ff", MUTED = "#8b93a7";
  const NODES = ["말하기", "생성", "실행", "확인"];
  const NOTE = [72, 76, 79, 84];
  const R = 4.2, RING_Y = 2.35, TILT = -1.13;
  const W0 = 0.78, WX = 5.9, TA = 1.8; // 기본 각속도, 비트 3에서 더해지는 각속도, 가속 시간 상수
  const T0 = 1.55;                     // 비트 2 시작 후 혜성이 출발하는 시각
  const nodeAng = (i) => Math.PI / 2 - i * (Math.PI / 2);
  // 그려지는 선이 노드 i에 닿는 시각 (ease.inOut3의 역함수 값을 미리 계산)
  const NODE_T = [0, 0.397, 0.5, 0.603].map((x) => 0.1 + 1.4 * x);
  const SIDE = { off: [[0, -62], [70, 0], [0, 66], [-70, 0]], align: ["center", "left", "center", "right"], numDy: [-36, -34, 36, -34] };
  const wrap = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

  // 혜성 각도(계속 줄어든다 = 시계 방향)와 각속도. 비트 3의 가속은 속도를 적분한 값이라 위치가 끊기지 않는다.
  function cometOf(s) {
    const a1 = s.at(1), a2 = s.at(2);
    const tc = Math.max(0, a1 - T0);
    let ang = Math.PI / 2 - W0 * tc, w = a1 > T0 ? W0 : 0;
    if (a2 > 0) { ang -= WX * (a2 - TA + TA * Math.exp(-a2 / TA)); w += WX * (1 - Math.exp(-a2 / TA)); }
    return { ang, w, on: clamp((a1 - T0 + 0.3) / 0.3) };
  }

  // 배경: 깊은 남색 안개 + 초점이 나간 고리(비트 1의 예고)
  const BG = /* glsl */ `${Deck.glsl.noise}
uniform float uAspect, uGhostA, uGhostW, uGlow; uniform vec4 uGhost;
void main(){
  vec2 uv=vUv; vec2 p=(uv-.5)*vec2(uAspect,1.);
  float t=uTime*.018;
  vec3 c=mix(vec3(.0022,.0028,.0065), vec3(.0060,.0070,.0160), smoothstep(1.05,.15,uv.y));
  float h=fbm(vec2(p.x*1.1+t, p.y*2.0-t*.4)*1.3);
  float h2=fbm(vec2(p.x*.6-t*.6, p.y*1.2)*1.1+7.3);
  c+=vec3(.008,.010,.028)*smoothstep(.32,.92,h)*(.55+.45*h2)*uGlow;
  vec2 gc=(uv-uGhost.xy)*vec2(uAspect,1.);
  c+=vec3(.012,.014,.042)*exp(-dot(gc,gc)*2.6)*uGlow;
  vec2 q=(uv-uGhost.xy)/max(uGhost.zw,vec2(1e-3));
  float d=(length(q)-1.)*min(uGhost.z*uAspect,uGhost.w);
  float ring=exp(-d*d/(uGhostW*uGhostW));
  c+=vec3(.12,.15,.46)*ring*uGhostA*(.75+.25*h2);
  o=vec4(c,1.);
}`;

  Deck.scene({
    id: "loop",
    title: "바이브 코딩이란",
    bg: "#04050a",
    ink: "#ffffff",
    mood: 0.5,
    transition: "iris",
    beats: [
      { dur: 3.2, note: "용어부터 정리하겠습니다. 2025년 2월, 안드레이 카파시가 이런 방식을 '바이브 코딩'이라고 불렀습니다.\n코드를 한 줄씩 읽고 쓰는 대신, 원하는 걸 말하고 결과를 보며 고쳐 나가는 방식입니다." },
      { dur: 3.6, note: "구조는 단순한 루프입니다. 말하고, AI가 만들고, 실행하고, 눈으로 확인합니다. 그리고 다시 말합니다." },
      { dur: 3.4, note: "핵심은 이 바퀴가 도는 속도입니다.\n한 바퀴가 짧아지면 같은 시간에 훨씬 많이 시도해 볼 수 있습니다." },
    ],
    create(ctx) {
      const { T, g } = ctx;
      const bgT = ctx.target({ scale: 0.5 });
      const bg = ctx.pass(BG, { uAspect: 16 / 9, uGhostA: 0, uGhostW: 0.03, uGlow: 1, uGhost: new T.Vector4(0.6, 0.5, 0.2, 0.1) });

      // ── 3D ──
      const U = { uMul: { value: 1 }, uTime: { value: 0 } };
      const world = new T.Scene();
      const mirror = new T.Group(); world.add(mirror);
      const ringRoot = new T.Group(); ringRoot.rotation.x = TILT; ringRoot.position.y = RING_Y; mirror.add(ringRoot);
      const fx = new T.Group(); mirror.add(fx);
      const VS = /* glsl */ `varying vec3 vL; varying vec3 vN; varying vec3 vV; varying vec2 vUv;
        void main(){ vL=position; vUv=uv; vec4 wp=modelMatrix*vec4(position,1.); vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-wp.xyz); gl_Position=projectionMatrix*viewMatrix*wp; }`;
      const add = { transparent: true, depthWrite: false, blending: T.AdditiveBlending };

      const ringU = { uAng: { value: Math.PI / 2 }, uTrail: { value: 1 }, uBase: { value: 0.5 }, uAppear: { value: 0 }, uHead: { value: 1 }, uOn: { value: 0 } };
      const RING_FS = /* glsl */ `uniform float uMul, uAng, uTrail, uBase, uAppear, uHead, uOn; uniform float uSheath;
        varying vec3 vL; varying vec3 vN; varying vec3 vV; const float TAU=6.2831853;
        void main(){
          float a=atan(vL.y,vL.x);
          float sw=mod(1.5707963-a,TAU)/TAU;
          if(sw>uAppear) discard;
          float d=mod(a-uAng,TAU);
          float k=clamp(d/uTrail,0.,1.);
          float tr=pow(1.-k,2.3)*uOn;
          float hd=exp(-pow(min(d,TAU-d)/.03,2.))*uOn;
          float f=abs(dot(normalize(vN),normalize(vV)));
          vec3 tc=mix(vec3(.36,.42,1.), vec3(1.,.93,.86), pow(1.-k,6.));
          vec3 c;
          if(uSheath>.5){
            float s=pow(f,3.);
            c=(vec3(.30,.36,1.)*uBase*.10+tc*tr*uHead*.30+vec3(1.)*hd*uHead*.6)*s;
          } else {
            c=vec3(.30,.36,1.)*uBase*(.45+.55*f)+tc*tr*uHead*(.55+.45*f)+vec3(1.,.96,.92)*hd*uHead*4.;
            float edge=exp(-pow((uAppear-sw)/.008,2.))*step(uAppear,.999);
            c+=vec3(.78,.82,1.)*edge*9.;
          }
          gl_FragColor=vec4(c*uMul,1.);
        }`;
      const ringMat = new T.ShaderMaterial({ uniforms: { ...U, ...ringU, uSheath: { value: 0 } }, vertexShader: VS, fragmentShader: RING_FS });
      const sheathMat = new T.ShaderMaterial({ uniforms: { ...U, ...ringU, uSheath: { value: 1 } }, vertexShader: VS, fragmentShader: RING_FS, ...add });
      ringRoot.add(new T.Mesh(new T.TorusGeometry(R, 0.036, 12, 600), ringMat));
      ringRoot.add(new T.Mesh(new T.TorusGeometry(R, 0.24, 16, 300), sheathMat));

      // 노드: 빛나는 심 + 유리 껍질 + 후광
      const nodes = NODES.map((_, i) => {
        const a = nodeAng(i);
        const grp = new T.Group(); grp.position.set(Math.cos(a) * R, Math.sin(a) * R, 0); ringRoot.add(grp);
        const nu = { uHot: { value: 0 }, uA: { value: 0 } };
        const core = new T.Mesh(new T.SphereGeometry(0.12, 24, 16), new T.ShaderMaterial({
          uniforms: { ...U, ...nu }, vertexShader: VS,
          fragmentShader: `uniform float uMul, uHot, uA; void main(){ gl_FragColor=vec4(vec3(.55,.62,1.)*(1.2+uHot*10.)*uA*uMul,1.); }`,
        }));
        const shell = new T.Mesh(new T.SphereGeometry(0.46, 48, 32), new T.ShaderMaterial({
          uniforms: { ...U, ...nu }, vertexShader: VS, ...add,
          fragmentShader: `uniform float uMul, uHot, uA; varying vec3 vN; varying vec3 vV;
            void main(){ vec3 n=normalize(vN), v=normalize(vV); float f=1.-abs(dot(n,v));
              float rim=pow(f,2.4); vec3 L=normalize(vec3(-.4,.85,.45));
              float sp=pow(max(dot(reflect(-L,n),v),0.),70.);
              vec3 c=vec3(.34,.41,1.)*rim*(1.+uHot*3.5)+vec3(1.)*sp*1.6+vec3(.22,.27,.85)*(1.-f)*.05*(1.+uHot*5.);
              gl_FragColor=vec4(c*uA*uMul,1.); }`,
        }));
        grp.add(core, shell);
        const halo = new T.Mesh(new T.PlaneGeometry(1, 1), new T.ShaderMaterial({
          uniforms: { ...U, ...nu }, vertexShader: VS, ...add, side: T.DoubleSide,
          fragmentShader: `uniform float uMul, uHot, uA; varying vec2 vUv;
            void main(){ float r=length(vUv-.5)*2.; float a=exp(-r*r*6.)*(.05+uHot*.45)+exp(-r*r*45.)*uHot*1.6;
              gl_FragColor=vec4(mix(vec3(.4,.46,1.),vec3(1.,.97,.95),uHot*.5)*a*uA*uMul,1.); }`,
        }));
        halo.scale.setScalar(2.2); fx.add(halo);
        return { grp, core, shell, halo, nu, a };
      });

      // 혜성 머리 + 빛무리
      const cometU = { uA: { value: 0 } };
      const head = new T.Mesh(new T.SphereGeometry(0.085, 20, 14), new T.ShaderMaterial({
        uniforms: { ...U, ...cometU }, vertexShader: VS,
        fragmentShader: `uniform float uMul, uA; void main(){ gl_FragColor=vec4(vec3(1.,.97,.94)*40.*uA*uMul,1.); }`,
      }));
      ringRoot.add(head);
      const cglow = new T.Mesh(new T.PlaneGeometry(1, 1), new T.ShaderMaterial({
        uniforms: { ...U, ...cometU }, vertexShader: VS, ...add, side: T.DoubleSide,
        fragmentShader: `uniform float uMul, uA; varying vec2 vUv; void main(){ float r=length(vUv-.5)*2.;
          float a=exp(-r*r*8.)*.35+exp(-r*r*70.)*3.; gl_FragColor=vec4(vec3(.85,.88,1.)*a*uA*uMul,1.); }`,
      }));
      cglow.scale.setScalar(2.4); fx.add(cglow);

      // 소용돌이 빛줄기: 링을 따라 도는 짧은 호. 속도가 빠를수록 길어진다 (링 좌표계)
      const NS = 520, rs = rng(31), SEG = 10;
      const sgeo = new T.InstancedBufferGeometry();
      const sv = [], si = [];
      for (let k = 0; k <= SEG; k++) { sv.push(k / SEG, -1, 0, k / SEG, 1, 0); if (k < SEG) { const b = k * 2; si.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } }
      sgeo.setAttribute("position", new T.Float32BufferAttribute(sv, 3)); sgeo.setIndex(si);
      const sa = new Float32Array(NS * 4);
      for (let i = 0; i < NS; i++) {
        const n = (rs() + rs() + rs() - 1.5) / 1.5;
        sa[i * 4] = rs() * TAU; sa[i * 4 + 1] = 0.55 + rs() * 0.5; sa[i * 4 + 2] = n; sa[i * 4 + 3] = (rs() - 0.5) * 2;
      }
      sgeo.setAttribute("aux", new T.InstancedBufferAttribute(sa, 4)); sgeo.instanceCount = NS;
      sgeo.boundingSphere = new T.Sphere(new T.Vector3(), 100);
      const spU = { uAcc: { value: 0 }, uAmt: { value: 0 }, uLen: { value: 0.1 }, uPx: { value: 800 } };
      const spiral = new T.Mesh(sgeo, new T.ShaderMaterial({
        uniforms: { ...U, ...spU }, ...add, side: T.DoubleSide,
        vertexShader: `attribute vec4 aux; uniform float uAcc, uAmt, uLen; varying float vB;
          void main(){ float u=position.x, v=position.y;
            float th=aux.x+aux.y*uAcc+u*uLen*aux.y;
            float r=${R.toFixed(2)}+aux.z*.55;
            vec3 rad=vec3(cos(th),sin(th),0.);
            vec3 p=rad*r+vec3(0.,0.,aux.w*.34*(1.-abs(aux.z)*.5));
            p+=v*.0085*(1.+aux.y)*normalize(rad*.4+vec3(0.,0.,1.));
            vB=uAmt*pow(1.-u,1.6)*(1.-abs(aux.z)*.8)*(.4+.6*aux.y);
            gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }`,
        fragmentShader: `uniform float uMul; varying float vB; void main(){ gl_FragColor=vec4(vec3(.62,.68,1.)*vB*2.6*uMul,1.); }`,
      }));
      spiral.frustumCulled = false; ringRoot.add(spiral);

      // 떠다니는 먼지 (월드 좌표)
      const ND = 800, rd = rng(57);
      const dp = new Float32Array(ND * 3), da = new Float32Array(ND * 4);
      for (let i = 0; i < ND; i++) {
        dp[i * 3] = (rd() - 0.5) * 26; dp[i * 3 + 1] = 0.2 + rd() * 7.5; dp[i * 3 + 2] = -10 + rd() * 17;
        da[i * 4] = rd() * TAU; da[i * 4 + 1] = 0.3 + rd() * 0.7; da[i * 4 + 2] = rd(); da[i * 4 + 3] = rd();
      }
      const dg = new T.BufferGeometry(); dg.setAttribute("position", new T.BufferAttribute(dp, 3)); dg.setAttribute("aux", new T.BufferAttribute(da, 4));
      const dustU = { uComet: { value: new T.Vector3() }, uDust: { value: 0 }, uPx: spU.uPx };
      const dust = new T.Points(dg, new T.ShaderMaterial({
        uniforms: { ...U, ...dustU }, ...add,
        vertexShader: `attribute vec4 aux; uniform float uTime, uDust, uPx; uniform vec3 uComet; varying float vB;
          void main(){ vec3 p=position+vec3(sin(uTime*.11*aux.y+aux.x)*.6, sin(uTime*.07+aux.x*3.)*.35, cos(uTime*.09*aux.y+aux.x)*.6);
            float near=exp(-dot(p-uComet,p-uComet)*.18);
            vec4 mv=modelViewMatrix*vec4(p,1.); vB=uDust*(.05+.12*aux.z+near*1.6);
            gl_Position=projectionMatrix*mv; gl_PointSize=max(1.,(.018+.02*aux.w)*uPx/-mv.z); }`,
        fragmentShader: `uniform float uMul; varying float vB; void main(){ vec2 d=gl_PointCoord-.5; float a=exp(-dot(d,d)*12.); gl_FragColor=vec4(vec3(.75,.8,1.)*vB*a*uMul,1.); }`,
      }));
      dust.frustumCulled = false; mirror.add(dust);

      // 바닥: 링 반사 위에 얹는 반투명 검은 막 + 링·혜성이 떨어뜨리는 빛
      const floorU = { uInv: { value: new T.Matrix4() }, uComet: { value: new T.Vector3() }, uCometA: { value: 0 }, uBase: ringU.uBase, uFloorA: { value: 0 }, uHotP: { value: [0, 1, 2, 3].map(() => new T.Vector4()) } };
      const floor = new T.Mesh(new T.PlaneGeometry(90, 90), new T.ShaderMaterial({
        uniforms: { ...U, ...floorU }, transparent: true, depthWrite: true,
        blending: T.CustomBlending, blendSrc: T.OneFactor, blendDst: T.OneMinusSrcAlphaFactor,
        vertexShader: `varying vec3 vW; void main(){ vec4 wp=modelMatrix*vec4(position,1.); vW=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`,
        fragmentShader: `${Deck.glsl.noise}
          uniform mat4 uInv; uniform vec3 uComet; uniform float uCometA, uBase, uFloorA, uMul; uniform vec4 uHotP[4]; varying vec3 vW;
          void main(){
            vec3 v=normalize(cameraPosition-vW);
            float fr=pow(1.-max(v.y,0.),4.);
            float n=fbm(vW.xz*.9)*.6+fbm(vW.xz*6.)*.4;
            float refl=mix(.30,.78,fr)*(.82+.18*n);
            float dist=length(vW.xz-cameraPosition.xz);
            float far=1.-smoothstep(9.,26.,dist);
            vec3 lp=(uInv*vec4(vW,1.)).xyz;
            float dr=length(vec2(length(lp.xy)-${R.toFixed(2)}, lp.z));
            vec3 pool=vec3(.30,.36,1.)*uBase*.05*exp(-dr*dr*.9);
            vec3 cd=vW-uComet; pool+=vec3(.85,.88,1.)*uCometA*.9/(1.+dot(cd,cd)*1.4);
            for(int i=0;i<4;i++){ vec3 hd=vW-uHotP[i].xyz; pool+=vec3(.4,.46,1.)*uHotP[i].w*.6/(1.+dot(hd,hd)*2.); }
            vec3 base=vec3(.0028,.0032,.006)*(.8+.4*n);
            float a=(1.-refl)*uFloorA*far*.92;
            gl_FragColor=vec4((base*(1.-refl)*far+pool*(.8+.2*n))*uFloorA*uMul, a);
          }`,
      }));
      floor.rotation.x = -Math.PI / 2; world.add(floor);

      const cam = ctx.camera(34, 0.1, 200);

      // ── 겹레이어 글자 ──
      const rule = ctx.shape("rect", { fill: ACCENT });
      const kick = ctx.text("용어", { size: 24, weight: 500, tracking: 0.32, color: ACCENT, valign: "middle" });
      const L1 = ctx.text("코드를 읽기보다", { size: 124, weight: 300, tracking: -0.04 });
      const L2 = ctx.text("결과를 보며 만든다", { size: 124, weight: 400, tracking: -0.04, color: ACCENT });
      const cap = ctx.text("바이브 코딩 — 2025년 2월, 안드레이 카파시(Andrej Karpathy)가 붙인 이름", { size: 30, weight: 400, color: MUTED, tracking: -0.005 });
      const H2 = ctx.text("말하고, 만들고,\n돌려 보고, 확인한다", { size: 88, weight: 300, tracking: -0.035, leading: 1.16, shadow: { blur: 26, alpha: 0.45 } });
      const H3 = ctx.text([{ t: "한 바퀴가 짧을수록\n" }, { t: "더 많이 시도한다", color: ACCENT, weight: 400 }], { size: 88, weight: 300, tracking: -0.035, leading: 1.16, shadow: { blur: 26, alpha: 0.45 } });
      const center = ctx.text("반복", { size: 34, weight: 300, tracking: 0.2, align: "center", valign: "middle", color: "#c7ccf0" });
      const labs = NODES.map((n, i) => ctx.text(n, { size: 33, weight: 500, align: SIDE.align[i], valign: "middle", tracking: -0.01, shadow: { blur: 16, alpha: 0.6 } }));
      const nums = NODES.map((_, i) => ctx.text(String(i + 1).padStart(2, "0"), { size: 17, weight: 500, family: "mono", color: ACCENT, align: SIDE.align[i], valign: "middle", tracking: 0.08 }));

      const _v = new T.Vector3(), _q = new T.Quaternion();
      const camPose = (s) => {
        const a1 = s.at(1), a2 = s.at(2);
        const e1 = prog(a1, 0, 2.4, ease.inOut3), e2 = prog(a2, 0, 2.8, ease.inOut3);
        const P0 = [-1.2, 3.1, 18.5], P1 = [0, 2.55, 14.2], P2 = [2.7, 1.25, 11.4];
        const L0 = [-5.2, 2.2, 0], L1 = [-1.0, 1.95, 0], L2 = [-0.35, 2.05, 0];
        const mixv = (a, b, c) => a.map((v, i) => lerp(lerp(v, b[i], e1), c[i], e2));
        const p = mixv(P0, P1, P2), l = mixv(L0, L1, L2);
        const sw = Math.sin(s.time * 0.09) * 0.55 + s.mouse.x * 0.45, sv = Math.cos(s.time * 0.07) * 0.18 - s.mouse.y * 0.25;
        cam.position.set(p[0] + sw, p[1] + sv, p[2]);
        cam.lookAt(l[0], l[1], l[2]);
        cam.rotateZ(lerp(0, -0.045, e2));
      };

      return {
        render(s, hdr) {
          const a0 = s.at(0), a1 = s.at(1), a2 = s.at(2);
          const vw = g.view;
          U.uTime.value = s.time;
          camPose(s);
          ctx.fit(cam); cam.updateMatrixWorld();
          mirror.scale.y = 1; mirror.updateMatrixWorld(true);

          const appear = prog(a1, 0.1, 1.4, ease.inOut3);
          const { ang, w, on } = cometOf(s);
          const fast = clamp((w - W0) / WX);

          // 고리의 화면 위 모양(초점 나간 고리를 같은 자리에 그리려고)
          let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
          for (let k = 0; k < 32; k++) {
            const t = (k / 32) * TAU;
            _v.set(Math.cos(t) * R, Math.sin(t) * R, 0); ringRoot.localToWorld(_v);
            const [x, y] = ctx.project(_v, cam);
            x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
          }
          const toU = (x) => (x - vw.x0) / vw.w, toV = (y) => 1 - (y - vw.y0) / vw.h;
          bg.u.uAspect.value = g.W / g.H;
          bg.u.uGhost.value.set(toU((x0 + x1) / 2), toV((y0 + y1) / 2), (x1 - x0) / 2 / vw.w, (y1 - y0) / 2 / vw.h);
          const ghost = prog(a0, 0.3, 1.6, ease.out2) * (1 - appear);
          bg.u.uGhostA.value = ghost * 0.34; bg.u.uGhostW.value = lerp(0.045, 0.012, prog(a1, 0, 0.8));
          bg.u.uGlow.value = 1 + fast * 0.3;
          bg.u.uTime.value = s.time;
          bg.render(bgT);
          ctx.copy(bgT, hdr);

          // 고리 · 노드 · 혜성
          ringU.uAppear.value = appear;
          ringU.uAng.value = ang; ringU.uOn.value = on;
          ringU.uTrail.value = clamp(0.35 + w * 0.92, 0.35, 5.95);
          ringU.uBase.value = (0.55 + fast * 1.5) * appear;
          ringU.uHead.value = 1 + fast * 0.6;
          const hots = nodes.map((nd, i) => {
            const d = wrap(ang - nd.a);
            const pass = d >= 0 ? Math.exp(-Math.pow(d / 0.07, 2)) : Math.exp(d / Math.max(w, 0.3) / 0.42);
            const hot = on * pass;
            s.cue("hit" + i, on > 0.5 && d < 0 && d > -0.65, "chime", { note: NOTE[i], vol: lerp(0.075, 0.032, fast) });
            return hot;
          });
          nodes.forEach((nd, i) => {
            const q = prog(a1, NODE_T[i] - 0.05, 0.5, ease.linear);
            const pop = Math.max(0.001, ease.outBack(q, 2.2));
            nd.nu.uA.value = clamp(q * 2); nd.nu.uHot.value = hots[i];
            nd.grp.scale.setScalar(pop);
            nd.grp.getWorldPosition(_v); nd.halo.position.copy(_v); nd.halo.quaternion.copy(cam.quaternion);
            nd.halo.scale.setScalar(2.2 * pop * (1 + hots[i] * 0.3));
            nd.grp.visible = q > 0.001; nd.halo.visible = q > 0.001;
            s.cue("node" + i, q > 0.3, "pop", { pitch: 420 + i * 90, vol: 0.1 });
          });
          head.position.set(Math.cos(ang) * R, Math.sin(ang) * R, 0);
          cometU.uA.value = on; head.visible = cglow.visible = on > 0.001;
          head.getWorldPosition(_v); cglow.position.copy(_v); cglow.quaternion.copy(cam.quaternion);
          cglow.scale.setScalar(1.5 + fast * 0.7);
          spU.uAcc.value = ang - Math.PI / 2; spU.uAmt.value = fast * 0.5 + on * 0.012; spU.uLen.value = 0.05 + w * 0.05;
          spiral.visible = spU.uAmt.value > 0.001;
          spU.uPx.value = hdr.height / (2 * Math.tan((cam.fov * Math.PI) / 360));
          dustU.uComet.value.copy(_v); dustU.uDust.value = 0.6 + appear * 0.8;
          floorU.uInv.value.copy(ringRoot.matrixWorld).invert();
          floorU.uComet.value.copy(_v); floorU.uCometA.value = on * (1 + fast);
          nodes.forEach((nd, i) => { nd.grp.getWorldPosition(_v); floorU.uHotP.value[i].set(_v.x, _v.y, _v.z, hots[i] * nd.nu.uA.value); });
          floorU.uFloorA.value = appear;
          s.cue("draw", a1 > 0.1, "sweep", { up: true, dur: 1.4 });
          s.cue("speed", a2 > 0.1, "riser", { dur: 2.6, vol: 0.08 });

          if (a1 >= 0) {
            const r = ctx.r;
            // 1) 바닥 아래로 비친 장면
            mirror.scale.y = -1; mirror.updateMatrixWorld(true);
            floor.visible = false; U.uMul.value = 0.2;
            ctx.draw(world, cam, hdr);
            // 2) 반투명 바닥
            mirror.scale.y = 1; mirror.updateMatrixWorld(true);
            mirror.visible = false; floor.visible = true; U.uMul.value = 1;
            ctx.draw(world, cam, hdr);
            r.setRenderTarget(hdr); r.clear(false, true, false);
            // 3) 실제 장면
            mirror.visible = true; floor.visible = false;
            ctx.draw(world, cam, hdr);
          }

          // ── 글자 ──
          const out1 = prog(a1, 0, 0.75, ease.inOut3);
          rule.rect(124, 364, lerp(0, 40, prog(a0, 0.05, 0.6, ease.out4)), 2).alpha(prog(a0, 0, 0.4) * (1 - out1));
          kick.at(182, 365).show(prog(a0, 0.1, 0.8, ease.linear), { style: "fade", out: out1, stagger: 0.3 });
          L1.at(118, 500).show(prog(a0, 0.15, 1.1, ease.linear), { style: "rise", out: out1, outStyle: "blur", stagger: 0.42 });
          L2.at(118, 648).show(prog(a0, 0.5, 1.1, ease.linear), { style: "rise", out: out1, outStyle: "blur", stagger: 0.42 });
          cap.at(124, 760).show(prog(a0, 1.2, 1.0, ease.linear), { style: "blur", out: out1, stagger: 0.35 });
          const out2 = prog(a2, 0, 0.7, ease.inOut3);
          H2.at(118, 186).show(prog(a1, 0.4, 1.2, ease.linear), { style: "rise", out: out2, stagger: 0.32, by: "glyph" });
          H3.at(118, 186).show(prog(a2, 0.35, 1.2, ease.linear), { style: "rise", stagger: 0.32 });
          // 노드 이름: 노드 위치를 화면에 투영해서 바깥쪽에 붙인다
          ringRoot.updateMatrixWorld(true);
          const _r = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
          nodes.forEach((nd, i) => {
            nd.grp.getWorldPosition(_v);
            const [x, y] = ctx.project(_v, cam);
            const [xr] = ctx.project(_v.addScaledVector(_r, 0.46), cam);
            const rpx = Math.abs(xr - x);
            const q = prog(a1, NODE_T[i] + 0.12, 0.8, ease.linear);
            const k = rpx + 26, off = [[0, -k - 4], [k + 8, 0], [0, k + 6], [-k - 8, 0]][i], hot = hots[i];
            if (q <= 0) { labs[i].hide(); nums[i].hide(); return; }
            labs[i].at(x + off[0], y + off[1]).animate((gl, o) => {
              const v = clamp((q - (gl.n / Math.max(1, labs[i].n)) * 0.3) / 0.7);
              o.alpha = ease.out2(v); o.blur = (1 - ease.out3(v)) * 7;
              const k = clamp(hot) * 0.55; o.r = lerp(1, 0.82, k); o.g = lerp(1, 0.86, k);
            });
            nums[i].at(x + off[0], y + off[1] + SIDE.numDy[i]).show(q, { style: "fade" });
          });
          _v.set(0, 0, 0); ringRoot.localToWorld(_v);
          const [cx, cy] = ctx.project(_v, cam);
          center.at(cx, cy).show(prog(a1, 1.0, 0.8, ease.linear), { style: "blur", out: out2, stagger: 0.4 });

          const b = lerp(0.55, 0.95, appear);
          return { bloom: b + fast * 0.25, threshold: 0.62, knee: 0.7, radius: 1.05, exposure: 1.0, vignette: 0.42, grain: 0.042, ca: 0.45, contrast: 1.06, saturation: 1.06 };
        },
      };
    },
  });
})();
