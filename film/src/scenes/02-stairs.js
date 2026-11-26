// 02 · 추상화의 계단
// 해 질 녘, 낮게 깔린 안개 바다 위로 거대한 돌기둥이 하나씩 솟아오른다. 왼쪽에서 오른쪽으로 계단처럼 높아진다.
// 기둥 앞면에는 그 시대의 언어가 새겨져 있고(레이마칭 셰이더 안에서 글자 아틀라스를 앞면에 입혀 빛·그림자·안개를 같이 받는다),
// 마지막 기둥(자연어)은 빛으로 된 유리라 주변 돌과 안개를 남색으로 물들인다.
(() => {
  const { clamp, lerp, ease, prog, noise } = Deck.util;
  const INK = "#f7f3ee", ACCENT = "#dde1ff";
  const STEPS = [
    { era: "1940s", name: "기계어", code: "10110000 01100001" },
    { era: "1950s", name: "어셈블리", code: "MOV AL, 61h" },
    { era: "1957 · 1972", name: "FORTRAN · C", code: 'printf("hi");' },
    { era: "1991 · 1995", name: "Python · JS", code: "print('hi')" },
    { era: "2020s", name: "자연어", code: "인사말 띄워 줘" },
  ];
  const BW = 3.0, GAP = 0.5, DZ = 3.0;
  const HEIGHT = [3.6, 5.0, 6.4, 7.8, 9.6];
  const XS = STEPS.map((_, i) => (i - 2) * (BW + GAP));
  const TILE_W = 1024, TILE_H = 640;
  const CPS = 9;
  const hangul = (s) => /[가-힣]/.test(s);

  // 기둥 앞면 글자: 시대(R) · 이름(G) · 코드(B) 채널에 따로 그려서 셰이더가 색을 나눠 쓴다
  function drawTile(c, y0, st, code) {
    c.save();
    c.translate(0, y0);
    c.globalCompositeOperation = "lighter";
    c.textBaseline = "alphabetic";
    c.fillStyle = "#ff0000"; c.font = Deck.text.fontOf(64, 500, "mono");
    c.fillText(st.era, 30, 96);
    c.fillStyle = "#00ff00"; c.font = Deck.text.fontOf(st.name.length > 6 ? 140 : 158, 600, "sans");
    c.fillText(st.name, 22, 296);
    const k = hangul(st.code);
    c.fillStyle = "#0000ff"; c.font = Deck.text.fontOf(k ? 108 : 84, k ? 600 : 500, k ? "sans" : "mono");
    c.fillText(code, 30, 470);
    c.restore();
  }

  const FRAG = Deck.glsl.noise + Deck.glsl.sdf + Deck.glsl.color + /* glsl */ `
uniform vec3 uRo, uF, uR, uU; uniform float uTan, uAsp;
uniform vec4 uBlk[5];          // x, 높이, 솟은 정도(0..1), 먼지
uniform float uGlow;           // 빛 기둥 밝기
uniform vec3 uSun;
uniform sampler2D tLab, tLab5;
#define BW ${BW.toFixed(2)}
#define DZ ${DZ.toFixed(2)}
#define RAD 0.08
const vec3 SUNC = vec3(1.0, .52, .26);
const vec3 GLOWC = vec3(.075, .115, 1.0);
const float LH = ${((BW * 0.84 * TILE_H) / TILE_W).toFixed(4)};

float sdBlock(vec3 p, int i){ vec4 b=uBlk[i]; float h=b.y; vec3 c=vec3(b.x, h*b.z-h*.5, 0.); return sdRoundBox(p-c, vec3(BW*.5, h*.5, DZ*.5), RAD); }
vec2 mapB(vec3 p){
  vec2 r=vec2(1e5,-1.);
  for(int i=0;i<5;i++){ if(uBlk[i].z<.002) continue; float d=sdBlock(p,i); if(d<r.x) r=vec2(d,float(i)); }
  return r;
}
vec3 nrm(vec3 p){ vec2 e=vec2(.0015,0.); return normalize(vec3(mapB(p+e.xyy).x-mapB(p-e.xyy).x, mapB(p+e.yxy).x-mapB(p-e.yxy).x, mapB(p+e.yyx).x-mapB(p-e.yyx).x)); }
vec2 boxHit(vec3 ro, vec3 rd, vec3 a, vec3 b){ vec3 inv=1./(rd+vec3(1e-6)); vec3 t0=(a-ro)*inv, t1=(b-ro)*inv; vec3 mn=min(t0,t1), mx=max(t0,t1); return vec2(max(max(mn.x,mn.y),mn.z), min(min(mx.x,mx.y),mx.z)); }
float shadow(vec3 ro, vec3 rd){
  float res=1., t=.04;
  for(int i=0;i<30;i++){ float h=mapB(ro+rd*t).x; res=min(res, 11.*h/t); t+=clamp(h,.05,.7); if(res<.003||t>28.) break; }
  return clamp(res,0.,1.);
}
float occl(vec3 p, vec3 n){
  float o=0., s=1.;
  for(int i=1;i<=5;i++){ float h=.05+.26*float(i); vec3 q=p+n*h; float d=min(mapB(q).x, q.y+.4); o+=(h-d)*s; s*=.72; }
  return clamp(1.-1.1*o,0.,1.);
}
// 해 반대편 하늘: 지구 그림자(푸른 띠) 위로 분홍 띠, 그 위로 깊은 파랑
vec3 sky(vec3 rd){
  float y=max(rd.y,0.);
  float sd=max(dot(rd,uSun),0.);
  vec3 c=mix(vec3(.78,.48,.54), vec3(1.0,.54,.55), smoothstep(.0,.035,y));
  c=mix(c, vec3(.30,.30,.56), smoothstep(.04,.13,y));
  c=mix(c, vec3(.075,.11,.30), smoothstep(.11,.36,y));
  c=mix(c, vec3(.02,.035,.11), smoothstep(.30,.8,y));
  c+=SUNC*pow(sd,3.)*.25;
  // 얇은 구름: 해 쪽 가장자리가 분홍·주황으로 물든다
  if(rd.y>.012){
    vec2 cp=rd.xz/rd.y*26.;
    float n=fbm(cp*.040+vec2(uTime*.004,0.));
    float n2=fbm(cp*.12-vec2(0.,uTime*.006)+7.);
    float cl=smoothstep(.50,.85,n*.78+n2*.34)*smoothstep(.012,.10,rd.y)*(1.-smoothstep(.35,.7,rd.y));
    vec3 cc=mix(vec3(.45,.34,.48), vec3(1.6,.78,.62), smoothstep(.45,.9,n2));
    c=mix(c, cc, cl*.7);
  }
  // 새 떼 (작은 V자 실루엣)
  for(int i=0;i<9;i++){
    float fi=float(i);
    vec2 h=hash22(vec2(fi,3.));
    vec3 bd=normalize(vec3(.25+h.x*.22+uTime*.0035, .30+h.y*.10+.02*sin(uTime*.3+fi), -1.));
    vec3 X=normalize(cross(bd, vec3(0,1,0))), Y=cross(X,bd);
    vec2 q=vec2(dot(rd-bd,X), dot(rd-bd,Y))*900.;
    float fl=sin(uTime*7.+fi*2.1)*1.2;
    float w=min(abs(q.y-(abs(q.x)*.55-.4)*(fl*.5+.3)), 9.)+max(abs(q.x)-3.2,0.)*3.;
    c=mix(c, vec3(.03,.035,.06), smoothstep(.75,.15,w)*step(dot(rd,bd),1.)*step(.9,dot(rd,bd)));
  }
  return c;
}
// 돌 질감: 거푸집 이음매 · 폼타이 구멍 · 빗물 자국
vec3 stone(vec3 p, vec3 n, int i, out float rough){
  vec4 b=uBlk[i];
  float ly=p.y-(b.y*b.z-b.y);            // 기둥 바닥에서 잰 높이 (기둥과 함께 움직인다)
  float lx=p.x-b.x;
  vec3 base = i==0 ? vec3(.17,.16,.155) : i==1 ? vec3(.28,.26,.24) : i==2 ? vec3(.38,.35,.31) : vec3(.48,.44,.38);
  vec2 fp = abs(n.z)>.5 ? vec2(lx, ly) : vec2(p.z, ly);
  float big=fbm(fp*vec2(.7,.33)+float(i)*7.3);
  float fine=vnoise(fp*vec2(22.,30.));
  vec3 c=base*(.78+.36*big)*(.93+.12*fine);
  float side=step(.5,abs(n.z)+abs(n.x));
  float seam=1.-smoothstep(.0,.016,abs(fract(ly/1.2)-.5)*1.2-.585);
  c*=1.-.22*seam*side;
  vec2 th=fract(fp/vec2(.75,1.2)+vec2(.5,.5))-.5;
  float hole=1.-smoothstep(.018,.03,length(th*vec2(.75,1.2)));
  c*=1.-.5*hole*side;
  float streak=smoothstep(.45,.9,fbm(vec2(fp.x*4.,ly*.3+float(i))))*smoothstep(.0,1.,(b.y-ly)/b.y+.2);
  c*=1.-.2*streak;
  rough=.72+.22*big;
  return c;
}
// 구름 바다: 잡음 높이장으로 된 안개 윗면을 따라가며 광학 깊이를 쌓는다. 볕 받은 봉우리는 따뜻하게, 골은 푸르게.
float seaH(vec2 xz){ vec2 w=vec2(uTime*.022,uTime*.009); float b=fbm3(xz*.20+w); return .25+1.25*b*b+.32*vnoise(xz*.75-w*2.)+.12*vnoise(xz*2.1+w*3.); }
vec4 cloudSea(vec3 ro, vec3 rd, float tmax){
  const float TOP=1.8;
  if(rd.y>-1e-4 && ro.y>TOP) return vec4(0);
  float t0 = ro.y>TOP ? (TOP-ro.y)/rd.y : 0.;
  float t1 = min(tmax, rd.y<0. ? -ro.y/rd.y : 1e5);
  if(t0>=t1) return vec4(0);
  float t=t0, od=0., tin=-1.; vec3 pin=vec3(0);
  for(int i=0;i<34;i++){
    float dt=.25+t*.035;
    vec3 p=ro+rd*t; float h=seaH(p.xz)-p.y;
    if(h>0.){ if(tin<0.){ tin=t; pin=p; } od+=h*1.6*dt; if(od>5.) break; }
    t+=dt; if(t>t1) break;
  }
  if(tin<0.) return vec4(0);
  vec2 e=vec2(.25,0.);
  vec3 n=normalize(vec3(seaH(pin.xz-e.xy)-seaH(pin.xz+e.xy), 2.*e.x, seaH(pin.xz-e.yx)-seaH(pin.xz+e.yx)));
  float lit=clamp(dot(n,uSun)*1.4+.05,0.,1.)*mix(.25,1.,shadow(pin+vec3(0,.08,0), uSun));
  float topk=clamp((pin.y-.25)/1.4,0.,1.);
  vec3 c=mix(vec3(.16,.14,.30), vec3(.46,.38,.56), topk);
  c+=SUNC*lit*1.55*(.25+.75*topk);
  c+=vec3(.20,.25,.50)*.30*(1.-lit);
  // 멀어질수록 지평선 빛과 섞인다
  vec2 g4=pin.xz-vec2(uBlk[4].x,0.);
  c+=GLOWC*uGlow*exp(-dot(g4,g4)/14.)*1.4*(.4+.6*topk);
  c=mix(c, vec3(.70,.46,.56), 1.-exp(-tin*.018));
  return vec4(c, 1.-exp(-od));
}
// 옅은 대기 원근
float fogDensity(vec3 ro, vec3 rd, float t){
  float k=rd.y;
  float pl=k<0. ? (1.1-ro.y)/k : 1e5;
  vec3 P=ro+rd*min(pl,t);
  float hs=0.;
  float a=.10, b=1.4, y0=ro.y-hs;
  float base=abs(k)<1e-4 ? a*exp(-b*y0)*t : (a/b)*exp(-b*y0)*(1.-exp(-b*k*t))/k;
  return max(base,0.)+min(t,140.)*.0007;
}
// 솟아오를 때 밑동에서 일어나는 흙먼지 (광선과 가우스 구름의 적분을 근사)
float dust(vec3 ro, vec3 rd, float t){
  float acc=0.;
  for(int i=0;i<5;i++){
    float a=uBlk[i].w; if(a<.002) continue;
    for(int j=0;j<2;j++){
      float s=float(j)*2.-1.;
      vec3 c=vec3(uBlk[i].x+s*(1.7+1.4*(1.-a)), 1.55+.9*(1.-a), .9);
      float sg=1.25+1.5*(1.-a);
      vec3 oc=c-ro; float tc=dot(oc,rd); float d2=dot(oc,oc)-tc*tc;
      acc+=a*exp(-d2/(sg*sg))*smoothstep(tc-sg,tc+sg*.3,t)*2.4;
    }
  }
  return acc;
}
void main(){
  vec2 q=vUv*2.-1.;
  vec3 rd=normalize(uF+q.x*uAsp*uTan*uR+q.y*uTan*uU);
  vec3 ro=uRo;
  float tg=rd.y<-1e-4 ? -ro.y/rd.y : 1e5;
  float t=1e5, id=-1.;
  vec2 bb=boxHit(ro, rd, vec3(-9.5,0.,-DZ*.5-.2), vec3(9.5,10.,DZ*.5+.2));
  if(bb.x<bb.y && bb.y>0.){
    float tt=max(bb.x,0.);
    for(int i=0;i<96;i++){ vec3 p=ro+rd*tt; vec2 h=mapB(p); if(h.x<.0012*tt){ t=tt; id=h.y; break; } tt+=h.x; if(tt>bb.y||tt>tg) break; }
  }
  if(id<0. && tg<1e4){ t=tg; id=9.; }
  // 글자 아틀라스 밉맵용 미분은 분기 밖(균일 흐름)에서 구한다
  vec3 Pd=ro+rd*min(t,400.); vec3 dPx=dFdx(Pd), dPy=dFdy(Pd);
  vec2 lgx=vec2(dPx.x/(BW*.84), -dPx.y/LH), lgy=vec2(dPy.x/(BW*.84), -dPy.y/LH);
  vec3 col;
  vec4 b4=uBlk[4];
  vec3 glowP=vec3(b4.x, b4.y*b4.z-b4.y*.40, .3);
  if(id<0.){ col=sky(rd); t=400.; }
  else{
    vec3 p=ro+rd*t;
    vec3 n = id>8. ? vec3(0,1,0) : nrm(p);
    float sh=shadow(p+n*.02, uSun);
    float ao=occl(p,n);
    float dif=max(dot(n,uSun),0.)*sh;
    vec3 L=glowP-p; float dl=length(L); L/=dl;
    vec3 glowLight=GLOWC*uGlow*max(dot(n,L)*.8+.2,0.)*7./(1.+dl*dl*.2);
    vec3 amb=vec3(.23,.29,.60)*(.75+.3*n.y);
    if(id>8.){
      float gr=fbm(p.xz*.35);
      vec3 alb=vec3(.40,.35,.30)*(.8+.3*gr);
      col=alb*(SUNC*4.2*dif+amb*ao+glowLight);
    } else if(id<3.5){
      int i=int(id+.5);
      float rough; vec3 alb=stone(p,n,i,rough);
      float carve=0.;
      if(n.z>.85){
        vec4 b=uBlk[i];
        float u=(p.x-(b.x-BW*.5))/BW, v=(b.y*b.z)-p.y;
        vec2 luv=vec2((u-.08)/.84, (v-.28)/LH);
        if(luv.x>0.&&luv.x<1.&&luv.y>0.&&luv.y<1.){
          vec2 tuv=vec2(luv.x,(float(i)+luv.y)/4.);
          vec2 sc=vec2(1.,.25);
          vec3 m=textureGrad(tLab,tuv,lgx*sc,lgy*sc).rgb;
          vec3 m2=textureGrad(tLab,tuv+vec2(.0018,.0026/4.),lgx*sc,lgy*sc).rgb;
          bool dark=i<2;
          vec3 ink = dark ? vec3(.95,.86,.66) : vec3(.05,.045,.04);
          float a=clamp(m.g+m.b*.95+m.r*.7,0.,1.);
          float rim=clamp(dot(m-m2,vec3(.7,1.,.95)),0.,1.);
          alb=mix(alb, ink, a*.95);
          alb*=1.-.35*rim*(dark?0.:1.);
          carve=dark?0.:a;
        }
      }
      vec3 hv=normalize(uSun-rd);
      float spec=pow(max(dot(n,hv),0.),28.)*(1.-rough)*sh;
      float fre=pow(1.-max(dot(n,-rd),0.),5.);
      col=alb*(SUNC*5.2*dif*(1.-.6*carve)+amb*ao+vec3(.62,.46,.58)*.55*clamp(-n.y*.5+.5,0.,1.)*ao+glowLight)+SUNC*spec*1.2*(1.-carve)+vec3(.25,.3,.6)*fre*.12*ao;
    } else {
      // 빛 기둥: 남색으로 빛나는 유리. 안에서 빛줄기가 올라가고, 글자는 어둡게 새겨진다.
      float fre=pow(1.-max(dot(n,-rd),0.),2.5);
      float ly=p.y-(b4.y*b4.z-b4.y);
      vec2 fp = abs(n.z)>.5 ? vec2(p.x-b4.x, ly) : vec2(p.z, ly);
      float rays=fbm(vec2(fp.x*2.3, ly*.32-uTime*.35))*.7+.3*vnoise(vec2(fp.x*9., ly*1.5-uTime*1.2));
      float inner=.62+.6*rays;
      vec3 em=GLOWC*(1.15+1.9*fre)*inner+vec3(.25,.3,.6)*pow(fre,3.)*.8;
      em+=vec3(.35,.45,1.)*(1.-smoothstep(0.,.02,abs(fract(ly/1.2)-.5)*1.2-.585))*.5;
      em*=.8+.45*smoothstep(0.,1.,ly/b4.y);
      float dark=0.;
      if(n.z>.85){
        float u=(p.x-(b4.x-BW*.5))/BW, v=(b4.y*b4.z)-p.y;
        vec2 luv=vec2((u-.08)/.84,(v-.28)/LH);
        if(luv.x>0.&&luv.x<1.&&luv.y>0.&&luv.y<1.){
          vec3 m=textureGrad(tLab5,luv,lgx,lgy).rgb;
          dark=clamp(m.g+m.b+m.r*.75,0.,1.);
        }
      }
      vec3 glass=vec3(.06,.07,.11)*(SUNC*3.*dif+amb)+SUNC*pow(max(dot(n,normalize(uSun-rd)),0.),90.)*2.5*sh;
      col=mix(glass+em*uGlow*.62, vec3(.008,.01,.035), clamp(dark*1.15,0.,1.));
    }
  }
  // 대기: 높이 안개 + 먼지 + 빛 기둥의 산란
  float sd=max(dot(rd,uSun),0.);
  vec3 og=glowP-ro; float tc=dot(og,rd); float d2=dot(og,og)-tc*tc;
  float gl=exp(-d2/30.);
  vec4 sea=cloudSea(ro,rd,t);
  sea.rgb+=GLOWC*uGlow*gl*1.6;
  col=mix(col, sea.rgb, sea.a);
  // 빛 기둥 위로 솟는 빛줄기
  if(uGlow>0.){
    vec2 r2=rd.xz; float l2=length(r2); r2/=l2;
    vec2 c2=vec2(b4.x,0.)-ro.xz; float tt=dot(c2,r2); float dd2=length(ro.xz+r2*tt-vec2(b4.x,0.));
    float t3=tt/l2; float yb=ro.y+rd.y*t3; float top=b4.y*b4.z;
    float beam=exp(-dd2*dd2/1.1)*smoothstep(top-.2,top+.6,yb)*exp(-(yb-top)*.09)*step(t3,t);
    col+=GLOWC*vec3(1.2,1.1,1.)*beam*uGlow*.9;
  }
  float fd=fogDensity(ro,rd,t);
  vec3 fogC=mix(vec3(.40,.36,.56), vec3(.95,.60,.62), smoothstep(-.05,.10,rd.y+.06));
  fogC+=SUNC*pow(sd,4.)*.3+GLOWC*uGlow*gl*2.;
  col=mix(col, fogC, 1.-exp(-fd));
  float dd=dust(ro,rd,t);
  vec3 dustC=vec3(1.25,.86,.70)*(.85+.3*sd)+GLOWC*uGlow*gl;
  col=mix(col, dustC, 1.-exp(-dd));
  col+=GLOWC*uGlow*exp(-d2/6.)*smoothstep(tc-3.,tc,t)*.45;
  o=vec4(col,1.);
}`;

  Deck.scene({
    id: "stairs",
    title: "추상화의 계단",
    bg: "#24213a",
    ink: "#ffffff",
    mood: 0.45,
    transition: "wipe",
    beats: [
      { dur: 4.8, note: "기계어에서 어셈블리로, 고급 언어로, 스크립트 언어로.\n한 계단 오를 때마다 컴퓨터에게 하는 말이 사람 말에 조금씩 가까워졌습니다." },
      { dur: 4.4, note: "그리고 그다음 계단은 우리가 평소에 쓰는 말 그대로입니다.\n바이브 코딩은 갑자기 나타난 게 아니라, 70년 넘게 이어진 흐름의 다음 칸입니다." },
    ],
    create(ctx) {
      const { T, g } = ctx;
      const rt = ctx.target({ scale: 0.8 });
      // 글자 아틀라스 (기둥 0~3은 고정, 4는 타자에 따라 다시 그림)
      const mk = (w, h) => {
        const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
        const tex = new T.CanvasTexture(cv);
        Object.assign(tex, { flipY: false, generateMipmaps: true, minFilter: T.LinearMipmapLinearFilter, magFilter: T.LinearFilter, anisotropy: 8 });
        tex.colorSpace = T.NoColorSpace;
        return { cv, c: cv.getContext("2d"), tex };
      };
      const A = mk(TILE_W, TILE_H * 4), B5 = mk(TILE_W, TILE_H);
      let atlasReady = false, typedKey = -1;
      const paintAtlas = () => {
        A.c.fillStyle = "#000"; A.c.fillRect(0, 0, TILE_W, TILE_H * 4);
        for (let i = 0; i < 4; i++) drawTile(A.c, i * TILE_H, STEPS[i], STEPS[i].code);
        A.tex.needsUpdate = true; atlasReady = true;
      };
      const paint5 = (n) => {
        if (n === typedKey) return;
        typedKey = n;
        B5.c.fillStyle = "#000"; B5.c.fillRect(0, 0, TILE_W, TILE_H);
        drawTile(B5.c, 0, STEPS[4], Array.from(STEPS[4].code).slice(0, n).join(""));
        B5.tex.needsUpdate = true;
      };
      const pass = ctx.pass(FRAG, {
        uRo: new T.Vector3(), uF: new T.Vector3(), uR: new T.Vector3(), uU: new T.Vector3(), uTan: 0.35, uAsp: 16 / 9,
        uBlk: { value: Array.from({ length: 5 }, () => new T.Vector4()) }, uGlow: 0,
        uSun: new T.Vector3(-0.78, 0.14, 0.6).normalize(), tLab: A.tex, tLab5: B5.tex,
      });

      const sh = (a) => ({ blur: 26, alpha: a, y: 3, color: "#0b0e1c" });
      const head = ctx.text("프로그래밍은 계속\n사람의 말에 가까워졌습니다", { size: 92, weight: 300, tracking: -0.035, leading: 1.2, color: INK, valign: "top", shadow: sh(0.3) });
      head.at(120, 96);
      const next = ctx.text("다음 계단은 한국어입니다.", { size: 46, weight: 500, tracking: -0.02, color: ACCENT, valign: "top", shadow: sh(0.35) });
      next.at(124, 352);
      const caption = ctx.text("기계어 → 어셈블리 → 고급 언어 → 스크립트 언어", { size: 29, weight: 400, tracking: -0.005, color: "#dcd8ea", valign: "top", shadow: sh(0.35) });
      caption.at(124, 360);

      const fwd = new T.Vector3(), right = new T.Vector3(), up = new T.Vector3(), pos = new T.Vector3(), tgt = new T.Vector3(), Y = new T.Vector3(0, 1, 0);
      const delay = (i) => 0.5 + i * 0.62;

      return {
        render(s, hdr) {
          if (!atlasReady) paintAtlas();
          const a0 = s.at(0), a1 = s.at(1);
          // 기둥이 솟는 정도와 먼지
          const rise = STEPS.map((_, i) => (i < 4 ? prog(a0, delay(i), 1.6, ease.out3) : prog(a1, 0.15, 2.1, ease.out3)));
          const since = STEPS.map((_, i) => (i < 4 ? (a0 < 0 ? -1 : a0 - delay(i)) : (a1 < 0 ? -1 : a1 - 0.15)));
          const dust = since.map((t) => (t < 0 ? 0 : Math.exp(-Math.pow((t - 0.8) / 0.95, 2)) * 0.85));
          STEPS.forEach((_, i) => pass.u.uBlk.value[i].set(XS[i], HEIGHT[i], rise[i], dust[i]));
          const glow = prog(a1, 0.35, 2.2, ease.inOut2);
          pass.u.uGlow.value = glow * (0.93 + 0.07 * Math.sin(s.time * 1.7));
          const nType = clamp(Math.floor((a1 - 2.0) * CPS), 0, Array.from(STEPS[4].code).length);
          paint5(a1 < 0 ? 0 : nType);

          // 카메라: 1비트 동안 천천히 밀고, 2비트에 빛 기둥 쪽으로 고개를 든다. 솟아오를 때는 땅이 살짝 울린다.
          const d = prog(a0, 0, 8, ease.inOut2), e = prog(a1, 0, 4.5, ease.inOut3);
          const sway = Math.sin(s.time * 0.07) * 0.2;
          const quake = rise.reduce((acc, r, i) => acc + Math.sin(Math.PI * r) * (i === 4 ? 1.4 : 1), 0) * 0.018;
          pos.set(lerp(-9.8, -9.0, d) + e * 0.35 + sway + s.mouse.x * 0.35 + noise(s.time * 13) * quake,
            lerp(2.3, 2.55, d) + e * 0.35 - s.mouse.y * 0.15 + noise(s.time * 11 + 7) * quake,
            lerp(22.5, 21.7, d) - e * 0.4);
          tgt.set(lerp(1.0, 1.4, d) + e * 0.45, lerp(5.1, 5.3, d) + e * 0.45, 0);
          fwd.subVectors(tgt, pos).normalize();
          right.crossVectors(fwd, Y).normalize();
          up.crossVectors(right, fwd).normalize();
          const asp = g.W / g.H, fov = 38;
          let tanV = Math.tan((fov * Math.PI) / 360);
          if (asp < 16 / 9) tanV *= 16 / 9 / asp;
          pass.u.uRo.value.copy(pos); pass.u.uF.value.copy(fwd); pass.u.uR.value.copy(right); pass.u.uU.value.copy(up);
          pass.u.uTan.value = tanV; pass.u.uAsp.value = asp; pass.u.uTime.value = s.time + 20;
          pass.render(rt);
          ctx.copy(rt, hdr);

          // 글자
          head.show(prog(a0, 0.05, 1.2, ease.linear), { style: "rise", stagger: 0.35 });
          caption.show(prog(a0, 3.7, 1.0, ease.linear), { style: "blur", stagger: 0.4, out: prog(a1, 0, 0.5, ease.linear) });
          next.show(prog(a1, 2.7, 0.9, ease.linear), { style: "rise", stagger: 0.4 });

          // 소리
          for (let i = 0; i < 4; i++) {
            s.cue("r" + i, a0 > delay(i), "rise", { dur: 1.3, vol: 0.05 });
            s.cue("t" + i, a0 > delay(i) + 1.1, "thud", { vol: 0.22 + i * 0.05 });
          }
          s.cue("r4", a1 > 0.15, "riser", { dur: 2.0, vol: 0.07 });
          s.cue("g4", a1 > 1.4, "swell", { root: 57, vol: 0.06 });
          s.ticks("type", a1 < 0 ? 0 : nType, "key");
          return { bloom: 0.65, threshold: 1.15, knee: 0.7, radius: 1.0, exposure: 0.88, tone: "aces", contrast: 1.1, saturation: 1.04, vignette: 0.4, grain: 0.045, ca: 0.3 };
        },
      };
    },
  });
})();
