// 장면 전환: 두 장면의 완성된 그림(tA=이전, tB=다음)을 셰이더로 섞는다.
// 각 전환은 vec3 tr(vec2 uv, float p)를 정의한다. p는 0→1, uDir은 앞으로 +1 / 뒤로 -1.
(() => {
  const N = Deck.glsl.noise;
  const COMMON = /* glsl */ `
uniform sampler2D tA, tB; uniform float uP, uDir, uAspect;
vec3 A(vec2 u){ return texture(tA, u).rgb; }
vec3 B(vec2 u){ return texture(tB, u).rgb; }
float e3(float t){ return t<.5 ? 4.*t*t*t : 1.-pow(-2.*t+2.,3.)/2.; }
float e4(float t){ return t<.5 ? 8.*t*t*t*t : 1.-pow(-2.*t+2.,4.)/2.; }
float eo(float t){ return 1.-pow(1.-t,4.); }
const float PI=3.14159265;
`;
  const def = (name, dur, body) => Deck.transition(name, { dur, frag: COMMON + body + "\nvoid main(){ o=vec4(clamp(tr(vUv, uP),0.,1.),1.); }" });

  // 부드럽게 겹치기
  def("fade", 1.0, `vec3 tr(vec2 uv, float p){ return mix(A(uv), B(uv), smoothstep(0.,1.,p)); }`);

  // 잡음 경계로 녹아들기 (경계가 살짝 빛난다)
  def("dissolve", 1.3, N + `
vec3 tr(vec2 uv, float p){
  vec2 q=uv*vec2(uAspect,1.);
  float n=fbm(q*2.6+3.)*.82+.18*vnoise(q*40.);
  float t=mix(-.12,1.12,e3(p)), w=.07;
  float m=smoothstep(t-w,t+w,n);
  vec3 c=mix(B(uv), A(uv), m);
  float rim=1.-abs(m*2.-1.); rim=pow(rim,3.)*sin(PI*p);
  return c+vec3(1.,.96,.9)*rim*.55;
}`);

  // 카메라가 앞으로 빨려 들어가듯 (방사 흐림)
  def("zoom", 1.25, `
vec3 rb(sampler2D t, vec2 uv, float s, float amt){
  vec2 c=uv-.5; vec3 acc=vec3(0); float w=0.;
  for(int i=0;i<12;i++){ float k=float(i)/11.; float sc=1.-amt*k; acc+=texture(t, c/s*sc+.5).rgb; w+=1.; }
  return acc/w;
}
vec3 tr(vec2 uv, float p){
  float e=e4(p);
  float blur=sin(PI*p)*.14;
  vec3 a=rb(tA, uv, 1.+e*.9, blur);
  vec3 b=rb(tB, uv, mix(.55,1.,e), blur);
  float m=smoothstep(.35,.65,p);
  vec3 c=mix(a,b,m);
  return c+vec3(1.)*pow(sin(PI*p),6.)*.12;
}`);

  // 비스듬히 쓸어 넘기기, 경계에 빛 한 줄
  def("wipe", 1.15, `
vec3 tr(vec2 uv, float p){
  float e=e3(p);
  float x=uDir>0. ? uv.x : 1.-uv.x;
  float s=x+(uv.y-.5)*.28/uAspect;
  float edge=mix(-.2,1.2,e);
  float m=smoothstep(edge-.004,edge+.004,s);
  vec2 da=vec2(uDir*e*.06,0.), db=vec2(-uDir*(1.-e)*.06,0.);
  vec3 c=mix(B(uv+db), A(uv+da), m);
  float line=exp(-abs(s-edge)*140.)+.35*exp(-abs(s-edge)*22.);
  return c+vec3(1.,.97,.92)*line*.6*sin(PI*p);
}`);

  // 가운데서 원이 열리며, 가장자리가 렌즈처럼 굴절
  def("iris", 1.25, `
vec3 tr(vec2 uv, float p){
  float e=e3(p);
  vec2 d=(uv-.5)*vec2(uAspect,1.);
  float r=length(d);
  float R=e*(length(vec2(uAspect,1.))*.5+.12);
  float m=smoothstep(R-.004,R+.004,r);
  float k=exp(-pow((r-R)/.05,2.));
  vec2 n=r>0.?d/r:vec2(0);
  vec3 b=B(uv-n*k*.035/vec2(uAspect,1.));
  vec3 a=A(uv+n*k*.02/vec2(uAspect,1.));
  vec3 c=mix(b,a,m);
  return c+vec3(1.)*exp(-abs(r-R)*120.)*.45*sin(PI*p);
}`);

  // 휙 넘기기 (가로 동작 흐림)
  def("slide", 1.0, `
vec3 tr(vec2 uv, float p){
  float e=e4(p); float off=e*uDir;
  float blur=sin(PI*p)*.06;
  vec3 c=vec3(0);
  for(int i=0;i<14;i++){
    float k=(float(i)/13.-.5)*blur;
    vec2 u=uv+vec2(off+k,0.);
    c+= (uDir>0. ? (u.x<1. ? A(u) : B(u-vec2(1.,0.))) : (u.x>0. ? A(u) : B(u+vec2(1.,0.))));
  }
  return c/14.;
}`);

  // 가로 블라인드가 차례로 뒤집힌다
  def("blinds", 1.3, `
vec3 tr(vec2 uv, float p){
  float n=14.; float row=floor((1.-uv.y)*n); float f=fract((1.-uv.y)*n);
  float k=(uDir>0.?row:n-1.-row)/n;
  float q=clamp(p*1.55-k*.55,0.,1.); q=e3(q);
  float open=step(abs(f-.5)*2., q);
  float sh=1.-.35*abs(f-.5)*2.*(1.-q)*q*4.;
  vec3 c=mix(A(uv), B(uv), open);
  return c*mix(1.,sh,step(.001,q)*step(q,.999));
}`);

  // 모자이크로 부서졌다가 다시 맞춰진다
  def("pixels", 1.2, N + `
vec3 tr(vec2 uv, float p){
  float s=pow(sin(PI*p),1.6);
  float cell=mix(1.,90.,s);
  vec2 px=uv*vec2(1920.*uAspect/(16./9.),1080.);
  vec2 id=floor(px/cell); vec2 q=(id+.5)*cell/vec2(1920.*uAspect/(16./9.),1080.);
  if(cell<1.5) q=uv;
  float h=hash12(id+floor(cell));
  float x=uDir>0.?q.x:1.-q.x;
  float m=step(h*.6+x*.4, mix(-.05,1.05,p));
  return mix(A(q), B(q), m);
}`);

  // 물결처럼 번지며 바뀐다
  def("ripple", 1.4, `
vec3 tr(vec2 uv, float p){
  vec2 d=(uv-.5)*vec2(uAspect,1.); float r=length(d);
  float R=e3(p)*1.35;
  float w=sin(r*46.-p*26.)*exp(-abs(r-R)*7.)*sin(PI*p);
  vec2 n=r>0.?d/r:vec2(0); vec2 off=n*w*.018/vec2(uAspect,1.);
  float m=smoothstep(R-.05,R+.05,r);
  return mix(B(uv+off), A(uv+off), m)+vec3(1.)*max(w,0.)*.12;
}`);

  // 빛으로 하얗게 날아갔다가 다음 장면 (새벽 같은)
  def("flash", 1.5, `
vec3 tr(vec2 uv, float p){
  float a=smoothstep(0.,.5,p), b=smoothstep(.45,1.,p);
  vec2 d=uv-.5; float g=exp(-dot(d,d)*3.);
  vec3 w=vec3(1.,.97,.92)*(.85+.15*g);
  vec3 c=mix(A(uv)+w*a*a, w, a*a);
  return mix(c, B(uv), b);
}`);

  // 검게 잠겼다가
  def("dip", 1.4, `vec3 tr(vec2 uv, float p){ float a=smoothstep(0.,.5,p), b=smoothstep(.5,1.,p); return mix(A(uv)*(1.-a), B(uv), b); }`);

  // 디지털 노이즈 띠가 밀리며
  def("glitch", 0.9, N + `
vec3 tr(vec2 uv, float p){
  float s=sin(PI*p);
  float band=floor(uv.y*28.+floor(p*14.)*3.1);
  float h=hash11(band);
  float sh=(h-.5)*.22*s*step(.45,h);
  vec2 u=uv+vec2(sh,0.);
  float m=step(hash11(band+7.)*.8+.1, p*1.15);
  vec3 a=vec3(A(u+vec2(.006*s,0.)).r, A(u).g, A(u-vec2(.006*s,0.)).b);
  vec3 b=vec3(B(u+vec2(.006*s,0.)).r, B(u).g, B(u-vec2(.006*s,0.)).b);
  return mix(a,b,m)+vec3(.6,.7,1.)*step(.985,hash12(vec2(band,floor(p*30.))))*s*.4;
}`);
})();
