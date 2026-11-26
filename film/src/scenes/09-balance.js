// 09 · 무게중심의 이동
// 어두운 전시실, 위에서 떨어지는 스포트라이트 하나. 빛 기둥 속에 먼지가 떠다니고, 윤이 나는 검은 바닥에 황동 저울이 비친다.
// 비트 1: 호박색 판(타이핑 · 문법 외우기 · 반복 코드)이 왼쪽 접시에 떨어져 저울이 왼쪽으로 기운다. 오른쪽엔 남색 '판단' 하나.
// 비트 2: 호박색 판은 불씨가 되어 흩어지고, 남색 판(설계 · 검증 · 취향)이 오른쪽에 쌓이며 저울이 반대로 넘어간다.
// 저울 각도는 "블록이 닿는 사건마다 감쇠 진동으로 반응"하는 해석식이라 시간만으로 정해진다(되감기 가능).
(() => {
  const { clamp, lerp, ease, prog, rng, noise, TAU } = Deck.util;
  const ACCENT = "#9aa6ff";
  const PIVOT = 6.1, ARM = 4.3, DROP = 4.0, PAN_R = 1.6;
  const BW = 1.72, BH = 0.36, BD = 0.82, GAP = 0.025;
  const G = 16, FALL = 3.4, TF = Math.sqrt((2 * FALL) / G);
  const LEFT = ["타이핑", "문법 외우기", "반복 코드"];
  const RIGHT = ["판단", "설계", "검증", "취향"];
  // 놓는 시각(비트 기준), 닿는 시각 = 놓는 시각 + TF
  const L_DROP = [0.35, 0.68, 1.01];        // 비트 1
  const R0_DROP = 1.85;                     // 비트 1: '판단'
  const R_DROP = [0, 0.8, 1.12, 1.44];      // 비트 2: 설계 · 검증 · 취향 (0번은 안 씀)
  const L_DIS = [0.12, 0.3, 0.48], DIS_T = 1.15; // 비트 2: 흩어지기 시작 · 걸리는 시간

  const tilt = (wl, wr) => 0.2 * Math.tanh((wl - wr) / 1.45);
  // 저울 반응: 감쇠 진동 계단 응답
  const W0 = TAU * 0.82, Z = 0.2, WD = W0 * Math.sqrt(1 - Z * Z);
  const step = (t) => (t <= 0 ? 0 : 1 - Math.exp(-Z * W0 * t) * (Math.cos(WD * t) + (Z / Math.sqrt(1 - Z * Z)) * Math.sin(WD * t)));
  // 사건 목록: [비트, 시각, 왼쪽 무게 변화, 오른쪽 무게 변화]
  const EVENTS = (() => {
    const ev = [];
    L_DROP.forEach((t) => ev.push([0, t + TF, 1, 0]));
    ev.push([0, R0_DROP + TF, 0, 1]);
    L_DIS.forEach((t) => ev.push([1, t + DIS_T * 0.45, -1, 0]));
    [1, 2, 3].forEach((i) => ev.push([1, R_DROP[i] + TF, 0, 1]));
    ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let wl = 0, wr = 0;
    return ev.map(([b, t, dl, dr]) => { const before = tilt(wl, wr); wl += dl; wr += dr; return { b, t, d: tilt(wl, wr) - before }; });
  })();
  const angleAt = (s) => EVENTS.reduce((a, e) => a + e.d * step(s.at(e.b) - e.t), 0);

  // 둥근 모서리 판 (앞면이 평평해서 이름표를 붙이기 좋다)
  function rbox(T, w, h, d, r) {
    const s = new T.Shape(), x = -(w / 2 - r), y = -(h / 2 - r), ww = w - 2 * r, hh = h - 2 * r, k = Math.min(ww, hh) * 0.18;
    s.moveTo(x + k, y); s.lineTo(x + ww - k, y); s.quadraticCurveTo(x + ww, y, x + ww, y + k); s.lineTo(x + ww, y + hh - k);
    s.quadraticCurveTo(x + ww, y + hh, x + ww - k, y + hh); s.lineTo(x + k, y + hh); s.quadraticCurveTo(x, y + hh, x, y + hh - k);
    s.lineTo(x, y + k); s.quadraticCurveTo(x, y, x + k, y);
    const g = new T.ExtrudeGeometry(s, { depth: d - 2 * r, bevelEnabled: true, bevelSize: r, bevelThickness: r, bevelSegments: 4, curveSegments: 6 });
    g.translate(0, 0, -(d - 2 * r) / 2); g.computeVertexNormals();
    return g;
  }
  // 흩어지는 판: 위쪽부터 잡음 경계를 따라 사라지고, 경계가 불씨처럼 빛난다
  const DIS_GLSL = `
    float dh(vec3 p){ p=fract(p*.3183099+.1); p*=17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
    float dn(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
      return mix(mix(mix(dh(i),dh(i+vec3(1,0,0)),f.x),mix(dh(i+vec3(0,1,0)),dh(i+vec3(1,1,0)),f.x),f.y),
                 mix(mix(dh(i+vec3(0,0,1)),dh(i+vec3(1,0,1)),f.x),mix(dh(i+vec3(0,1,1)),dh(i+vec3(1,1,1)),f.x),f.y),f.z); }`;
  function dissolvable(mat, u) {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uDis = u;
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vOP;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvOP = position;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vOP; uniform float uDis;" + DIS_GLSL)
        .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
          float dv=(1.-(vOP.y/${BH.toFixed(3)}+.5))*.58+dn(vOP*7.)*.42;
          float edge=dv-uDis*1.25+.1;
          if(edge<0.) discard;
          totalEmissiveRadiance+=vec3(1.,.42,.1)*7.*(1.-smoothstep(0.,.09,edge))*step(.001,uDis);`);
    };
    mat.customProgramCacheKey = () => "dissolve-v1";
    return mat;
  }

  function label(T, text, ink, size = 88) {
    const cv = document.createElement("canvas"); cv.width = 640; cv.height = 136;
    const c = cv.getContext("2d");
    c.font = `600 ${size}px "Pretendard Variable", sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
    if (ink === "dark") { c.fillStyle = "rgba(255,236,200,0.35)"; c.fillText(text, 320, 70.5); c.fillStyle = "#3a220c"; c.fillText(text, 320, 68); }
    else { c.fillStyle = "rgba(10,12,40,0.5)"; c.fillText(text, 320, 70.5); c.fillStyle = "#eef0ff"; c.fillText(text, 320, 68); }
    const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8;
    return t;
  }

  Deck.scene({
    id: "balance",
    title: "무게중심의 이동",
    bg: "#030304",
    ink: "#ffffff",
    mood: 0.6,
    transition: "blinds",
    beats: [
      { dur: 3.8, note: "개발자의 일을 저울에 올려 보면, 지금까지는 손으로 하는 일의 비중이 컸습니다.\n타이핑, 문법, 매번 반복해서 쓰는 코드." },
      { dur: 4.2, note: "그 무게가 반대편으로 옮겨 가고 있습니다. 무엇을 만들지 설계하고, 맞는지 검증하고, 좋은지 알아보는 감각.\n손보다 판단이 중요해집니다." },
    ],
    create(ctx) {
      const { T, g } = ctx;
      const scene = new T.Scene();
      // 금속 반사용 환경: 어두운 방 + 소프트박스 몇 개
      const envS = new T.Scene();
      envS.add(new T.Mesh(new T.SphereGeometry(30, 32, 16), new T.MeshBasicMaterial({ color: new T.Color(0.012, 0.011, 0.012), side: T.BackSide })));
      const soft = (w, h, pos, k, col) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(...col).multiplyScalar(k), side: T.DoubleSide })); m.position.set(...pos); m.lookAt(0, 0, 0); envS.add(m); };
      soft(9, 3.5, [0, 13, 2], 7, [1, 0.95, 0.86]);
      soft(2.5, 9, [-11, 5, 6], 2.4, [1, 0.88, 0.74]);
      soft(2.5, 9, [11, 4, -5], 1.3, [0.7, 0.76, 1]);
      soft(16, 1.3, [0, 1.2, -13], 0.9, [1, 0.7, 0.45]);
      soft(6, 2, [4, 2, 12], 0.8, [1, 0.92, 0.85]);
      scene.environment = ctx.env(envS, 0.03);

      const root = new T.Group(); scene.add(root);   // 반사 때 통째로 뒤집는 부분
      const brass = new T.MeshStandardMaterial({ color: new T.Color("#c99a45"), metalness: 1, roughness: 0.27, envMapIntensity: 1.25 });
      const dark = new T.MeshStandardMaterial({ color: new T.Color("#16140f"), metalness: 0.6, roughness: 0.38, envMapIntensity: 0.8 });
      const cast = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

      // 받침 · 기둥
      const base1 = cast(new T.Mesh(new T.CylinderGeometry(1.25, 1.42, 0.2, 64), dark)); base1.position.y = 0.1; root.add(base1);
      const base2 = cast(new T.Mesh(new T.CylinderGeometry(0.92, 1.08, 0.16, 64), brass)); base2.position.y = 0.28; root.add(base2);
      const base3 = cast(new T.Mesh(new T.CylinderGeometry(0.36, 0.6, 0.3, 48), brass)); base3.position.y = 0.5; root.add(base3);
      const post = cast(new T.Mesh(new T.CylinderGeometry(0.085, 0.13, PIVOT - 0.62, 32), brass)); post.position.y = 0.65 + (PIVOT - 0.62) / 2 - 0.05; root.add(post);
      [1.6, 3.4, 5.1].forEach((y) => { const r = cast(new T.Mesh(new T.TorusGeometry(0.13, 0.035, 12, 40), brass)); r.rotation.x = Math.PI / 2; r.position.y = y; root.add(r); });
      const cap = cast(new T.Mesh(new T.SphereGeometry(0.21, 40, 24), brass)); cap.position.y = PIVOT; root.add(cap);
      const fin = cast(new T.Mesh(new T.ConeGeometry(0.075, 0.5, 24), brass)); fin.position.y = PIVOT + 0.42; root.add(fin);
      // 눈금판
      const dial = cast(new T.Mesh(new T.TorusGeometry(0.95, 0.018, 8, 80, Math.PI * 0.36), brass));
      dial.rotation.z = -Math.PI / 2 - Math.PI * 0.18; dial.position.y = PIVOT; dial.position.z = 0.16; root.add(dial);
      for (let k = -4; k <= 4; k++) {
        const a = -Math.PI / 2 + k * 0.075, tk = cast(new T.Mesh(new T.BoxGeometry(0.012, k === 0 ? 0.16 : 0.09, 0.012), brass));
        tk.position.set(Math.cos(a) * 0.95, PIVOT + Math.sin(a) * 0.95, 0.16); tk.rotation.z = a + Math.PI / 2; root.add(tk);
      }

      // 가로대 (가운데가 두껍고 끝이 가는 판) + 바늘
      const beam = new T.Group(); beam.position.y = PIVOT; root.add(beam);
      const bs = new T.Shape(), L = ARM + 0.12, prof = (x) => 0.045 + 0.085 * Math.pow(1 - Math.abs(x) / L, 1.6);
      const N = 40;
      for (let k = 0; k <= N; k++) { const x = -L + (2 * L * k) / N; k ? bs.lineTo(x, prof(x)) : bs.moveTo(x, prof(x)); }
      for (let k = N; k >= 0; k--) { const x = -L + (2 * L * k) / N; bs.lineTo(x, -prof(x) * 0.7); }
      const bgeo = new T.ExtrudeGeometry(bs, { depth: 0.12, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 3 }); bgeo.translate(0, 0, -0.06);
      beam.add(cast(new T.Mesh(bgeo, brass)));
      [-1, 1].forEach((sgn) => {
        const e = cast(new T.Mesh(new T.SphereGeometry(0.085, 24, 16), brass)); e.position.x = sgn * ARM; beam.add(e);
        const hook = cast(new T.Mesh(new T.TorusGeometry(0.075, 0.018, 10, 32), brass)); hook.position.set(sgn * ARM, -0.13, 0); beam.add(hook);
      });
      const needle = cast(new T.Mesh(new T.BoxGeometry(0.03, 0.9, 0.02), brass)); needle.position.set(0, -0.45, 0.2); beam.add(needle);

      // 접시: 사슬 셋으로 매달린다 (가로대 끝을 따라 움직이지만 늘 수평)
      const chainGeo = new T.CylinderGeometry(0.011, 0.011, 1, 6);
      const panProf = [[0.001, 0], [PAN_R * 0.55, 0.0], [PAN_R * 0.85, 0.03], [PAN_R, 0.1], [PAN_R * 0.98, 0.115], [PAN_R * 0.84, 0.045], [0.001, 0.02]].map(([r, y]) => new T.Vector2(r, y));
      const pans = [-1, 1].map((sgn) => {
        const grp = new T.Group(); root.add(grp);
        grp.add(cast(new T.Mesh(new T.LatheGeometry(panProf, 64), brass)));
        [Math.PI / 2, (Math.PI * 7) / 6, (Math.PI * 11) / 6].forEach((a) => {
          const A = new T.Vector3(0, DROP - 0.2, 0), B = new T.Vector3(Math.cos(a) * PAN_R * 0.93, 0.1, Math.sin(a) * PAN_R * 0.93);
          const m = cast(new T.Mesh(chainGeo, brass)); m.position.copy(A).add(B).multiplyScalar(0.5); m.scale.y = A.distanceTo(B);
          m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), B.clone().sub(A).normalize()); grp.add(m);
        });
        const ring = cast(new T.Mesh(new T.TorusGeometry(0.06, 0.016, 8, 24), brass)); ring.position.y = DROP - 0.2; ring.rotation.y = Math.PI / 2; grp.add(ring);
        return { grp, sgn };
      });

      // 판
      const plateGeo = rbox(T, BW, BH, BD, 0.05);
      const decalGeo = new T.PlaneGeometry(BW * 0.92, BH * 0.78);
      const mkBlock = (txt, warm) => {
        const u = { value: 0 };
        const mat = dissolvable(new T.MeshPhysicalMaterial(warm
          ? { color: new T.Color("#c98a3e"), roughness: 0.4, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.3, envMapIntensity: 0.9 }
          : { color: new T.Color("#4650cf"), roughness: 0.3, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.18, emissive: new T.Color("#141c7a"), emissiveIntensity: 0.55, envMapIntensity: 1.0 }), u);
        const grp = new T.Group(); root.add(grp);
        const m = cast(new T.Mesh(plateGeo, mat)); grp.add(m);
        const tex = label(T, txt, warm ? "dark" : "light");
        const dm = new T.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.55, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, envMapIntensity: 0.4,
          emissiveMap: warm ? null : tex, emissive: new T.Color(warm ? 0 : 0.55, warm ? 0 : 0.58, warm ? 0 : 0.9) });
        const decal = new T.Mesh(decalGeo, dm); decal.position.z = BD / 2 + 0.004; grp.add(decal);
        return { grp, m, mat, u, dm };
      };
      const lefts = LEFT.map((t) => mkBlock(t, true));
      const rights = RIGHT.map((t) => mkBlock(t, false));

      // 불씨: 흩어지는 판마다 입자 수백 개
      const NE = 520, re = rng(5);
      const epos = new Float32Array(NE * 3 * 3), eaux = new Float32Array(NE * 3 * 4), eid = new Float32Array(NE * 3);
      for (let k = 0; k < NE * 3; k++) {
        const lx = (re() - 0.5) * BW, ly = (re() - 0.5) * BH, lz = (re() - 0.5) * BD;
        epos[k * 3] = lx; epos[k * 3 + 1] = ly; epos[k * 3 + 2] = lz;
        const dv = (1 - (ly / BH + 0.5)) * 0.58 + re() * 0.42;
        eaux[k * 4] = (dv + 0.1) / 1.25 * DIS_T; eaux[k * 4 + 1] = re(); eaux[k * 4 + 2] = re(); eaux[k * 4 + 3] = re();
        eid[k] = Math.floor(k / NE);
      }
      const egeo = new T.BufferGeometry();
      egeo.setAttribute("position", new T.BufferAttribute(epos, 3)); egeo.setAttribute("aux", new T.BufferAttribute(eaux, 4)); egeo.setAttribute("bid", new T.BufferAttribute(eid, 1));
      const emU = { uT: { value: [-1, -1, -1] }, uC: { value: [new T.Vector3(), new T.Vector3(), new T.Vector3()] }, uPx: { value: 800 }, uTime: { value: 0 } };
      const embers = new T.Points(egeo, new T.ShaderMaterial({
        uniforms: emU, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
        vertexShader: `attribute vec4 aux; attribute float bid; uniform float uT[3]; uniform vec3 uC[3]; uniform float uPx, uTime; varying float vB; varying float vK;
          void main(){ int i=int(bid+.5); float tau=uT[i]-aux.x;
            vec3 p=uC[i]+position;
            float tt=max(tau,0.);
            p+=vec3(sin(tt*1.7+aux.y*30.)*.25*tt+position.x*.35*tt, .55*tt+.22*tt*tt, cos(tt*1.3+aux.z*30.)*.25*tt+position.z*.35*tt);
            vB=step(0.,tau)*smoothstep(0.,.12,tau)*(1.-smoothstep(.9,2.6,tau))*(.5+.5*aux.w);
            vK=clamp(tau/2.2,0.,1.);
            vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=max(1.,(.026+.03*aux.w)*(1.-vK*.5)*uPx/-mv.z); }`,
        fragmentShader: `varying float vB; varying float vK; void main(){ vec2 d=gl_PointCoord-.5; float a=exp(-dot(d,d)*12.);
          vec3 c=mix(vec3(1.,.62,.22), vec3(.9,.25,.06), vK); gl_FragColor=vec4(c*vB*a*5.,1.); }`,
      }));
      embers.frustumCulled = false; root.add(embers);

      // 조명: 거의 수직인 스포트라이트 하나 + 아주 약한 채움
      const SPOT = new T.Vector3(0.0, 14.5, 1.6), AIM = new T.Vector3(0, 0, 0.1);
      const spot = new T.SpotLight(new T.Color("#ffe8c8"), 900, 0, 0.36, 0.55, 2);
      spot.position.copy(SPOT); spot.target.position.copy(AIM);
      spot.castShadow = true; spot.shadow.mapSize.set(2048, 2048); spot.shadow.bias = -0.00025; spot.shadow.normalBias = 0.02;
      spot.shadow.camera.near = 6; spot.shadow.camera.far = 20; spot.layers.enableAll();
      root.add(spot, spot.target);
      const fill = new T.DirectionalLight(new T.Color("#9fb0ff"), 0.22); fill.position.set(2, 3, 12); fill.layers.enableAll(); root.add(fill);
      const hemi = new T.HemisphereLight(new T.Color("#232633"), new T.Color("#000000"), 0.35); hemi.layers.enableAll(); root.add(hemi);

      // 빛 기둥 + 먼지 (반사에는 넣지 않는다: 층 2)
      const dir = AIM.clone().sub(SPOT).normalize(), LEN = SPOT.distanceTo(AIM), RAD = Math.tan(0.36) * LEN * 1.02;
      const coneGeo = new T.ConeGeometry(RAD, LEN, 96, 24, true); coneGeo.translate(0, -LEN / 2, 0);
      const coneU = { uApex: { value: SPOT.clone() }, uDir: { value: dir.clone() }, uLen: { value: LEN }, uI: { value: 1 }, uTime: { value: 0 } };
      const cone = new T.Mesh(coneGeo, new T.ShaderMaterial({
        uniforms: coneU, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
        vertexShader: `varying vec3 vW; varying vec3 vN; varying vec3 vV; void main(){ vec4 wp=modelMatrix*vec4(position,1.); vW=wp.xyz; vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-wp.xyz); gl_Position=projectionMatrix*viewMatrix*wp; }`,
        fragmentShader: `${Deck.glsl.noise}
          uniform vec3 uApex, uDir; uniform float uLen, uI, uTime; varying vec3 vW; varying vec3 vN; varying vec3 vV;
          void main(){ float f=abs(dot(normalize(vN),normalize(vV))); float soft=pow(f,2.2);
            float al=clamp(dot(vW-uApex,uDir)/uLen,0.,1.);
            float fall=smoothstep(0.,.1,al)*(1.-al*.45)*smoothstep(1.,.93,al);
            float n=fbm(vW*.55+vec3(0.,-uTime*.06,uTime*.02))*.75+.25;
            gl_FragColor=vec4(vec3(1.,.9,.74)*soft*fall*n*.03*uI,1.); }`,
      }));
      cone.position.copy(SPOT); cone.quaternion.setFromUnitVectors(new T.Vector3(0, -1, 0), dir); cone.layers.set(2); scene.add(cone);
      const NDU = 1300, rdu = rng(77), dpos = new Float32Array(NDU * 3), daux = new Float32Array(NDU * 4);
      const perp1 = new T.Vector3(1, 0, 0).cross(dir).normalize(), perp2 = dir.clone().cross(perp1).normalize();
      for (let k = 0; k < NDU; k++) {
        const al = 0.12 + rdu() * 0.86, rr = Math.sqrt(rdu()) * Math.tan(0.36) * LEN * al, a = rdu() * TAU;
        const p = SPOT.clone().addScaledVector(dir, LEN * al).addScaledVector(perp1, Math.cos(a) * rr).addScaledVector(perp2, Math.sin(a) * rr);
        dpos[k * 3] = p.x; dpos[k * 3 + 1] = p.y; dpos[k * 3 + 2] = p.z;
        daux[k * 4] = rdu() * TAU; daux[k * 4 + 1] = 0.3 + rdu() * 0.7; daux[k * 4 + 2] = rdu(); daux[k * 4 + 3] = rr / (Math.tan(0.36) * LEN * al + 1e-3);
      }
      const dgeo = new T.BufferGeometry(); dgeo.setAttribute("position", new T.BufferAttribute(dpos, 3)); dgeo.setAttribute("aux", new T.BufferAttribute(daux, 4));
      const dustU = { uTime: coneU.uTime, uPx: emU.uPx };
      const dust = new T.Points(dgeo, new T.ShaderMaterial({
        uniforms: dustU, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
        vertexShader: `attribute vec4 aux; uniform float uTime, uPx; varying float vB;
          void main(){ vec3 p=position+vec3(sin(uTime*.09*aux.y+aux.x)*.35, sin(uTime*.05+aux.x*2.)*.4, cos(uTime*.07*aux.y+aux.x*1.3)*.35);
            float tw=.55+.45*sin(uTime*(.8+aux.y)+aux.x*5.);
            vB=(1.-aux.w*aux.w)*tw*(.25+.75*aux.z);
            vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=max(1.,(.014+.02*aux.z)*uPx/-mv.z); }`,
        fragmentShader: `varying float vB; void main(){ vec2 d=gl_PointCoord-.5; float a=exp(-dot(d,d)*12.); gl_FragColor=vec4(vec3(1.,.9,.75)*vB*a*.9,1.); }`,
      }));
      dust.frustumCulled = false; dust.layers.set(2); scene.add(dust);

      // 바닥: 윤이 나는 검은 돌. 스포트라이트 웅덩이와 그림자를 받고, 반쯤 비친다 (층 1)
      const floor = new T.Mesh(new T.PlaneGeometry(80, 80), new T.MeshStandardMaterial({ color: new T.Color("#060607"), roughness: 0.2, metalness: 0, envMapIntensity: 0.18, transparent: true, opacity: 0.74 }));
      floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.layers.set(1); scene.add(floor);
      // 바닥 너머는 어둠으로 녹아든다
      const veil = ctx.pass(`uniform float uAspect; void main(){ vec2 d=(vUv-vec2(.5,.42))*vec2(uAspect,1.); float v=smoothstep(.35,1.25,length(d*vec2(.8,1.1))); o=vec4(0.,0.,0.,v*.55); }`,
        { uAspect: 16 / 9 }, { blending: T.NormalBlending });

      const cam = ctx.camera(33, 0.1, 200);

      // ── 글자 ──
      const sh = { blur: 24, alpha: 0.6 };
      const H = ctx.text("개발자의 무게중심이\n옮겨 간다", { size: 88, weight: 300, tracking: -0.035, leading: 1.16, shadow: sh });
      const C = ctx.text([{ t: "손보다 " }, { t: "판단", color: ACCENT, weight: 500 }], { size: 76, weight: 300, tracking: -0.03, shadow: sh });

      const _v = new T.Vector3();
      // 판 위치: 접시 위 쌓인 자리 + 떨어지는 중이면 높이 + 흔들림
      const slotY = (pan, j) => pan.grp.position.y + 0.115 + BH / 2 + j * (BH + GAP);
      function placeBlock(b, pan, j, tRel, seed) {
        const fall = tRel < TF ? FALL - 0.5 * G * tRel * tRel : 0;
        const after = Math.max(0, tRel - TF);
        const squash = tRel >= TF ? 1 - 0.07 * Math.exp(-after * 14) * Math.cos(after * 30) : 1;
        b.grp.position.set(pan.grp.position.x + (j % 2 ? 0.04 : -0.03) * (seed % 3 - 1), slotY(pan, j) + fall - (1 - squash) * BH * 0.5, 0.02 * Math.sin(seed * 7.1));
        const rot = tRel < TF ? (1 - tRel / TF) : 0;
        b.grp.rotation.set(0.25 * rot * Math.sin(seed * 3), (seed % 2 ? 0.05 : -0.04) + 0.6 * rot * Math.sin(seed * 5), 0.2 * rot * Math.cos(seed * 2));
        b.grp.scale.set(1, squash, 1);
        b.grp.visible = tRel >= 0;
      }

      return {
        render(s, hdr) {
          const a0 = s.at(0), a1 = s.at(1);
          coneU.uTime.value = s.time; emU.uTime.value = s.time;
          // 저울
          const th = angleAt(s);
          beam.rotation.z = th;
          pans.forEach((p) => p.grp.position.set(p.sgn * ARM * Math.cos(th), PIVOT + p.sgn * ARM * Math.sin(th) - DROP + 0.05, 0));
          const [panL, panR] = pans;
          lefts.forEach((b, i) => {
            placeBlock(b, panL, i, a0 - L_DROP[i], i + 1);
            const dv = prog(a1, L_DIS[i], DIS_T, ease.linear);
            b.u.value = dv; b.dm.opacity = 1 - clamp(dv * 3.5);
            if (dv >= 0.999) b.grp.visible = false;
            s.cue("inL" + i, a0 > L_DROP[i] + TF, "thud", { vol: 0.32 + i * 0.06 });
            s.cue("dis" + i, a1 > L_DIS[i], "shimmer", { vol: 0.05 });
          });
          rights.forEach((b, i) => {
            const tRel = i === 0 ? a0 - R0_DROP : a1 - R_DROP[i];
            placeBlock(b, panR, i, tRel, i + 5);
            b.u.value = 0; b.dm.opacity = 1;
            s.cue("inR" + i, tRel > TF, i === 3 ? "impact" : "thud", { vol: i === 3 ? 0.5 : 0.36 });
            if (i === 0) s.cue("glass0", tRel > TF, "glass", { note: 81, vol: 0.06 });
          });
          s.cue("sweep", a1 > 0.1, "sweep", { up: true, dur: 1.6 });
          s.cue("final", a1 > 2.6, "swell", { root: 50, vol: 0.06 });
          // 불씨: 흩어지기 시작한 순간의 판 위치에서 출발
          root.scale.y = 1; root.updateMatrixWorld(true);
          lefts.forEach((b, i) => {
            const t0 = a1 - L_DIS[i];
            emU.uT.value[i] = t0;
            if (a1 >= 0) {
              // 흩어지기 시작한 시각의 각도로 판 위치를 다시 계산 (시간만의 함수)
              const sAt = { at: (k) => (k === 0 ? 999 : L_DIS[i]) };
              const th0 = angleAt(sAt);
              const py = PIVOT - ARM * Math.sin(th0) - DROP + 0.05;
              emU.uC.value[i].set(-ARM * Math.cos(th0), py + 0.115 + BH / 2 + i * (BH + GAP), 0);
            }
          });
          embers.visible = a1 >= 0;

          // 카메라: 천천히 흔들리며 살짝 다가선다
          const push = prog(a0, 0, 6, ease.inOut2) * 0.6 + prog(a1, 0, 5, ease.inOut2) * 0.5;
          cam.position.set(-1.15 + Math.sin(s.time * 0.07) * 0.6 + s.mouse.x * 0.5, 4.45 + Math.cos(s.time * 0.05) * 0.15 - s.mouse.y * 0.3, 17.6 - push);
          cam.lookAt(-2.5, 4.35, 0);
          ctx.fit(cam); cam.updateMatrixWorld();
          emU.uPx.value = hdr.height / (2 * Math.tan((cam.fov * Math.PI) / 360));

          const r = ctx.r;
          // 1) 바닥에 비친 저울 (조명까지 같이 뒤집는다)
          root.scale.y = -1; root.updateMatrixWorld(true);
          cam.layers.set(0);
          ctx.draw(scene, cam, hdr);
          // 2) 바닥 (스포트 웅덩이 · 그림자)
          root.scale.y = 1; root.updateMatrixWorld(true);
          cam.layers.set(1);
          ctx.draw(scene, cam, hdr);
          r.setRenderTarget(hdr); r.clear(false, true, false);
          // 3) 실제 저울 + 빛 기둥 + 먼지
          cam.layers.set(0); cam.layers.enable(2);
          ctx.draw(scene, cam, hdr);
          veil.u.uAspect.value = g.W / g.H; veil.render(hdr);

          // 글자
          H.at(118, 176).show(prog(a0, 0.15, 1.2, ease.linear), { style: "rise", stagger: 0.32 });
          C.at(118, 968).show(prog(a1, 2.5, 1.1, ease.linear), { style: "rise", stagger: 0.35 });
          return { bloom: 0.7, threshold: 0.85, knee: 0.6, radius: 1.0, exposure: 1.05, tone: "agx", vignette: 0.5, grain: 0.05, ca: 0.35, contrast: 1.1, saturation: 1.08, warm: 0.15 };
        },
      };
    },
  });
})();
