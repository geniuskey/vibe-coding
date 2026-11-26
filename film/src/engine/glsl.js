// 셰이더 공용 조각. 장면 셰이더 앞에 필요한 것만 붙여 쓴다.  ${Deck.glsl.noise} 처럼.
(() => {
  // 정수 해시 (PCG 계열). 입력 float의 비트 패턴을 섞으므로 sin 기반 해시보다 띠무늬가 없다.
  const hash = /* glsl */ `
uint pcg(uint v){ uint s=v*747796405u+2891336453u; uint w=((s>>((s>>28u)+4u))^s)*277803737u; return (w>>22u)^w; }
uvec3 pcg3(uvec3 v){ v=v*1664525u+1013904223u; v.x+=v.y*v.z; v.y+=v.z*v.x; v.z+=v.x*v.y; v^=v>>16u; v.x+=v.y*v.z; v.y+=v.z*v.x; v.z+=v.x*v.y; return v; }
const float U2F = 1.0/4294967295.0;
float hash11(float p){ return float(pcg(floatBitsToUint(p)))*U2F; }
float hash12(vec2 p){ return float(pcg3(uvec3(floatBitsToUint(p), 7u)).x)*U2F; }
float hash13(vec3 p){ return float(pcg3(floatBitsToUint(p)).x)*U2F; }
vec2 hash22(vec2 p){ return vec2(pcg3(uvec3(floatBitsToUint(p), 3u)).xy)*U2F; }
vec3 hash33(vec3 p){ return vec3(pcg3(floatBitsToUint(p)))*U2F; }
vec3 hash32(vec2 p){ return vec3(pcg3(uvec3(floatBitsToUint(p), 11u)))*U2F; }
`;

  // 값 잡음 · fbm · 보로노이
  const noise = hash + /* glsl */ `
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*f*(f*(f*6.-15.)+10.);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x), u.y); }
float vnoise(vec3 p){ vec3 i=floor(p), f=fract(p); vec3 u=f*f*f*(f*(f*6.-15.)+10.);
  return mix(mix(mix(hash13(i),hash13(i+vec3(1,0,0)),u.x), mix(hash13(i+vec3(0,1,0)),hash13(i+vec3(1,1,0)),u.x),u.y),
             mix(mix(hash13(i+vec3(0,0,1)),hash13(i+vec3(1,0,1)),u.x), mix(hash13(i+vec3(0,1,1)),hash13(i+vec3(1,1,1)),u.x),u.y), u.z); }
// 기울기 잡음 (-1..1): 값 잡음보다 덩어리가 덜 보여서 지형·구름에 좋다
float gnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*f*(f*(f*6.-15.)+10.);
  vec2 ga=hash22(i)*2.-1., gb=hash22(i+vec2(1,0))*2.-1., gc=hash22(i+vec2(0,1))*2.-1., gd=hash22(i+vec2(1,1))*2.-1.;
  float a=dot(ga,f), b=dot(gb,f-vec2(1,0)), c=dot(gc,f-vec2(0,1)), d=dot(gd,f-vec2(1,1));
  return 1.6*mix(mix(a,b,u.x),mix(c,d,u.x),u.y); }
const mat2 FBM_R = mat2(.8,.6,-.6,.8);
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vnoise(p); p=FBM_R*p*2.03+3.1; a*=.5; } return s; }
float fbm(vec3 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vnoise(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=.5; } return s; }
float fbm3(vec2 p){ float s=0., a=.5; for(int i=0;i<3;i++){ s+=a*vnoise(p); p=FBM_R*p*2.03+3.1; a*=.5; } return s; }
float gfbm(vec2 p){ float s=0., a=.5; for(int i=0;i<6;i++){ s+=a*gnoise(p); p=FBM_R*p*2.01+1.7; a*=.5; } return s; }
// 보로노이: x=가장 가까운 점 거리, y=두 번째와의 차(경계), z=칸 id
vec3 voronoi(vec2 p){ vec2 i=floor(p), f=fract(p); float d1=8., d2=8., id=0.;
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g=vec2(x,y); vec2 o=hash22(i+g); vec2 r=g+o-f; float d=dot(r,r);
    if(d<d1){ d2=d1; d1=d; id=hash12(i+g); } else if(d<d2) d2=d; }
  return vec3(sqrt(d1), sqrt(d2)-sqrt(d1), id); }
`;

  // 거리 함수
  const sdf = /* glsl */ `
float sdBox(vec3 p, vec3 b){ vec3 q=abs(p)-b; return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.); }
float sdRoundBox(vec3 p, vec3 b, float r){ vec3 q=abs(p)-b+r; return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.)-r; }
float sdBox2(vec2 p, vec2 b){ vec2 q=abs(p)-b; return length(max(q,0.))+min(max(q.x,q.y),0.); }
float sdRound2(vec2 p, vec2 b, float r){ vec2 q=abs(p)-b+r; return length(max(q,0.))+min(max(q.x,q.y),0.)-r; }
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h); }
float sdCapsule(vec3 p, vec3 a, vec3 b, float r){ vec3 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h)-r; }
float sdTorus(vec3 p, vec2 t){ vec2 q=vec2(length(p.xz)-t.x,p.y); return length(q)-t.y; }
float smin(float a, float b, float k){ float h=max(k-abs(a-b),0.)/k; return min(a,b)-h*h*k*.25; }
mat2 rot2(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
`;

  // 색 변환 · 톤 매핑
  const color = /* glsl */ `
vec3 toLin(vec3 c){ return mix(c/12.92, pow((c+.055)/1.055, vec3(2.4)), step(.04045, c)); }
vec3 toSrgb(vec3 c){ c=max(c,0.); return mix(c*12.92, 1.055*pow(c, vec3(1./2.4))-.055, step(.0031308, c)); }
float luma(vec3 c){ return dot(c, vec3(.2126,.7152,.0722)); }
// ACES 근사 (Narkowicz)
vec3 tmAces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14), 0., 1.); }
// AgX 근사 (Wrensch의 최소 구현을 따름). 결과는 선형값.
vec3 tmAgx(vec3 v){
  const mat3 M = mat3(.842479062253094,.0423282422610123,.0423756549057051, .0784335999999992,.878468636469772,.0784336, .0792237451477643,.0791661274605434,.879142973793104);
  const mat3 I = mat3(1.19687900512017,-.0528968517574562,-.0529716355144438, -.0980208811401368,1.15190312990417,-.0980434501171241, -.0990297440797205,-.0989611768448433,1.15107367264116);
  v = M*max(v, 1e-10);
  v = clamp(log2(v), -12.47393, 4.026069);
  v = (v + 12.47393) / 16.500999;
  vec3 x2=v*v, x4=x2*x2;
  v = 15.5*x4*x2 - 40.14*x4*v + 31.96*x4 - 6.868*x2*v + .4298*x2 + .1191*v - .00232;
  return pow(max(I*v, 0.), vec3(2.2));
}
`;

  window.Deck = window.Deck || {};
  Deck.glsl = { hash, noise, sdf, color, all: noise + sdf + color };
})();
