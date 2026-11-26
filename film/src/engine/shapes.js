// 2D 도형(거리 함수로 그려서 어떤 해상도에서도 또렷함)과 캔버스 패널(2D 캔버스로 그린 것을 텍스처로 띄움).
// 둘 다 겹레이어(논리 좌표, y 아래로 증가)나 3D 장면 어디에든 넣을 수 있다.
(() => {
  const T = window.THREE;
  const { hex } = Deck.util;
  const G = Deck.glsl;

  const QUAD = new T.BufferGeometry();
  QUAD.setAttribute("position", new T.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
  QUAD.setIndex([0, 1, 2, 0, 2, 3]);

  const VERT = /* glsl */ `precision highp float;
in vec3 position; uniform mat4 projectionMatrix, modelViewMatrix; uniform vec4 uBox; uniform float uRot, uPad;
out vec2 vP;
void main(){
  vec2 h=uBox.zw*.5+uPad; vec2 q=position.xy*2.*h; vP=q;
  float s=sin(uRot), c=cos(uRot);
  vec2 p=uBox.xy+vec2(q.x*c-q.y*s, q.x*s+q.y*c);
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,0.,1.);
}`;
  const FRAG = G.sdf + G.color + /* glsl */ `
in vec2 vP; out vec4 o;
uniform int uKind; uniform vec4 uBox; uniform float uR, uLine, uDash, uDashOff, uDraw, uA, uLinear, uGain, uPx;
uniform vec4 uFill, uStroke, uGlowC; uniform float uGlow, uGlowR;
uniform vec4 uShadow; uniform float uShadowA;
uniform vec2 uPts[8]; uniform int uN; uniform vec2 uArc; uniform float uHandle, uKnob;
float dRect(vec2 p){ return sdRound2(p, uBox.zw*.5, min(uR, min(uBox.z,uBox.w)*.5)); }
float dShape(vec2 p){
  if(uKind==0) return dRect(p);
  if(uKind==1) return length(p)-uBox.z*.5;
  return 1e5;
}
// 선(폴리라인): uDraw만큼만 그린다
float dLine(vec2 p, out float along){
  float total=0.; for(int i=1;i<8;i++){ if(i>=uN) break; total+=length(uPts[i]-uPts[i-1]); }
  float lim=total*uDraw, acc=0., d=1e5; along=0.;
  for(int i=1;i<8;i++){
    if(i>=uN) break;
    vec2 a=uPts[i-1]-uBox.xy, b=uPts[i]-uBox.xy; float L=length(b-a);
    if(acc>=lim) break;
    float k=clamp((lim-acc)/max(L,1e-4),0.,1.); vec2 bb=mix(a,b,k);
    vec2 pa=p-a, ba=bb-a; float h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-6),0.,1.);
    float di=length(pa-ba*h);
    if(di<d){ d=di; along=acc+h*L*k; }
    acc+=L;
  }
  return d-uLine*.5;
}
float dArc(vec2 p){
  float R=uBox.z*.5; float a=atan(p.y,p.x);
  float a0=uArc.x, a1=uArc.y; float mid=(a0+a1)*.5, half_=abs(a1-a0)*.5;
  float da=mod(a-mid+3.14159265,6.2831853)-3.14159265;
  if(abs(da)<=half_) return abs(length(p)-R)-uLine*.5;
  vec2 e0=vec2(cos(a0),sin(a0))*R, e1=vec2(cos(a1),sin(a1))*R;
  return min(length(p-e0),length(p-e1))-uLine*.5;
}
void main(){
  vec2 p=vP; float px=uPx; float aa=px*.9;
  vec4 col=vec4(0);
  if(uKind<=1){
    float d=dShape(p);
    if(uShadowA>0.){ float ds=dShape(p-uShadow.xy); float sa=uShadowA*(1.-smoothstep(-uShadow.z*.6, uShadow.z, ds)); col=vec4(0,0,0,sa); }
    float fill=1.-smoothstep(-aa,aa,d);
    vec4 f=vec4(uFill.rgb,1.)*uFill.a*fill;
    col=f+col*(1.-f.a);
    if(uLine>0.){
      float sd=abs(d+uLine*.5)-uLine*.5;
      float s=1.-smoothstep(-aa,aa,sd);
      if(uDash>0.){ float per=(uKind==1)?atan(p.y,p.x)*uBox.z*.5:(abs(p.x)/max(uBox.z,1.)>abs(p.y)/max(uBox.w,1.)?p.y*sign(p.x):-p.x*sign(p.y)); s*=step(.5,fract((per+uDashOff)/uDash)); }
      vec4 sc=vec4(uStroke.rgb,1.)*uStroke.a*s; col=sc+col*(1.-sc.a);
    }
    if(uGlow>0.){ float g=uGlow*exp(-max(d,0.)/max(uGlowR,1.)); col.rgb+=uGlowC.rgb*g*(1.-col.a); col.a=max(col.a, g*.0); }
  } else if(uKind==2){
    float along; float d=dLine(p, along);
    float s=1.-smoothstep(-aa,aa,d);
    if(uDash>0.) s*=step(.5,fract((along+uDashOff)/uDash));
    col=vec4(uStroke.rgb,1.)*uStroke.a*s;
    if(uGlow>0.){ float g=uGlow*exp(-max(d,0.)/max(uGlowR,1.)); col.rgb+=uGlowC.rgb*g*(1.-col.a); }
  } else if(uKind==3){
    float d=dArc(p); float s=1.-smoothstep(-aa,aa,d);
    col=vec4(uStroke.rgb,1.)*uStroke.a*s;
    if(uGlow>0.){ float g=uGlow*exp(-max(d,0.)/max(uGlowR,1.)); col.rgb+=uGlowC.rgb*g*(1.-col.a); }
  } else {
    // 선택 상자: 테두리 + 손잡이 8개 + 회전 손잡이
    vec2 h=uBox.zw*.5; float d=abs(sdBox2(p,h)); float line=1.-smoothstep(uLine*.5-aa,uLine*.5+aa,d);
    float best=1e5;
    for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ if(x==0&&y==0) continue; best=min(best,length(p-vec2(x,y)*h)); }
    float ky=-h.y-uHandle*3.6; float stem=(uKnob>.5 && abs(p.x)<uLine*.5 && p.y<-h.y && p.y>ky)?1.:0.;
    if(uKnob>.5) best=min(best,length(p-vec2(0,ky)));
    float disc=1.-smoothstep(uHandle-aa,uHandle+aa,best);
    float inner=1.-smoothstep(uHandle-uLine*1.15-aa,uHandle-uLine*1.15+aa,best);
    vec3 c=uStroke.rgb; float a=max(max(line,stem),disc);
    vec3 rgb=mix(c, vec3(1.), inner*disc);
    col=vec4(rgb*a, a)*uStroke.a;
    if(uGlow>0.){ float g=uGlow*exp(-min(d,best)/max(uGlowR,1.)); col.rgb+=uGlowC.rgb*g*(1.-col.a); }
  }
  if(uLinear>.5){ col.rgb = col.a>0. ? toLin(col.rgb/max(col.a,1e-4))*col.a*uGain : col.rgb*uGain; }
  o=col*uA;
}`;

  let PX = () => 1;

  class Shape {
    constructor(kind = "rect", o = {}) {
      const K = { rect: 0, circle: 1, line: 2, arc: 3, select: 4 }[kind];
      this.kind = kind;
      this.mat = new T.RawShaderMaterial({
        glslVersion: T.GLSL3, vertexShader: VERT, fragmentShader: "precision highp float; precision highp int;\n" + FRAG,
        transparent: true, depthTest: false, depthWrite: false, side: T.DoubleSide,
        blending: T.CustomBlending, blendSrc: T.OneFactor, blendDst: T.OneMinusSrcAlphaFactor, blendSrcAlpha: T.OneFactor, blendDstAlpha: T.OneMinusSrcAlphaFactor,
        uniforms: {
          uKind: { value: K }, uBox: { value: new T.Vector4(0, 0, 10, 10) }, uRot: { value: 0 }, uPad: { value: 4 },
          uR: { value: 0 }, uLine: { value: 0 }, uDash: { value: 0 }, uDashOff: { value: 0 }, uDraw: { value: 1 }, uA: { value: 1 },
          uLinear: { value: 0 }, uGain: { value: 1 }, uPx: { value: 1 },
          uFill: { value: new T.Vector4(1, 1, 1, 0) }, uStroke: { value: new T.Vector4(1, 1, 1, 1) }, uGlowC: { value: new T.Vector4(1, 1, 1, 1) },
          uGlow: { value: 0 }, uGlowR: { value: 12 }, uShadow: { value: new T.Vector4(0, 8, 24, 0) }, uShadowA: { value: 0 },
          uPts: { value: Array.from({ length: 8 }, () => new T.Vector2()) }, uN: { value: 0 }, uArc: { value: new T.Vector2(0, Math.PI) },
          uHandle: { value: 9 }, uKnob: { value: 1 },
        },
      });
      this.mesh = new T.Mesh(QUAD, this.mat);
      this.mesh.frustumCulled = false; this.mesh.renderOrder = o.order ?? 5;
      this.mesh.onBeforeRender = () => {
        const u = this.mat.uniforms;
        u.uPx.value = this._3d ? 0.01 : 1 / Math.max(0.25, PX());
        u.uA.value = this._stamp === Deck.frameId || this.static ? this._alpha : 0;
      };
      this._alpha = 1; this.static = !!o.static;
      this.style(o);
    }
    style(o) {
      const u = this.mat.uniforms;
      const col = (c, a = 1) => { const [r, g, b] = hex(c); return [r, g, b, a]; };
      if (o.fill !== undefined) u.uFill.value.set(...(o.fill ? col(o.fill, o.fillAlpha ?? 1) : [0, 0, 0, 0]));
      if (o.stroke !== undefined) u.uStroke.value.set(...(o.stroke ? col(o.stroke, o.strokeAlpha ?? 1) : [0, 0, 0, 0]));
      if (o.line !== undefined) u.uLine.value = o.line;
      if (o.radius !== undefined) u.uR.value = o.radius;
      if (o.dash !== undefined) u.uDash.value = o.dash;
      if (o.glow !== undefined) u.uGlow.value = o.glow;
      if (o.glowColor !== undefined) u.uGlowC.value.set(...col(o.glowColor));
      if (o.glowRadius !== undefined) u.uGlowR.value = o.glowRadius;
      if (o.shadow !== undefined) {
        const s = o.shadow; u.uShadowA.value = s ? s.alpha ?? 0.25 : 0;
        if (s) u.uShadow.value.set(s.x ?? 0, s.y ?? 10, s.blur ?? 30, 0);
      }
      if (o.handle !== undefined) u.uHandle.value = o.handle;
      if (o.knob !== undefined) u.uKnob.value = o.knob ? 1 : 0;
      if (o.gain !== undefined) u.uGain.value = o.gain;
      this._padFor();
      return this;
    }
    _padFor() {
      const u = this.mat.uniforms;
      const sh = u.uShadowA.value > 0 ? Math.abs(u.uShadow.value.x) + Math.abs(u.uShadow.value.y) + u.uShadow.value.z * 1.5 : 0;
      const gl = u.uGlow.value > 0 ? u.uGlowR.value * 5 : 0;
      const hd = this.kind === "select" ? u.uHandle.value * 5 + 4 : 0;
      u.uPad.value = Math.max(4 + u.uLine.value, sh, gl, hd);
    }
    _touch() { this._stamp = Deck.frameId; }
    alpha(a) { this._alpha = a; this.mesh.visible = a > 0.002; this._touch(); return this; }
    rect(x, y, w, h, rot = 0) { this.mat.uniforms.uBox.value.set(x + w / 2, y + h / 2, w, h); this.mat.uniforms.uRot.value = rot; this._touch(); return this; }
    center(cx, cy, w, h, rot = 0) { this.mat.uniforms.uBox.value.set(cx, cy, w, h); this.mat.uniforms.uRot.value = rot; this._touch(); return this; }
    circle(cx, cy, r) { this.mat.uniforms.uBox.value.set(cx, cy, r * 2, r * 2); this._touch(); return this; }
    arc(cx, cy, r, a0, a1) { const u = this.mat.uniforms; u.uBox.value.set(cx, cy, r * 2, r * 2); u.uArc.value.set(a0, a1); this._touch(); return this; }
    // 점 목록(최대 8개)을 잇는 선. draw(0..1)만큼만 그린다
    path(pts, draw = 1) {
      const u = this.mat.uniforms, n = Math.min(8, pts.length);
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let i = 0; i < n; i++) { const [x, y] = pts[i]; u.uPts.value[i].set(x, y); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      u.uN.value = n; u.uDraw.value = draw; u.uBox.value.set((x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0); u.uRot.value = 0;
      this._touch(); return this;
    }
    dashOffset(v) { this.mat.uniforms.uDashOff.value = v; return this; }
    // 글자 블록을 감싸는 선택 상자
    around(text, padX = 22, padY = 14) {
      const b = text.box, s = text.scale;
      return this.rect(text.x + b.x * s - padX, text.y + b.y * s - padY, b.w * s + padX * 2, b.h * s + padY * 2);
    }
    // 선택 상자 등장: 손잡이가 튀어나온다
    appear(p) {
      const u = this.mat.uniforms, base = this._base ?? (this._base = { h: u.uHandle.value, l: u.uLine.value });
      const e = Deck.util.ease.outBack(p, 2.2);
      u.uHandle.value = base.h * Math.max(0.01, e); u.uLine.value = base.l * Math.max(0.3, Math.min(1, p * 2));
      return this.alpha(Math.min(1, p * 3));
    }
    linear(gain = 1) { this.mat.uniforms.uLinear.value = 1; this.mat.uniforms.uGain.value = gain; return this; }
  }

  // ── 캔버스 패널 ──────────────────────────────────────────────────────
  // draw(ctx, w, h, ...args)로 그린 2D 그림을 텍스처로. 겹레이어에서는 (x, y) 왼쪽 위 기준으로 놓인다.
  const PVERT = /* glsl */ `precision highp float;
in vec3 position; uniform mat4 projectionMatrix, modelViewMatrix; uniform vec4 uBox; uniform float uRot; out vec2 vUv;
void main(){ vUv=position.xy+.5; vec2 q=position.xy*uBox.zw; float s=sin(uRot), c=cos(uRot);
  vec2 p=uBox.xy+vec2(q.x*c-q.y*s, q.x*s+q.y*c); gl_Position=projectionMatrix*modelViewMatrix*vec4(p,0.,1.); }`;
  const PFRAG = /* glsl */ `precision highp float;
in vec2 vUv; out vec4 o; uniform sampler2D tA; uniform float uA;
void main(){ vec4 c=texture(tA,vUv); o=vec4(c.rgb*c.a, c.a)*uA; }`;

  class Panel {
    constructor(w, h, { ppu = 2, draw = null, flipY = false, srgb = false } = {}) {
      this.w = w; this.h = h; this.ppu = ppu; this.drawFn = draw;
      this.canvas = document.createElement("canvas");
      this.canvas.width = Math.ceil(w * ppu); this.canvas.height = Math.ceil(h * ppu);
      this.ctx = this.canvas.getContext("2d");
      this.texture = new T.CanvasTexture(this.canvas);
      Object.assign(this.texture, { flipY, generateMipmaps: true, minFilter: T.LinearMipmapLinearFilter, magFilter: T.LinearFilter, anisotropy: 4 });
      this.texture.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace;
      this._alpha = 1;
      this.mat = new T.RawShaderMaterial({
        glslVersion: T.GLSL3, vertexShader: PVERT, fragmentShader: PFRAG, transparent: true, depthTest: false, depthWrite: false, side: T.DoubleSide,
        blending: T.CustomBlending, blendSrc: T.OneFactor, blendDst: T.OneMinusSrcAlphaFactor, blendSrcAlpha: T.OneFactor, blendDstAlpha: T.OneMinusSrcAlphaFactor,
        uniforms: { tA: { value: this.texture }, uA: { value: 1 }, uBox: { value: new T.Vector4(w / 2, h / 2, w, h) }, uRot: { value: 0 } },
      });
      this.mesh = new T.Mesh(QUAD, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 4;
      this.mesh.onBeforeRender = () => { this.mat.uniforms.uA.value = this._stamp === Deck.frameId || this.static ? this._alpha : 0; };
      this._key = undefined;
    }
    // key가 바뀔 때만 다시 그린다
    redraw(key, ...args) {
      if (key !== undefined && key === this._key) return this;
      this._key = key;
      const c = this.ctx;
      c.setTransform(this.ppu, 0, 0, this.ppu, 0, 0);
      c.clearRect(0, 0, this.w, this.h);
      (this.drawFn || (() => {}))(c, this.w, this.h, ...args);
      this.texture.needsUpdate = true;
      return this;
    }
    place(x, y, scale = 1, rot = 0) {
      this.mat.uniforms.uBox.value.set(x + (this.w * scale) / 2, y + (this.h * scale) / 2, this.w * scale, this.h * scale);
      this.mat.uniforms.uRot.value = rot; this._stamp = Deck.frameId; return this;
    }
    center(cx, cy, scale = 1, rot = 0) { this.mat.uniforms.uBox.value.set(cx, cy, this.w * scale, this.h * scale); this.mat.uniforms.uRot.value = rot; this._stamp = Deck.frameId; return this; }
    alpha(a) { this._alpha = a; this.mesh.visible = a > 0.002; this._stamp = Deck.frameId; return this; }
  }

  Deck.Shape = Shape;
  Deck.Panel = Panel;
  Deck.shapes = { bind(pxFn) { PX = pxFn; } };
})();
