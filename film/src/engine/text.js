// 글자: 글리프마다 아틀라스에 그려 두고 인스턴스 사각형으로 띄운다.
// 글자 하나하나를 따로 움직일 수 있어서(올라오기, 흐림, 흩어짐, 타자기) 프레젠테이션 문구를 영화 자막처럼 다룰 수 있다.
// 좌표는 논리 픽셀(1920×1080, y 아래로 증가). 3D에 붙일 때는 in3D()를 쓴다.
(() => {
  const T = window.THREE;
  const { clamp, ease, hex, hash } = Deck.util;
  const FAMILY = {
    sans: '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif',
    mono: '"Geist Mono", "Pretendard Variable", ui-monospace, Menlo, Consolas, monospace',
  };
  const fontOf = (size, weight, family) => `${weight} ${size}px ${FAMILY[family] || family}`;
  const M = document.createElement("canvas").getContext("2d");

  const QUAD = new T.InstancedBufferGeometry();
  QUAD.setAttribute("position", new T.BufferAttribute(new Float32Array([-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5]), 2));
  QUAD.setIndex([0, 1, 2, 0, 2, 3]);

  const VERT = /* glsl */ `precision highp float;
in vec2 position; in vec4 iRect, iUv, iT, iF, iC, iL;
uniform mat4 projectionMatrix, modelViewMatrix; uniform vec2 uScreen; uniform float uSnap;
out vec2 vUv; out vec2 vP; flat out vec4 vCell; out vec4 vC; out vec4 vF; flat out vec2 vL;
void main(){
  vec2 c=iRect.xy+iRect.zw*.5;
  vec2 q=position*iRect.zw*iT.z*iL.zw;
  q.x-=q.y*iF.w;
  float s=sin(iT.w), k=cos(iT.w);
  q=vec2(q.x*k-q.y*s, q.x*s+q.y*k);
  vec2 p=c+q+iT.xy;
  vP=p; vUv=iUv.xy+(position+.5)*iUv.zw; vCell=vec4(iUv.xy, iUv.xy+iUv.zw); vC=iC; vF=iF; vL=iL.xy;
  vec4 cp=projectionMatrix*modelViewMatrix*vec4(p,0.,1.);
  // 멈춰 있는 글자는 화면 픽셀 격자에 맞춘다(작은 글씨가 흐려지지 않게)
  if(uSnap>.5 && abs(iT.z-1.)<1e-4 && abs(iT.w)<1e-4 && iF.y<.01 && dot(iT.xy,iT.xy)<1e-6){
    vec4 tl=projectionMatrix*modelViewMatrix*vec4(iRect.xy+iT.xy,0.,1.);
    vec2 px=(tl.xy/tl.w*.5+.5)*uScreen; vec2 d=(floor(px+.5)-px)/uScreen*2.;
    cp.xy+=d*cp.w;
  }
  gl_Position=cp;
}`;
  const FRAG = Deck.glsl.color + /* glsl */ `
in vec2 vUv; in vec2 vP; flat in vec4 vCell; in vec4 vC; in vec4 vF; flat in vec2 vL; out vec4 o;
uniform sampler2D tA; uniform vec2 uPx; uniform float uAlpha, uLinear, uGain, uPpu; uniform vec4 uShadow; uniform vec3 uShadowC;
float S(vec2 u){ return (any(lessThan(u,vCell.xy))||any(greaterThan(u,vCell.zw))) ? 0. : texture(tA,u).a; }
float B(vec2 u, float r){
  if(r<.45) return S(u);
  float a=0., w=0.;
  for(int i=0;i<24;i++){ float f=(float(i)+.5)/24.; float rr=sqrt(f)*r; float t=float(i)*2.399963; float g=exp(-2.*f); a+=g*S(u+vec2(cos(t),sin(t))*rr*uPx); w+=g; }
  return a/w;
}
void main(){
  if(vF.z>.5 && (vP.y<vL.x || vP.y>vL.y)) discard;
  float a=B(vUv, vF.y*uPpu)*vF.x*uAlpha;
  float sh=0.;
  if(uShadow.w>0.) sh=B(vUv-uShadow.xy*uPpu*uPx, uShadow.z*uPpu)*uShadow.w*vF.x*uAlpha;
  vec3 c=vC.rgb, sc=uShadowC;
  if(uLinear>.5){ c=toLin(c)*uGain*(1.+vC.a); sc=toLin(sc); }
  if(a+sh<.002) discard;
  o=vec4(c*a+sc*sh*(1.-a), a+sh*(1.-a));
}`;

  const all = new Set();
  let PPU = () => 1, SCREEN = () => [1920, 1080];

  class Text {
    constructor(str, o = {}) {
      this.o = { size: 48, weight: 400, family: "sans", color: "#ffffff", align: "left", valign: "baseline", leading: 1.25, tracking: 0, maxWidth: 0, raster: 1, shadow: null, snap: true, ...o };
      this.x = this.o.x ?? 0; this.y = this.o.y ?? 0;
      this.alpha = 1; this.scale = 1; this.rotation = 0;
      this.ppu = 0; this.max = 0; this.text = null;
      this.canvas = document.createElement("canvas");
      this.tex = new T.CanvasTexture(this.canvas);
      Object.assign(this.tex, { generateMipmaps: false, minFilter: T.LinearFilter, magFilter: T.LinearFilter, flipY: false, premultiplyAlpha: false });
      this.tex.colorSpace = T.NoColorSpace;
      this.mat = new T.RawShaderMaterial({
        glslVersion: T.GLSL3, vertexShader: VERT, fragmentShader: "precision highp float;\n" + FRAG,
        transparent: true, depthTest: false, depthWrite: false, side: T.DoubleSide,
        blending: T.CustomBlending, blendSrc: T.OneFactor, blendDst: T.OneMinusSrcAlphaFactor, blendSrcAlpha: T.OneFactor, blendDstAlpha: T.OneMinusSrcAlphaFactor,
        uniforms: {
          tA: { value: this.tex }, uPx: { value: new T.Vector2(1, 1) }, uAlpha: { value: 1 }, uLinear: { value: 0 }, uGain: { value: 1 },
          uPpu: { value: 1 }, uShadow: { value: new T.Vector4() }, uShadowC: { value: new T.Vector3() }, uScreen: { value: new T.Vector2(1920, 1080) }, uSnap: { value: 0 },
        },
      });
      this.geo = new T.InstancedBufferGeometry();
      this.geo.index = QUAD.index; this.geo.setAttribute("position", QUAD.getAttribute("position"));
      this.geo.boundingSphere = new T.Sphere(new T.Vector3(), 1e6);
      this.mesh = new T.Mesh(this.geo, this.mat);
      this.mesh.frustumCulled = false; this.mesh.renderOrder = o.order ?? 10;
      this.mesh.onBeforeRender = () => this._sync();
      this._fn = null;
      all.add(this);
      this.set(str);
    }

    // ── 배치 ──
    set(str) {
      const key = typeof str === "string" ? str : JSON.stringify(str);
      if (key === this._key) return this;
      this._key = key; this.text = str;
      this._layout(); this.ppu = 0; this._raster(); this.animate(this._fn);
      return this;
    }
    style(o) {
      Object.assign(this.o, o);
      if ("x" in o) this.x = o.x; if ("y" in o) this.y = o.y;
      this._key = null; this.set(this.text);
      return this;
    }
    at(x, y) { this.x = x; this.y = y; return this; }

    _layout() {
      const o = this.o;
      const spans = typeof this.text === "string" ? [{ t: this.text }] : this.text;
      const chars = [];
      for (const sp of spans) for (const ch of Array.from(sp.t)) chars.push({ ch, weight: sp.weight ?? o.weight, family: sp.family ?? o.family, color: sp.color ?? o.color });
      let lines = [[]];
      for (const c of chars) c.ch === "\n" ? lines.push([]) : lines[lines.length - 1].push(c);
      const size = o.size, track = o.tracking * size;
      const measureLine = (ln) => {
        let x = 0, i = 0;
        while (i < ln.length) {
          let j = i;
          while (j < ln.length && ln[j].weight === ln[i].weight && ln[j].family === ln[i].family) j++;
          M.font = fontOf(size, ln[i].weight, ln[i].family);
          let run = "";
          for (let k = i; k < j; k++) {
            run += ln[k].ch;
            const wRun = M.measureText(run).width, wCh = M.measureText(ln[k].ch).width;
            ln[k].x = x + wRun - wCh + (k - i) * track; ln[k].w = wCh;
          }
          x += M.measureText(run).width + (j - i) * track; i = j;
        }
        return x - (ln.length ? track : 0);
      };
      if (o.maxWidth) {
        const out = [];
        for (const ln of lines) {
          let cur = [], word = [];
          const flush = () => {
            if (!word.length) return;
            const cand = cur.concat(word);
            if (cur.length && measureLine(cand.slice()) > o.maxWidth) {
              while (cur.length && cur[cur.length - 1].ch === " ") cur.pop();
              out.push(cur);
              while (word.length && word[0].ch === " ") word.shift();
              cur = word;
            } else cur = cand;
            word = [];
          };
          for (const c of ln) { if (c.ch === " ") { flush(); word = [c]; flush(); } else word.push(c); }
          flush(); out.push(cur);
        }
        lines = out;
      }
      const lh = size * o.leading;
      const H = lines.length * lh;
      const y0 = o.valign === "middle" ? -H / 2 : o.valign === "bottom" ? -H : o.valign === "baseline" ? -(lh / 2 + size * 0.34) : 0;
      this.glyphs = []; this.lines = []; this.width = 0; this.height = H;
      let n = 0, word = 0;
      lines.forEach((ln, li) => {
        const w = measureLine(ln);
        this.width = Math.max(this.width, w);
        const ax = o.align === "center" ? -w / 2 : o.align === "right" ? -w : 0;
        const top = y0 + li * lh, base = top + lh / 2 + size * 0.34;
        this.lines.push({ x: ax, y: top, w, h: lh, base });
        let inWord = false;
        ln.forEach((c, j) => {
          if (c.ch === " ") { if (inWord) word++; inWord = false; return; }
          inWord = true;
          this.glyphs.push({ ch: c.ch, n: n++, line: li, j, word, x: ax + c.x, w: c.w, base, weight: c.weight, family: c.family, color: hex(c.color), cx: ax + c.x + c.w / 2, cy: base - size * 0.34, clip: [base - size * 1.02, base + size * 0.34] });
        });
        if (inWord) word++;
      });
      this.n = n; this.words = word;
      const bx = o.align === "center" ? -this.width / 2 : o.align === "right" ? -this.width : 0;
      this.box = { x: bx, y: y0, w: this.width, h: H };
      if (n > this.max) {
        this.max = Math.max(16, n);
        this.buf = new T.InstancedInterleavedBuffer(new Float32Array(this.max * 24), 24, 1);
        this.buf.setUsage(T.DynamicDrawUsage);
        ["iRect", "iUv", "iT", "iF", "iC", "iL"].forEach((name, i) => this.geo.setAttribute(name, new T.InterleavedBufferAttribute(this.buf, 4, i * 4)));
      }
      this.geo.instanceCount = n;
    }

    _pad() {
      const s = this.o.size, sh = this.o.shadow;
      return Math.ceil(s * 0.3 + 4 + (sh ? (sh.blur ?? 12) * 1.2 + Math.hypot(sh.x ?? 0, sh.y ?? 4) : 0));
    }
    _raster() {
      const ppu = Math.min(4, (this.o.ppu ?? PPU()) * this.o.raster);
      if (Math.abs(ppu - this.ppu) < 1e-3) return;
      this.ppu = ppu;
      const s = this.o.size, pad = this._pad(), cellH = s * 1.36 + pad * 2;
      const area = this.glyphs.reduce((a, gl) => a + (gl.w + pad * 2) * cellH, 0) * ppu * ppu;
      const AW = Math.min(4096, Math.max(64, Math.ceil(Math.sqrt(area) * 1.2 + 64)));
      let cx = 1, cy = 1, rowH = 0;
      const cells = this.glyphs.map((gl) => {
        const w = Math.ceil((gl.w + pad * 2) * ppu), h = Math.ceil(cellH * ppu);
        if (cx + w + 1 > AW) { cx = 1; cy += rowH + 1; rowH = 0; }
        const r = [cx, cy, w, h]; cx += w + 1; rowH = Math.max(rowH, h); return r;
      });
      const AH = Math.max(4, cy + rowH + 1);
      if (this.canvas.width !== AW || this.canvas.height !== AH) { this.canvas.width = AW; this.canvas.height = AH; this.tex.dispose(); }
      const c = this.canvas.getContext("2d");
      c.clearRect(0, 0, AW, AH);
      c.fillStyle = "#fff"; c.textBaseline = "alphabetic";
      this.glyphs.forEach((gl, i) => {
        const [x, y, w, h] = cells[i];
        c.font = fontOf(s * ppu, gl.weight, gl.family);
        const ox = Math.round(pad * ppu), oy = Math.round((pad + s * 1.02) * ppu);
        c.fillText(gl.ch, x + ox, y + oy);
        // 사각형(논리 좌표): 글자 원점 기준으로 아틀라스 칸을 되돌린다
        gl.rect = [gl.x - ox / ppu, gl.base - oy / ppu, w / ppu, h / ppu];
        gl.uv = [x / AW, y / AH, w / AW, h / AH];
      });
      this.tex.needsUpdate = true;
      this.mat.uniforms.uPx.value.set(1 / AW, 1 / AH);
      this.mat.uniforms.uPpu.value = ppu;
      this._dirty = true;
    }
    _sync() {
      const u = this.mat.uniforms;
      // 이번 프레임에 show()/animate()가 불리지 않은 글자는 그리지 않는다(장면 코드가 깜빡 잊어도 안전)
      u.uAlpha.value = this.o.static || this._stamp === Deck.frameId ? this.alpha : 0;
      if (!this._3d) {
        const moved = this.x !== this._lx || this.y !== this._ly;
        this._lx = this.x; this._ly = this.y;
        this.mesh.position.set(this.x, this.y, 0);
        this.mesh.scale.set(this.scale, this.scale, 1);
        this.mesh.rotation.z = this.rotation;
        this.mesh.updateMatrixWorld();
        this._moving = moved;
      }
      const sh = this.o.shadow;
      if (sh) { u.uShadow.value.set(sh.x ?? 0, sh.y ?? 4, sh.blur ?? 12, sh.alpha ?? 0.5); u.uShadowC.value.set(...hex(sh.color ?? "#000000")); }
      else u.uShadow.value.set(0, 0, 0, 0);
      const [sw, shh] = SCREEN(); u.uScreen.value.set(sw, shh);
      u.uSnap.value = this.o.snap && !this._3d && !this._moving && this.scale === 1 && this.rotation === 0 ? 1 : 0;
    }

    // ── 애니메이션 ──
    // fn(glyph, out, block): out의 dx, dy, scale, sx, sy, rot, alpha, blur, clip, skew, r, g, b, glow 를 고친다
    animate(fn) {
      this._raster();
      this._fn = fn;
      this._stamp = Deck.frameId;
      const a = this.buf.array, o = {};
      this.glyphs.forEach((gl, i) => {
        o.dx = o.dy = o.rot = o.blur = o.clip = o.skew = o.glow = 0;
        o.scale = o.sx = o.sy = o.alpha = 1;
        o.r = gl.color[0]; o.g = gl.color[1]; o.b = gl.color[2];
        if (fn) fn(gl, o, this);
        const k = i * 24;
        a.set(gl.rect, k); a.set(gl.uv, k + 4);
        a[k + 8] = o.dx; a[k + 9] = o.dy; a[k + 10] = o.scale; a[k + 11] = o.rot;
        a[k + 12] = o.alpha; a[k + 13] = o.blur; a[k + 14] = o.clip; a[k + 15] = o.skew;
        a[k + 16] = o.r; a[k + 17] = o.g; a[k + 18] = o.b; a[k + 19] = o.glow;
        a[k + 20] = gl.clip[0]; a[k + 21] = gl.clip[1]; a[k + 22] = o.sx; a[k + 23] = o.sy;
      });
      this.buf.needsUpdate = true;
      this.mesh.position.set(this.x, this.y, 0);
      this.mesh.scale.set(this.scale, this.scale, 1);
      this.mesh.rotation.z = this.rotation;
      this.mesh.visible = this.alpha > 0.002 && this.n > 0;
      return this;
    }

    // p: 들어오는 진행도(0→1), out: 나가는 진행도(0→1)
    // style: rise | blur | fade | type | scatter | drop | track | pop
    show(p, { style = "rise", out = 0, stagger = 0.45, by = "glyph", seed = 1, outStyle } = {}) {
      if (p <= 0 || out >= 1) { this.mesh.visible = false; this._fn = null; return this; }
      const count = by === "word" ? this.words : by === "line" ? this.lines.length : this.n;
      const st = Math.min(stagger, 0.999);
      const local = (x, i) => {
        const d = count > 1 ? (i / (count - 1)) * st : 0;
        if (stagger >= 1) return x >= d ? 1 : 0;
        return clamp((x - d) / (1 - st));
      };
      const os = outStyle || style;
      const cx = this.box.x + this.box.w / 2;
      return this.animate((gl, o) => {
        const i = by === "word" ? gl.word : by === "line" ? gl.line : gl.n;
        const v = local(p, i), q = out > 0 ? local(out, i) : 0;
        const s = this.o.size, e = ease.out4(v), qi = ease.in3(q);
        switch (style) {
          case "rise": o.dy = (1 - e) * s * 1.2; o.clip = 1; o.alpha = v > 0 ? 1 : 0; break;
          case "blur": o.alpha = ease.out2(v); o.blur = (1 - ease.out3(v)) * s * 0.22; o.dx = (1 - ease.out3(v)) * s * 0.08; o.scale = 1 + (1 - ease.out3(v)) * 0.06; break;
          case "fade": o.alpha = ease.out2(v); break;
          case "type": o.alpha = v > 0 ? 1 : 0; break;
          case "pop": { const b = ease.outBack(v, 2.2); o.scale = Math.max(0.001, b); o.alpha = clamp(v * 3); break; }
          case "drop": { const b = ease.outBack(v, 1.8); o.dy = (1 - b) * -s * 0.8; o.rot = (1 - b) * (hash(gl.n + seed) - 0.5) * 0.7; o.alpha = clamp(v * 2.5); break; }
          case "scatter": { const a = hash(gl.n * 1.7 + seed * 13) * 6.283, d = (1 - e) * (160 + 420 * hash(gl.n * 3.1 + seed)); o.dx = Math.cos(a) * d; o.dy = Math.sin(a) * d; o.rot = (1 - e) * (hash(gl.n + 5 + seed) - 0.5) * 4; o.alpha = ease.out2(clamp(v * 1.6)); o.blur = (1 - e) * s * 0.15; break; }
          case "track": o.dx = (gl.cx - cx) * (1 - e) * 0.4; o.alpha = ease.out2(v); o.blur = (1 - e) * s * 0.12; break;
        }
        if (q > 0) {
          switch (os) {
            case "rise": o.dy -= qi * s * 1.2; o.clip = 1; if (q >= 1) o.alpha = 0; break;
            case "blur": o.alpha *= 1 - ease.out2(q); o.blur += ease.in2(q) * s * 0.22; o.dx -= ease.in2(q) * s * 0.08; break;
            case "scatter": { const a = hash(gl.n * 2.3 + seed * 7) * 6.283, d = qi * (200 + 500 * hash(gl.n * 5.1 + seed)); o.dx += Math.cos(a) * d; o.dy += Math.sin(a) * d - qi * 80; o.rot += qi * (hash(gl.n + 9) - 0.5) * 4; o.alpha *= 1 - ease.out2(q); break; }
            default: o.alpha *= 1 - ease.out2(q);
          }
        }
      });
    }
    hide() { this.mesh.visible = false; this._fn = null; return this; }

    // n번째 글자 뒤 커서 위치 (블록 원점 기준이 아닌 화면 논리 좌표)
    caret(n) {
      const gl = this.glyphs;
      if (!gl.length) { const l = this.lines[0] || { x: 0, base: 0 }; return { x: this.x + l.x, y: this.y + l.base - this.o.size * 0.34, h: this.o.size * 1.1 }; }
      const g = n <= 0 ? null : gl[Math.min(n, gl.length) - 1];
      const ref = g || gl[0];
      const x = g ? g.x + g.w + this.o.tracking * this.o.size * 0.5 : ref.x;
      return { x: this.x + x * this.scale, y: this.y + ref.cy * this.scale, h: this.o.size * 1.05 * this.scale, line: ref.line };
    }

    // 글자 모양 안쪽에서 점 n개를 고른다 (입자 효과용). 화면 논리 좌표 [x0,y0,x1,y1,...]
    points(n, { res = 0.5, seed = 7 } = {}) {
      const s = this.o.size, pad = 4;
      const bw = Math.ceil((this.width + pad * 2) * res), bh = Math.ceil((this.height + s * 0.4 + pad * 2) * res);
      const cv = document.createElement("canvas"); cv.width = Math.max(1, bw); cv.height = Math.max(1, bh);
      const c = cv.getContext("2d"); c.fillStyle = "#fff"; c.textBaseline = "alphabetic";
      const ox = -this.box.x + pad, oy = -this.box.y + pad;
      this.glyphs.forEach((gl) => { c.font = fontOf(s * res, gl.weight, gl.family); c.fillText(gl.ch, (gl.x + ox) * res, (gl.base + oy) * res); });
      const d = c.getImageData(0, 0, cv.width, cv.height).data, hits = [];
      for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (d[(y * cv.width + x) * 4 + 3] > 140) hits.push(x, y);
      const r = Deck.util.rng(seed), out = new Float32Array(n * 2), m = hits.length / 2;
      for (let i = 0; i < n; i++) {
        const k = m ? Math.floor(r() * m) : 0;
        out[i * 2] = this.x + ((hits[k * 2] ?? 0) + r()) / res - ox;
        out[i * 2 + 1] = this.y + ((hits[k * 2 + 1] ?? 0) + r()) / res - oy;
      }
      return out;
    }

    // 3D 장면에 붙이기: 논리 1px = 월드 scale. y를 뒤집고 선형 색으로 그린다.
    in3D(scale = 0.01, { gain = 1, depthTest = true, ppu = 3, auto = false } = {}) {
      this._3d = true;
      // 3D 글자는 기본적으로 늘 그린다(장면을 그린 다음에 animate를 불러도 사라지지 않게). auto:true면 겹레이어처럼 자동 숨김.
      if (!auto) this.o.static = true;
      this.o.ppu = ppu; this.ppu = 0; this._raster(); this.animate(this._fn);
      const u = this.mat.uniforms; u.uLinear.value = 1; u.uGain.value = gain;
      this.mat.depthTest = depthTest;
      const grp = new T.Group(); grp.scale.set(scale, -scale, scale); grp.add(this.mesh);
      this.x = this.y = 0;
      return grp;
    }
    dispose() { all.delete(this); this.tex.dispose(); this.mat.dispose(); this.geo.dispose(); }
  }

  Deck.Text = Text;
  Deck.text = {
    all, fontOf, FAMILY,
    bind(ppuFn, screenFn) { PPU = ppuFn; SCREEN = screenFn; },
    refresh() { for (const t of all) { if (t._3d) continue; t.ppu = 0; t._raster(); t.animate(t._fn); } },
    measure(str, { size = 48, weight = 400, family = "sans", tracking = 0 } = {}) {
      M.font = fontOf(size, weight, family);
      return M.measureText(str).width + Math.max(0, Array.from(str).length - 1) * tracking * size;
    },
  };
})();
