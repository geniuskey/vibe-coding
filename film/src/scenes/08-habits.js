// 08 · 좋은 바이브 코딩의 네 가지 습관
// 나뭇잎 사이로 들어온 아침 햇살(코모레비)이 천천히 흔들리는 종이. 습관 한 줄마다 큰 숫자, 제목, 설명이 올라오고
// 가는 선이 왼쪽에서 오른쪽으로 그어진 뒤, 손으로 그은 듯한 남색 잉크 체크가 그려진다(잉크는 종이 셰이더 안에서 같은 빛을 받는다).
(() => {
  const { clamp, lerp, ease, prog, lin } = Deck.util;
  const INK = "#17181c", MUTED = "#6b6e78", ACCENT = "#3a47d6";
  const ITEMS = [
    ["작게 요청하기", "한 번에 한 가지. 큰 일은 쪼개서."],
    ["실행해서 확인하기", "'다 됐어요'를 믿지 말고 직접 돌려 보기."],
    ["자주 저장하기", "커밋은 언제든 돌아올 수 있는 지점."],
    ["읽고 이해하기", "설명할 수 없는 코드는 아직 내 코드가 아니다."],
  ];
  const Y0 = 290, RH = 165, MX = 1688;
  const rowY = (i) => Y0 + RH / 2 + i * RH;
  const rowT = (i) => 0.25 + (i % 2) * 0.95;   // 비트 안에서 줄이 시작하는 시각

  const FRAG = Deck.glsl.noise + Deck.glsl.sdf + /* glsl */ `
uniform vec4 uView; uniform float uPx; uniform vec4 uMark[4]; uniform vec3 uInk;
// 바늘구멍 햇빛 조각: 이웃 칸들의 둥근 점을 모두 더해서 칸 경계에서 잘리지 않게
float spots(vec2 x, float th){
  vec2 i=floor(x), f=fract(x); float s=0.;
  for(int y=-1;y<=1;y++) for(int xx=-1;xx<=1;xx++){
    vec2 g=vec2(xx,y); vec2 o=hash22(i+g); float on=step(th, hash12(i+g+13.7));
    float r=.2+.12*hash12(i+g+3.1);
    s=max(s, on*(1.-smoothstep(r*.4, r, length(g+o-f))));
  }
  return s;
}
// 코모레비: 나뭇잎 사이로 든 햇빛. 큰 빛 덩어리 + 길쭉한 잎 그림자 + 가장자리의 둥근 빛점
float komorebi(vec2 p, float t){
  vec2 sw=vec2(sin(t*.31)*16.+sin(t*.83)*5., cos(t*.27)*11.+sin(t*.61)*3.);
  vec2 q=p+sw;
  float big=fbm(q*.0024+vec2(1.7,4.2));
  float lit=smoothstep(.38,.62,big);
  vec2 lq=rot2(.6)*(q+vec2(sin(t*.5)*6.,0.));
  float lv=smoothstep(.44,.66,fbm(lq*vec2(.0105,.018)+vec2(t*.015,0.)+7.));
  float sp=spots(q*.0115+vec2(t*.008,-t*.005), .5)*smoothstep(.32,.5,big)*(1.-lit);
  float L=lit*(1.-lv*.5)+sp*.6;
  L*=.5+.5*smoothstep(-300.,1500.,p.x-p.y*.3);
  return clamp(L,0.,1.);
}
vec2 bez(vec2 a, vec2 b, vec2 c, float t){ float u=1.-t; return u*u*a+2.*u*t*b+t*t*c; }
// 손으로 그은 체크: 두 획(짧게 내려 긋고, 길게 올려 긋기)을 draw까지만. 반환: 거리, 획 진행도(along), 획 두께
float tick(vec2 p, vec4 M, out float along, out float wid){
  vec2 q=p-M.xy; float sd=M.w;
  vec2 A=vec2(-38.,-6.)+vec2(hash11(sd)*6.-3., hash11(sd+1.)*6.-3.);
  vec2 B=vec2(-12.,26.)+vec2(hash11(sd+4.)*4.-2., 0.);
  vec2 C=vec2(46.,-42.)+vec2(hash11(sd+2.)*8.-4., hash11(sd+3.)*8.-4.);
  vec2 cAB=(A+B)*.5+vec2(-5.,2.), cBC=(B+C)*.5+vec2(7.,7.);
  float L1=length(B-A), L2=length(C-B)*1.02, L=L1+L2, j=L1/L;
  float best=1e5, bs=0.; vec2 prev=A; float sp=0.;
  for(int i=1;i<=18;i++){
    vec2 cur; float s;
    if(i<=6){ float tt=float(i)/6.; cur=bez(A,cAB,B,tt); s=tt*j; }
    else { float tt=float(i-6)/12.; cur=bez(B,cBC,C,tt); s=j+tt*(1.-j); }
    if(sp>M.z) break;
    float hm=clamp((M.z-sp)/max(s-sp,1e-4),0.,1.);
    vec2 pa=q-prev, ba=cur-prev; float h=min(clamp(dot(pa,ba)/dot(ba,ba),0.,1.),hm);
    float d=length(pa-ba*h);
    if(d<best){ best=d; bs=mix(sp,s,h); }
    prev=cur; sp=s;
  }
  along=bs;
  float w=2.6+3.2*smoothstep(0.,.1,bs)*(1.-smoothstep(.62,1.,bs))+2.*exp(-pow((bs-j)/.05,2.));
  w*=.92+.16*sin(bs*23.+sd*7.);
  wid=w;
  return best;
}
void main(){
  vec2 p=vec2(uView.x+vUv.x*uView.z, uView.y+(1.-vUv.y)*uView.w);
  float t=uTime;
  float fib=vnoise(p*vec2(1.1,.25))*.5+vnoise(p*.4)*.5;
  vec3 paper=vec3(.94,.917,.872)*(.982+.032*(fbm(p*.0035)-.5)+.018*(fib-.5));
  float L=komorebi(p,t);
  vec3 amb=vec3(.865,.852,.835), sunC=vec3(1.,.86,.62)*.2;
  vec3 light=amb+sunC*L;
  vec3 col=paper*light;
  // 잉크 체크
  for(int i=0;i<4;i++){
    vec4 M=uMark[i]; if(M.z<=0.) continue;
    if(abs(p.x-M.x)>70. || abs(p.y-M.y)>60.) continue;
    float al, w; float d=tick(p,M,al,w);
    float aa=uPx*1.2;
    float a=1.-smoothstep(w-aa,w+aa,d);
    float dry=smoothstep(.75,1.,al)*smoothstep(.45,.75,vnoise(p*.35+M.w*10.));
    a*=1.-dry*.75;
    a*=.86+.14*vnoise(p*.9+M.w);
    vec3 ink=uInk*(.85+.15*smoothstep(0.,w,d));
    col=mix(col, ink*light, a*.94);
  }
  o=vec4(col,1.);
}`;

  Deck.scene({
    id: "habits",
    title: "네 가지 습관",
    bg: "#f1ebe0",
    ink: "#1a1a1f",
    mood: 0.55,
    transition: "dissolve",
    beats: [
      { dur: 2.6, note: "그럼 어떻게 하면 잘 쓸 수 있을까요. 네 가지 습관입니다.\n첫째, 작게 요청하기. 둘째, 결과를 직접 실행해서 확인하기." },
      { dur: 2.6, note: "셋째, 자주 저장하기. 커밋을 자주 해 두면 언제든 돌아갈 수 있습니다.\n넷째, 읽고 이해하기. 내가 설명할 수 없는 코드는 아직 내 코드가 아닙니다." },
    ],
    create(ctx) {
      const { T, g } = ctx;
      const bg = ctx.pass(FRAG, { uView: new T.Vector4(), uPx: 1, uInk: new T.Vector3(...lin(ACCENT)), uMark: { value: Array.from({ length: 4 }, () => new T.Vector4()) } });
      const U = bg.u;
      const head = ctx.text("좋은 바이브 코딩의 네 가지 습관", { size: 88, weight: 400, tracking: -0.035, color: INK });
      const rows = ITEMS.map(([title, sub], i) => ({
        num: ctx.text(String(i + 1).padStart(2, "0"), { size: 116, weight: 200, tracking: -0.04, color: ACCENT }),
        title: ctx.text(title, { size: 52, weight: 500, tracking: -0.025, color: INK }),
        sub: ctx.text(sub, { size: 30, weight: 400, tracking: -0.01, color: MUTED }),
        line: ctx.shape("rect", { fill: INK }),
      }));

      return {
        render(s, hdr) {
          const vw = g.view;
          U.uView.value.set(vw.x0, vw.y0, vw.w, vw.h); U.uPx.value = 1 / Math.max(0.25, g.ppu); U.uTime.value = s.time + 20;
          head.at(120, 176).show(s.p(0, 0.02, 0.9, ease.linear), { style: "rise", stagger: 0.3 });
          rows.forEach((r, i) => {
            const b = i < 2 ? 0 : 1, a = s.at(b), d = rowT(i), cy = rowY(i);
            r.num.at(120, cy + 41).show(prog(a, d, 0.9, ease.linear), { style: "rise", stagger: 0.25 });
            r.title.at(334, cy - 6).show(prog(a, d + 0.1, 0.8, ease.linear), { style: "rise", stagger: 0.3 });
            r.sub.at(336, cy + 44).show(prog(a, d + 0.3, 0.9, ease.linear), { style: "blur", stagger: 0.4 });
            const lp = prog(a, d, 1.1, ease.inOut3);
            if (lp > 0) r.line.rect(120, cy + RH / 2 - 1, 1680 * lp, 1.5).alpha(0.13); else r.line.alpha(0);
            const tp = prog(a, d + 0.55, 0.62, ease.inOut2);
            U.uMark.value[i].set(MX, cy, tp, 3.7 + i * 1.31);
            s.cue("in" + i, a > d, "tock", { vol: 0.06 });
            s.cue("ok" + i, a > d + 1.1, "chime", { note: [72, 76, 79, 84][i], vol: 0.11 });
            s.cue("pen" + i, a > d + 0.55, "sweep", { up: true, dur: 0.45 });
          });
          bg.render(hdr);
          return { tone: "none", exposure: 1.0, bloom: 0.0, vignette: 0.15, grain: 0.022, warm: 0.12, contrast: 1.02, saturation: 1.02 };
        },
      };
    },
  });
})();
