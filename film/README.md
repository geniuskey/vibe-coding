# 바이브 코딩 — 10분 필름 (`film/`)

장면마다 한 화면 가득 움직이는 그림으로 진행하는 10분짜리 한국어 발표입니다.
엔진, 셰이더, 장면, 문구, 사운드는 모두 새로 작성했습니다. "한 화면 가득 움직이는 그림 + 비트 단위 진행"이라는 형식은
claude.ai 공개 아티팩트 ‘The Last Boring Slide’에서 영감을 받았고, 마지막 장에 그 사실을 표기했습니다.

## 실행 · 빌드

```sh
node build.mjs                      # → index.html (스크립트·폰트를 모두 내장한 단일 파일, 약 3.7MB)
node build.mjs --out /tmp/a.html    # 다른 곳에 빌드
```

`index.html`을 브라우저(Chrome · Edge · Safari · Firefox 최신판, WebGL 2 필요)로 열면 됩니다.
처음 열 때 모든 장면의 셰이더를 미리 컴파일하느라 1~3초 정도 로딩 막대가 보입니다.
개발 중에는 `src/index.html`을 정적 서버로 열어도 됩니다(빌드 불필요). 예: `npx serve src`

## 조작

| 키 | 동작 |
|---|---|
| → · Space · 클릭 | 다음 비트 |
| ← · 화면 왼쪽 클릭 · 오른쪽 버튼 | 이전 비트 (애니메이션이 거꾸로 감깁니다) |
| N | 발표자 노트 + 경과 시간 |
| W | 발표자 창 — 두 번째 화면에 노트 · 다음 내용 · 시간 (팝업 허용 필요) |
| O · Esc | 전체 보기 (썸네일) |
| F | 전체 화면 |
| M | 음소거 |
| B | 배경음악 켜기/끄기 |
| P | 진행 표시(오른쪽 아래 번호 · 맨 아래 막대) 켜기/끄기 |
| A | 자동 진행 |
| . | 화면 잠깐 끄기 |
| Home · End | 처음 · 끝 |
| ? | 도움말 |

주소의 `#/장면/비트`로 위치가 남아서, 새로고침해도 같은 자리에서 다시 시작합니다.
주소 뒤에 `?q=0.7`처럼 붙이면 렌더 해상도를 고정합니다(기본은 프레임 시간에 맞춰 자동으로 1 → 0.85 → 0.72 → 0.6 → 0.5).

## 장면

| # | 장면 | 그림 | 비트 |
|---|---|---|---|
| 1 | 한 줄로 시작 | 성운 앞 유리 프롬프트 창 → 보내면 글자가 빛 입자 9천 개로 흩어져 제목 "바이브 코딩"으로 모인다 | 2 |
| 2 | 추상화의 계단 | 노을 진 구름 바다 위로 돌기둥(기계어 → 어셈블리 → FORTRAN·C → Python·JS)이 솟고, 마지막 "자연어" 기둥은 빛나는 유리 | 2 |
| 3 | 바이브 코딩이란 | 정의 문장 → 말하기·생성·실행·확인 4점을 도는 빛의 고리, 혜성이 점점 빨라진다 | 3 |
| 4 | 실험이 공짜가 되면 | 밝은 스튜디오: 시제품 하나를 정성껏 → 시안 45개 벽 → 하나를 골라 선택 상자 | 3 |
| 5 | 에이전트 | 로그가 흐르는 터미널 하나 → 터미널 벽 → 벽 앞에 선 사람에게 결과가 빛줄기로 모인다 | 3 |
| 6 | 어디에 쓰면 좋을까 | 창문 햇빛이 드는 종이 위 카드 → "틀렸을 때 치르는 비용" 축으로 재배열 | 3 |
| 7 | 작은 오차는 쌓인다 | 밤의 소금 사막: 확인 없이 간 붉은 길은 빗나가고, 확인 지점(테스트·직접 실행·코드 리뷰)을 지난 초록 길은 빛기둥에 닿는다 | 2 |
| 8 | 네 가지 습관 | 나뭇잎 그림자가 흔들리는 종이 위, 손으로 그은 잉크 체크 | 2 |
| 9 | 무게중심의 이동 | 스포트라이트 아래 황동 저울: 손의 일(타이핑·문법·반복 코드)이 먼지로 흩어지고 판단·설계·검증·취향 쪽으로 기운다 | 2 |
| 10 | 마무리 | 이 발표를 만든 프롬프트 → 앞 장면들이 필름처럼 흘러나온다 → 구름 바다 위 해돋이, "질문 있으신가요?" | 2 |

## 구조

```
src/index.html          화면 뼈대와 스크립트 순서
src/style.css           노트 · 전체 보기 · 도움말 · 로딩 화면 스타일, 폰트
src/engine/
  util.js               수학 · 이징 · 난수 · 색
  glsl.js               셰이더 공용 조각(해시, 값/기울기 잡음, fbm, 보로노이, 거리 함수, AgX/ACES 톤 매핑)
  gfx.js                WebGL2 파이프라인: HDR 타깃 → 블룸 → 톤 매핑·색 보정 → 그레인·디더
  text.js               글리프 아틀라스 글자: 글자마다 따로 움직이는 올라오기·흐림·타자기·흩어짐, 그림자, 3D 배치
  shapes.js             거리 함수 도형(둥근 사각형, 원, 선, 호, 선택 상자)과 캔버스 패널
  deck.js               장면 수명, 비트 시계(되감기), 전환, HUD, 입력, 노트 · 발표자 창 · 전체 보기, 미리 컴파일, 적응형 해상도
  transitions.js        전환 셰이더 12종: fade dissolve zoom wipe iris slide blinds pixels ripple flash dip glitch
src/audio.js            Web Audio 합성: 스테레오 앰비언트 배경음악(장면 mood에 따라 밝기·밀도 변화) + 효과음 22종
src/scenes/NN-*.js      장면 10개
src/vendor/three.min.js three.js r159 (MIT)
src/fonts/              Pretendard Variable, Geist Mono (둘 다 SIL OFL)
tools/                  헤드리스 Chrome으로 장면을 멈춰 찍는 시험 도구
```

### 그림이 그려지는 순서 (한 프레임)

1. 장면이 `hdr`(반정밀 부동소수 · MSAA)에 선형 HDR로 그립니다 — 레이마칭 셰이더 패스, three.js 3D, 입자 등.
2. 블룸(6단계 다운/업샘플) → AgX 또는 ACES 톤 매핑 → 대비·채도·리프트·게인·비네팅·색수차 → LDR(sRGB).
3. 장면의 겹레이어(`ctx.overlay`: 글자·도형·패널)를 그 위에 또렷하게 얹습니다. 색이 디자인 값 그대로 나옵니다.
4. 장면이 바뀌는 중이면 두 장면의 완성 그림을 전환 셰이더로 섞습니다.
5. 필름 그레인과 디더를 더해 화면에 내보내고, HUD를 그립니다.

## 장면 작성법

```js
Deck.scene({
  id: "loop", title: "바이브 코딩이란", bg: "#07080d", ink: "#ffffff", mood: 0.5, transition: "iris",
  beats: [{ dur: 3, note: "발표자 노트" }, { dur: 4, note: "..." }],
  create(ctx) {
    const title = ctx.text("말하고, 만들고", { size: 96, weight: 300, tracking: -0.03 });
    const bg = ctx.pass(`${ctx.glsl.noise} void main(){ o = vec4(vec3(fbm(vUv*4.+uTime*.1))*.2, 1.); }`);
    return {
      render(s, hdr) {
        bg.u.uTime.value = s.time; bg.render(hdr);            // HDR 배경
        title.at(120, 180).show(s.p(0, 0.2, 1.2), { style: "rise" });
        s.cue("in", s.at(0) > 0.3, "chime", { note: 76 });    // 조건이 참이 되는 순간 한 번
        return { bloom: 0.5, exposure: 1, vignette: 0.3, grain: 0.04 };
      },
    };
  },
});
```

- 그림은 시간만으로 정해지는 순수 함수여야 합니다. 그래야 뒤로 가기(되감기), 썸네일, 미리 컴파일이 저절로 맞습니다.
  - `s.at(k)`: k번째 비트가 시작된 뒤 흐른 초(아직이면 -1). 뒤로 가면 이 값이 거꾸로 줄어듭니다.
  - `s.p(k, delay, dur, ease)`: 0→1 진행도. `s.time`: 장면 시간(배경 애니메이션용). `s.mouse`: 부드러운 포인터(-1..1).
  - `beats[k].dur`: 그 비트의 애니메이션이 끝나는 시간(되감기 · 자동 진행 기준).
- 글자: `ctx.text(str, { size, weight, family: "sans"|"mono", color, align, valign, leading, tracking, maxWidth, shadow })`
  → `.at(x, y)`, `.show(p, { style: "rise"|"blur"|"fade"|"type"|"pop"|"drop"|"scatter"|"track", stagger, out, by: "glyph"|"word"|"line" })`,
  `.animate((글자, o) => { o.dy = …; o.alpha = …; o.blur = …; })`, `.caret(n)`, `.points(n)`(글자 모양 안의 점, 입자용), `.in3D(scale)`.
- 도형: `ctx.shape("rect"|"circle"|"line"|"arc"|"select", { fill, stroke, line, radius, shadow, glow })` → `.rect()/.center()/.circle()/.path()/.arc()/.alpha()`.
  선택 상자 `"select"`는 `.around(text)`, `.appear(p)`.
- 패널: `ctx.panel(w, h, { draw(ctx2d, w, h, ...) })` → `.redraw(key, ...)`(key가 바뀔 때만 다시 그림), `.place(x, y)`.
- 3D: three.js 장면을 `ctx.draw(scene, camera, hdr)`로 그리고, `ctx.project(vec3, camera)`로 3D 위치에 글자를 붙입니다.
  `ctx.env(scene)`은 PMREM 환경맵(금속 반사용), `ctx.target({ scale })`은 장면 전용 렌더 타깃(무거운 레이마칭은 0.5~0.75 해상도로).
- 효과음: `s.cue(key, 조건, 이름, 옵션)`, `s.ticks(key, 숫자, 이름)`. 이름: key tick click tock pop blip chime glass ding shimmer thud stamp impact bass buzz hum rise riser sweep whoosh send swell.
  사운드는 첫 키 입력·클릭 때 켜집니다(브라우저 정책).

장면을 추가하려면 `src/scenes/`에 파일을 만들고 `src/index.html`에 `<script>`를 한 줄 넣으면 됩니다.

## 시험 도구

```sh
node tools/shoot.mjs --out shots/a "stairs:2:999" "loop:3:1.2" --trans loop:0.5 --perf loop:3
```

헤드리스 Chrome(macOS 기본 경로, 다르면 `CHROME=경로`)으로 `index.html`을 열고, 원하는 장면 · 비트 · 시각을 멈춘 화면으로 찍습니다.
`--w 1440 --h 1080`처럼 화면 비율을 바꿔 잘리는 곳이 없는지 볼 수 있습니다.

## 발표 전에 확인할 것

- 3장의 "2025년 2월, 안드레이 카파시가 붙인 이름"과 2장의 언어별 연도는 일반적으로 알려진 사실입니다.
  그 외 수치형 주장은 넣지 않았습니다. 실제 데이터(예: 우리 팀 사례)를 넣으려면 해당 장면의 문구를 바꾸세요.
- 노트(N · W)는 발표 대본 초안입니다. 본인 말투로 다듬어 쓰세요.
- 발표할 컴퓨터에서 한 번 끝까지 넘겨 보세요. 그래픽 성능이 낮으면 해상도가 자동으로 내려갑니다(`?q=`로 고정 가능).

## 이 저장소에서

- 소스는 `src/`, 발행본은 빌드한 `index.html`입니다. `src`를 고쳤으면 `node build.mjs`로 `index.html`을 다시 만들어 함께 커밋하세요.
- reveal.js 덱이 아니라서 발표자 콘솔(`/present/`) 동기화와 "핵심만 보기" 모드는 적용되지 않습니다. 발표자 노트는 자체 기능(N · W)을 씁니다.
- 원래 작업 폴더: `boring-slide/vibe/` (원작 덱을 풀어 둔 `original/` · 루트 `src/`는 원작자 것이라 이 저장소에 넣지 않습니다).
