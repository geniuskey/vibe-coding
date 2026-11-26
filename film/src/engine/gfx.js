// 그래픽 파이프라인: WebGL2(three.js) 위에
//   장면(HDR, 선형) → 블룸 → 톤 매핑·색 보정(LDR, sRGB) → 2D 겹레이어(글자·도형) → 전환 → 그레인·디더 → 화면
// 1920×1080 논리 좌표를 쓰되, 화면 비율이 다르면 논리 좌표 바깥까지 그림을 채운다(가운데 1920×1080은 항상 보임).
(() => {
  const T = window.THREE;
  const { clamp } = Deck.util;
  const G = Deck.glsl;
  const LW = 1920, LH = 1080, ASPECT = LW / LH;

  function createGfx(canvas) {
    const r = new T.WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, depth: true, powerPreference: "high-performance" });
    r.autoClear = false;
    r.outputColorSpace = T.LinearSRGBColorSpace; // 인코딩은 직접 한다
    r.toneMapping = T.NoToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = T.PCFSoftShadowMap;
    r.localClippingEnabled = true;
    r.setPixelRatio(1);
    const gl = r.getContext();
    gl.getExtension("EXT_color_buffer_float");
    gl.getExtension("EXT_color_buffer_half_float");
    gl.getExtension("OES_texture_float_linear");

    const TRI = new T.BufferGeometry();
    TRI.setAttribute("position", new T.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const NOCAM = new T.Camera();

    const g = {
      T, r, gl, W: 2, H: 2, dpr: 1, q: 1, msaa: 4,
      view: { x0: 0, y0: 0, x1: LW, y1: LH, w: LW, h: LH, scale: 1 },
      ppu: 1,
      ortho: new T.OrthographicCamera(0, LW, 0, LH, -1000, 1000),
      targets: new Set(),
      owner: null,
    };

    // ── 렌더 타깃 ──────────────────────────────────────────────────────
    // scale: 화면 크기 대비 배율. hdr:true면 적응형 품질(q)도 곱한다. w/h를 주면 고정 크기.
    g.target = ({ scale = 1, w = 0, h = 0, hdr = true, float = hdr, depth = false, samples = 0, filter = T.LinearFilter, wrap = T.ClampToEdgeWrapping, quality = hdr } = {}) => {
      const size = () => [w || Math.max(1, Math.round(g.W * scale * (quality ? g.q : 1))), h || Math.max(1, Math.round(g.H * scale * (quality ? g.q : 1)))];
      const [tw, th] = size();
      const rt = new T.WebGLRenderTarget(tw, th, {
        type: float ? T.HalfFloatType : T.UnsignedByteType, depthBuffer: depth, samples,
        minFilter: filter, magFilter: filter, wrapS: wrap, wrapT: wrap, generateMipmaps: false,
      });
      rt._size = size; rt._fixed = !!(w && h); rt._owner = g.owner; rt._parked = false;
      g.targets.add(rt);
      return rt;
    };
    g.free = (rt) => { g.targets.delete(rt); rt.dispose(); };
    // 쓰지 않는 장면의 타깃은 2×2로 줄여 메모리를 돌려준다
    g.park = (owner, on) => {
      for (const rt of g.targets) {
        if (rt._owner !== owner || rt._fixed || rt._parked === on) continue;
        rt._parked = on;
        if (on) rt.setSize(2, 2); else rt.setSize(...rt._size());
      }
    };
    const resizeTargets = () => { for (const rt of g.targets) if (!rt._fixed && !rt._parked) rt.setSize(...rt._size()); };

    // ── 전체 화면 패스 ──────────────────────────────────────────────────
    g.pass = (frag, uniforms = {}, { blending = T.NoBlending, defines = {} } = {}) => {
      const u = { uRes: { value: new T.Vector2(1, 1) }, uTime: { value: 0 } };
      for (const k in uniforms) u[k] = uniforms[k] && typeof uniforms[k] === "object" && "value" in uniforms[k] ? uniforms[k] : { value: uniforms[k] };
      const defs = Object.entries(defines).map(([k, v]) => `#define ${k} ${v}\n`).join("");
      const mat = new T.RawShaderMaterial({
        glslVersion: T.GLSL3,
        vertexShader: "precision highp float; in vec3 position; out vec2 vUv; void main(){ vUv=position.xy*.5+.5; gl_Position=vec4(position.xy,0.,1.); }",
        fragmentShader: "precision highp float; precision highp int; in vec2 vUv; out vec4 o; uniform vec2 uRes; uniform float uTime;\n" + defs + frag,
        uniforms: u, depthTest: false, depthWrite: false, blending, transparent: blending !== T.NoBlending,
        premultipliedAlpha: true,
      });
      const mesh = new T.Mesh(TRI, mat); mesh.frustumCulled = false;
      const sc = new T.Scene(); sc.add(mesh); sc.matrixWorldAutoUpdate = false;
      return {
        u, mat,
        render(target = null, clear = false) {
          u.uRes.value.set(target ? target.width : g.W, target ? target.height : g.H);
          r.setRenderTarget(target);
          if (clear) { r.setClearColor(0x000000, 0); r.clear(true, false, false); }
          r.render(sc, NOCAM);
        },
        dispose() { mat.dispose(); },
      };
    };

    g.clear = (target, color = 0x000000, alpha = 1) => { r.setRenderTarget(target); r.setClearColor(color, alpha); r.clear(true, true, false); };
    // MSAA 타깃은 render()가 끝날 때만 텍스처로 풀린다. 아무것도 안 그린 프레임도 확실히 풀어 준다.
    const EMPTY = new T.Scene();
    g.resolve = (target) => { if (target && target.samples > 0) { r.setRenderTarget(target); r.render(EMPTY, NOCAM); } };
    g.draw = (scene, cam, target, { clear = false, color = 0x000000, alpha = 1 } = {}) => {
      if (cam && cam.isPerspectiveCamera) g.fit(cam);
      r.setRenderTarget(target);
      if (clear) { r.setClearColor(color, alpha); r.clear(true, true, false); }
      r.render(scene, cam);
    };
    const copyPass = g.pass("uniform sampler2D tA; uniform float uA; void main(){ o=texture(tA,vUv)*uA; }", { tA: null, uA: 1 });
    const addPass = g.pass("uniform sampler2D tA; uniform float uA; void main(){ o=texture(tA,vUv)*uA; }", { tA: null, uA: 1 }, { blending: T.CustomBlending });
    addPass.mat.blendSrc = T.OneFactor; addPass.mat.blendDst = T.OneMinusSrcAlphaFactor;
    addPass.mat.blendSrcAlpha = T.OneFactor; addPass.mat.blendDstAlpha = T.OneMinusSrcAlphaFactor;
    g.copy = (src, dst, a = 1) => { copyPass.u.tA.value = src.texture || src; copyPass.u.uA.value = a; copyPass.render(dst); };
    // 미리 곱한 알파로 위에 얹기
    g.over = (src, dst, a = 1) => { addPass.u.tA.value = src.texture || src; addPass.u.uA.value = a; addPass.render(dst); };

    // ── 카메라 ─────────────────────────────────────────────────────────
    // 16:9보다 좁은 화면에서는 가로 시야를 지키도록 세로 시야를 넓힌다(내용이 잘리지 않게)
    g.fit = (cam) => {
      const base = cam.userData.fov ?? (cam.userData.fov = cam.fov);
      const a = g.W / g.H;
      cam.aspect = a;
      cam.fov = a < ASPECT ? (2 * Math.atan(Math.tan((base * Math.PI) / 360) * (ASPECT / a)) * 180) / Math.PI : base;
      cam.updateProjectionMatrix();
    };
    const _v = new T.Vector3();
    // 3D 좌표 → 논리 화면 좌표 [x, y, 깊이]
    g.project = (v, cam) => {
      _v.copy(v).project(cam);
      const vw = g.view;
      return [vw.x0 + (_v.x * 0.5 + 0.5) * vw.w, vw.y0 + (0.5 - _v.y * 0.5) * vw.h, _v.z];
    };

    // ── 블룸 ──────────────────────────────────────────────────────────
    const LEVELS = 6;
    const down = [], up = [];
    for (let i = 0; i < LEVELS; i++) {
      down.push(g.target({ scale: 1 / (2 << i) }));
      up.push(g.target({ scale: 1 / (2 << i) }));
    }
    // 13탭 다운샘플 (첫 단계는 밝기 문턱 + Karis 평균으로 반짝임 억제)
    const downPass = g.pass(/* glsl */ `
      uniform sampler2D tA; uniform vec2 uPx; uniform float uFirst, uThr, uKnee;
      vec3 pre(vec3 c){ c=min(c, vec3(64.)); if(uFirst<.5) return c;
        float b=max(c.r,max(c.g,c.b)); float s=clamp(b-uThr+uKnee,0.,2.*uKnee); s=s*s/(4.*uKnee+1e-5);
        return c*max(s,b-uThr)/max(b,1e-5); }
      vec3 S(vec2 d){ return pre(texture(tA, vUv+d*uPx).rgb); }
      float kw(vec3 c){ return 1./(1.+dot(c,vec3(.2126,.7152,.0722))); }
      void main(){
        vec3 a=S(vec2(-2,2)), b=S(vec2(0,2)), c=S(vec2(2,2)), d=S(vec2(-2,0)), e=S(vec2(0)), f=S(vec2(2,0)),
             gg=S(vec2(-2,-2)), h=S(vec2(0,-2)), i=S(vec2(2,-2)), j=S(vec2(-1,1)), k=S(vec2(1,1)), l=S(vec2(-1,-1)), m=S(vec2(1,-1));
        vec3 r;
        if(uFirst>.5){
          vec3 g0=(a+b+d+e)*.25, g1=(b+c+e+f)*.25, g2=(d+e+gg+h)*.25, g3=(e+f+h+i)*.25, g4=(j+k+l+m)*.25;
          float w0=kw(g0)*.125, w1=kw(g1)*.125, w2=kw(g2)*.125, w3=kw(g3)*.125, w4=kw(g4)*.5;
          r=(g0*w0+g1*w1+g2*w2+g3*w3+g4*w4)/(w0+w1+w2+w3+w4);
        } else r=e*.125+(a+c+gg+i)*.03125+(b+d+f+h)*.0625+(j+k+l+m)*.125;
        o=vec4(r,1.);
      }`, { tA: null, uPx: new T.Vector2(), uFirst: 0, uThr: 1, uKnee: 0.5 });
    const upPass = g.pass(/* glsl */ `
      uniform sampler2D tA, tB; uniform vec2 uPx; uniform float uR;
      void main(){ vec2 d=uPx*uR; vec3 c=vec3(0);
        c+=texture(tA,vUv+vec2(-d.x,d.y)).rgb+texture(tA,vUv+vec2(d.x,d.y)).rgb+texture(tA,vUv+vec2(-d.x,-d.y)).rgb+texture(tA,vUv+vec2(d.x,-d.y)).rgb;
        c+=2.*(texture(tA,vUv+vec2(0,d.y)).rgb+texture(tA,vUv+vec2(0,-d.y)).rgb+texture(tA,vUv+vec2(d.x,0)).rgb+texture(tA,vUv+vec2(-d.x,0)).rgb);
        c+=4.*texture(tA,vUv).rgb;
        o=vec4(texture(tB,vUv).rgb+c/16.,1.); }`, { tA: null, tB: null, uPx: new T.Vector2(), uR: 1 });

    function bloom(src, threshold, knee, radius) {
      let s = src;
      for (let i = 0; i < LEVELS; i++) {
        downPass.u.tA.value = s.texture; downPass.u.uPx.value.set(1 / s.width, 1 / s.height);
        downPass.u.uFirst.value = i === 0 ? 1 : 0; downPass.u.uThr.value = threshold; downPass.u.uKnee.value = Math.max(1e-3, knee);
        downPass.render(down[i]); s = down[i];
      }
      let acc = down[LEVELS - 1];
      for (let i = LEVELS - 2; i >= 0; i--) {
        upPass.u.tA.value = acc.texture; upPass.u.tB.value = down[i].texture;
        upPass.u.uPx.value.set(1 / acc.width, 1 / acc.height); upPass.u.uR.value = radius;
        upPass.render(up[i]); acc = up[i];
      }
      return acc;
    }

    // ── 톤 매핑 · 색 보정 ───────────────────────────────────────────────
    const gradePass = g.pass(G.color + G.hash + /* glsl */ `
      uniform sampler2D tA, tB; uniform float uExp, uBloom, uTone, uCon, uSat, uVig, uCA, uWarm, uBloomOn;
      uniform vec3 uLift, uGain, uTint; uniform float uAspect;
      void main(){
        vec2 d=vUv-.5; vec3 c;
        if(uCA>0.){ vec2 k=d*dot(d,d)*uCA*.0075; c=vec3(texture(tA,vUv-k).r, texture(tA,vUv).g, texture(tA,vUv+k).b); }
        else c=texture(tA,vUv).rgb;
        c=max(c,0.);
        if(uBloomOn>.5) c+=texture(tB,vUv).rgb*(uBloom/6.);
        c*=uExp;
        c*=vec3(1.+uWarm*.10, 1., 1.-uWarm*.12);
        if(uTone>1.5) c=tmAces(c); else if(uTone>.5) c=tmAgx(c); else c=clamp(c,0.,1.);
        c=toSrgb(c);
        c=(c-.5)*uCon+.5;
        c=mix(vec3(luma(c)), c, uSat);
        c=c*uGain+uLift*(1.-c);
        c*=uTint;
        float v=length(d)*1.414;
        c*=1.-uVig*smoothstep(.2,1.,v);
        o=vec4(clamp(c,0.,1.),1.);
      }`, {
      tA: null, tB: null, uExp: 1, uBloom: 0, uBloomOn: 0, uTone: 1, uCon: 1, uSat: 1, uVig: 0, uCA: 0, uWarm: 0,
      uLift: new T.Vector3(), uGain: new T.Vector3(1, 1, 1), uTint: new T.Vector3(1, 1, 1), uAspect: ASPECT,
    });
    const TONE = { none: 0, agx: 1, aces: 2 };
    g.post = (hdr, out, o = {}) => {
      const amt = o.bloom ?? 0.12;
      const b = amt > 0 ? bloom(hdr, o.threshold ?? 0.9, o.knee ?? 0.5, o.radius ?? 1.0) : null;
      const u = gradePass.u;
      u.tA.value = hdr.texture; u.tB.value = b ? b.texture : null; u.uBloomOn.value = b ? 1 : 0;
      u.uBloom.value = amt; u.uExp.value = o.exposure ?? 1; u.uTone.value = TONE[o.tone ?? "agx"] ?? 1;
      u.uCon.value = o.contrast ?? 1; u.uSat.value = o.saturation ?? 1; u.uVig.value = o.vignette ?? 0.25;
      u.uCA.value = o.ca ?? 0; u.uWarm.value = o.warm ?? 0;
      const L = o.lift || [0, 0, 0], Gn = o.gain || [1, 1, 1], Ti = o.tint || [1, 1, 1];
      u.uLift.value.set(...L); u.uGain.value.set(...Gn); u.uTint.value.set(...Ti);
      u.uAspect.value = g.W / g.H;
      gradePass.render(out);
    };

    // ── 최종 출력: 그레인 · 디더 · 암전 ──────────────────────────────────
    const presentPass = g.pass(G.hash + G.color + /* glsl */ `
      uniform sampler2D tA; uniform float uGrain, uBlack, uGS;
      void main(){
        vec3 c=texture(tA,vUv).rgb;
        vec2 px=floor(gl_FragCoord.xy/uGS);
        float f=floor(uTime*24.);
        float n=hash13(vec3(px,f))+hash13(vec3(px+31.7,f+.5))-1.;
        float l=luma(c);
        c+=n*uGrain*(.25+.75*(1.-abs(l*2.-1.)));
        c+=(hash13(vec3(gl_FragCoord.xy,fract(uTime*7.)*91.))-.5)/255.;
        c*=1.-uBlack;
        o=vec4(c,1.);
      }`, { tA: null, uGrain: 0, uBlack: 0, uGS: 1 });
    g.present = (src, { grain = 0.03, black = 0, time = 0 } = {}) => {
      const u = presentPass.u;
      u.tA.value = src.texture; u.uGrain.value = grain; u.uBlack.value = black; u.uTime.value = time;
      u.uGS.value = Math.max(1, Math.round(g.dpr * 0.75));
      presentPass.render(null);
    };

    // ── 크기 ──────────────────────────────────────────────────────────
    g.resize = (cssW, cssH, dpr, maxPixels = 2560 * 1600) => {
      let w = cssW * dpr, h = cssH * dpr;
      const k = Math.min(1, Math.sqrt(maxPixels / (w * h)));
      w = Math.max(2, Math.round(w * k)); h = Math.max(2, Math.round(h * k));
      g.W = w; g.H = h; g.dpr = dpr * k;
      r.setSize(w, h, false);
      const s = Math.min(w / LW, h / LH);
      const vw = w / s, vh = h / s;
      Object.assign(g.view, { scale: s, w: vw, h: vh, x0: (LW - vw) / 2, y0: (LH - vh) / 2, x1: (LW + vw) / 2, y1: (LH + vh) / 2 });
      g.ppu = s;
      Object.assign(g.ortho, { left: g.view.x0, right: g.view.x1, top: g.view.y0, bottom: g.view.y1 });
      g.ortho.updateProjectionMatrix();
      resizeTargets();
    };
    g.setQuality = (q) => { g.q = q; resizeTargets(); };
    // 창 비율과 상관없이 16:9 화면인 것처럼 그린다(썸네일·스냅숏). 타깃 크기는 그대로 두고 비율만 속인다.
    g.with169 = (fn) => {
      const sv = { W: g.W, H: g.H, view: { ...g.view } };
      const k = Math.sqrt((g.W * g.H) / (LW * LH));
      g.W = Math.round(LW * k); g.H = Math.round(LH * k);
      Object.assign(g.view, { x0: 0, y0: 0, x1: LW, y1: LH, w: LW, h: LH });
      Object.assign(g.ortho, { left: 0, right: LW, top: 0, bottom: LH }); g.ortho.updateProjectionMatrix();
      try { return fn(); }
      finally {
        g.W = sv.W; g.H = sv.H; Object.assign(g.view, sv.view);
        Object.assign(g.ortho, { left: g.view.x0, right: g.view.x1, top: g.view.y0, bottom: g.view.y1 }); g.ortho.updateProjectionMatrix();
      }
    };

    // 렌더 타깃 → 2D 캔버스 (썸네일용)
    g.toCanvas = (rt, cv) => {
      const w = rt.width, h = rt.height, buf = new Uint8Array(w * h * 4);
      r.readRenderTargetPixels(rt, 0, 0, w, h, buf);
      const img = new ImageData(w, h), row = w * 4;
      for (let y = 0; y < h; y++) img.data.set(buf.subarray((h - 1 - y) * row, (h - y) * row), y * row);
      const tmp = document.createElement("canvas"); tmp.width = w; tmp.height = h;
      tmp.getContext("2d").putImageData(img, 0, 0);
      const c = cv.getContext("2d"); c.imageSmoothingQuality = "high";
      c.drawImage(tmp, 0, 0, cv.width, cv.height);
    };
    return g;
  }

  Deck.createGfx = createGfx;
  Deck.LW = LW; Deck.LH = LH;
})();
