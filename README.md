# vibe-coding

바이브 코딩 세미나 슬라이드 모음 (reveal.js, 폴더별 단일 `index.html`, 빌드 없음).

루트 `index.html`은 전체 세미나를 안내하는 대표(허브) 페이지이고, 각 세미나는 주제별 폴더에 있다:

| 구역 | 폴더 | 내용 |
| --- | --- | --- |
| 00 맛보기 | `use-cases/` | 이것도 바이브 코딩으로 됩니다 — 5분 상황별 활용 가이드 (경품 추첨기 · 엑셀→실시간 대시보드 · 리더 주간보고 · 개발자 주간 활동 · 상황별 처방표). **내레이션 캠페인 덱** — 아래 "내레이션" 참고 |
| 핵심 경로 1 | `setup/` | 0교시 — 설치와 기본 조작 (환경 세팅 · 로그인 · 첫 대화 · Esc·@·권한 모드·명령어 · 모델 고르기 · 트러블슈팅 TOP 5) |
| 핵심 경로 2 | `intro/` | 바이브 코딩이란 무엇인가? (원본 입문 세미나 — 왜·무엇) |
| 핵심 경로 3 | `workshop/` | 바이브 코딩 실습 워크숍 (90분·3시간·8시간 코스 선택형 핸즈온 · 업무 레시피 11개 · 심화 트랙 — 강사용 런북은 `workshop/README.md`) |
| 01 기본기 | `prompt/` | AI에게 일 시키는 법 — 프롬프트 엔지니어링 (3요소 프레임 · 패턴 8가지 · 다듬기 루프의 정본: 피드백 공식 · 증상별 복구 문장) |
| 01 기본기 | `ui-ux/` | 바이브 코더를 위한 UI/UX 용어 사전 (+ 비주얼 치트시트 `ui-ux/cheatsheet.html`) |
| 01 기본기 | `github/` | 바이브 코딩을 위한 최소한의 Git & GitHub (GitHub Pages 배포의 정본) |
| 01 기본기 | `debugging/` | 고칠수록 꼬일 때 — AI와 함께 디버깅하기 (재현 · 가설 · 한 번에 하나 · 사내 단골 에러 처방 · 실습 파일 `debugging/lab/`) |
| 02 더 깊이 | `context/` | 컨텍스트 — AI 에이전트의 작업 책상 |
| 02 더 깊이 | `knowledge/` | LLM에게 지식을 가르치는 법 (LLM 위키 · RAG · 지식 그래프 · 온톨로지 · 실습 5개) |
| 02 더 깊이 | `verification/` | AI가 쓴 코드를 믿는 법 — 검증과 테스트 (검증의 사다리 · 분석 숫자 믿는 법 · TDD · AI 리뷰 · 평가) |
| 02 더 깊이 | `orchestration/` | 서브에이전트와 오케스트레이션 (컨텍스트 격리 · 병렬 fan-out · 파이프라인 · Workflow) |
| 02 더 깊이 | `security/` | 사내 환경에서의 AI — 보안과 거버넌스 (보안 약속 3개의 정본 `#/promises` · 데이터 경로 · 인젝션 · 권한 · 민감 파일 차단 실습) |
| 03 직접 해보기 | `agent-skills/` | 내 노하우를 AI에게 물려주는 법 — CLAUDE.md · Agent Skills (반복 설명을 파일로 승격하는 정본 + 반도체 실무 예제, 예제 스킬 모음 `agent-skills/skills/`) |
| 03 직접 해보기 | `making-slides/` | 바이브 코딩으로 슬라이드 자료 만들기 (레퍼런스 앵커링 · 좌표+증상 피드백 · 스스로 검사 — CLAUDE.md·스킬은 `agent-skills/`로, `slide-deck` 예제 스킬 동봉) |
| 03 직접 해보기 | `automation/` | 내 도구가 혼자 돌게 — 연결(MCP) · 예약 실행 · 팀이 같이 쓰는 앱 |
| 번외 | `forChildren/` | 나만의 게임 만들기 (어린이 × 부모) |
| 번외 | `ai-map/` | AI 업계 지도 — 각 진영의 전략 (입문 덱 부록에서 분리, 분기마다 갱신) |

**핵심 경로는 세 개뿐이다**: `setup/`(40분) → `intro/`(60분) → `workshop/`(90분·3시간·8시간). 시작 전 맛보기로 `use-cases/`(5분).
처방전 덱은 순서대로 듣는 커리큘럼이 아니라, 일하다 막혔을 때 펼쳐 보는 **증상별 처방전**이다 —
허브의 "막혔을 때 — 증상으로 찾기"가 증상 → 덱으로 바로 연결하고, "한 장 요약"이 시리즈 전체를 9줄로 압축한다.

**정본 규칙**: 같은 개념이 여러 덱에 나오면 정본 덱에서만 자세히 다루고 나머지는 한 장 요약 + 링크로 둔다 —
다듬기 루프 → `prompt/` · CLAUDE.md·스킬 → `agent-skills/` · Pages 배포 → `github/` · 명령어·권한 모드·모델 → `setup/` ·
디버깅 → `debugging/` · 연결·예약 실행 → `automation/` · 보안 약속 → `security/`.

**목록을 바꿀 때 함께 고칠 곳**: `assets/decks.js`(단일 목록 — 발표자 콘솔·OG 카드가 읽음) · 루트 `index.html`(카드·팔레트·구조화 데이터) ·
`sitemap.xml` · `assets/og-deck.html`의 `OG` 표 → `npm run og` · 이 표.

### 핵심만 보기 (`assets/core.js` · `assets/core.css`)

덱이 길어서 안 읽히는 문제의 처방. 슬라이드는 지우지 않고 접는다.

- 배경 이론·사례·참고 장은 `<section data-depth="extra">` — 핵심 모드에서 빠진다.
- 첫 장 다음의 **3분 요약**은 `<section class="tldr" data-depth="summary">` — 결론 3줄 + 바로 쓰는 프롬프트 + 다시 펼칠 때. 핵심 모드에서만 보인다.
- 공개 사이트·`file://` 에서는 기본 **핵심 모드**, 왼쪽 아래 토글로 전체를 펼친다(선택은 `localStorage.vibe-depth`에 기억, 보던 장으로 복귀).
- 실제 발표(`server.js`로 띄운 곳)·`?present`·인쇄(`?print-pdf`)는 **항상 전체 모드** — 발표자와 청중의 슬라이드 번호가 같아야 따라가기가 깨지지 않는다. 강제로 고르려면 `?core` / `?full`.
- 덱에 붙이는 법: `<head>`에 `<link rel="stylesheet" href="../assets/core.css">`, `reveal.js` 바로 다음(`Reveal.initialize` 앞)에 `<script src="../assets/core.js"></script>`.
- 적용 덱: prompt · ui-ux · github · debugging · context · knowledge · verification · orchestration · security · agent-skills · making-slides · automation · ai-map. (setup · intro · workshop · forChildren은 처음부터 끝까지 따라가는 덱이라 접지 않는다.)

### 첫 화면 — 빌드 장면 (루트 `index.html`)

"프롬프트 한 줄이 페이지가 되는 순간"을 실제로 보여 주는 히어로. 움직임은 한 번의 장면과 손이 닿을 때의 반응뿐이고, 다 지어지면 멈춘다.

- **빌드 장면**(세션당 첫 방문 1회): 화면 가운데 터미널에 프롬프트가 두벌식 IME 그대로(`바` → `방` → `바이`) 입력되고,
  `● Write(index.html)` 순간 터미널에서 입자 수천 개가 흘러나와 거대한 제목 "바이브 코딩"으로 조립된다.
  이어지는 `Update` 도구 호출과 같은 박자로 부제·문장·버튼이 지어진다. 아무 키·클릭·휠이면 즉시 완성 상태로 건너뛴다.
- 다시 보기: 히어로의 `↻ 다시 빌드`, 커맨드 팔레트 "빌드 장면 다시 보기", 또는 `?intro`. 해시(`#board` 등)로 들어오면 틀지 않는다.
- 평소 제목은 진짜 DOM 글자다. 커서가 닿은 자리만 입자로 풀렸다 돌아오고(렌즈), 클릭·탭하면 터졌다 모이며,
  스크롤로 히어로를 벗어나면 입자가 되어 위로 흩어진다. 입자 50개 중 하나는 `{ } < / ;` 같은 코드 글자.
- 저사양: 코어·메모리가 적으면 입자를 줄이고, 비행 중 프레임이 느리면 절반만 그린다. "애니메이션 끄기"를 고르면 완성된 정지 화면만 보인다.
- 제목·부제 글꼴은 Pretendard Variable 에서 히어로 글자만 뽑은 수 KB 서브셋(`assets/home-fonts.css`, JetBrains Mono 포함)이다.
  **히어로 문구(`data-display` 요소)를 바꿨으면 다시 생성한다** — 안 하면 빠진 글자만 시스템 글꼴로 섞여 보인다:

  ```bash
  pip install fonttools brotli
  python3 scripts/build-home-fonts.py
  ```

공개 사이트: **https://vibe-coding.euiyun.com/**

GitHub Pages 커스텀 도메인은 루트 `CNAME` 파일에 기록한다. 페이지는 도메인 루트에서 제공되므로 URL에 `/vibe-coding/` 접두사를 붙이지 않는다.

## 실행

- **정적 열람 (GitHub Pages)**: 저장소를 그대로 정적 호스팅. 질문/반응 기능 없이 슬라이드만 동작한다.
- **실제 발표 (통합 발표 플랫폼)**:

  ```bash
  npm run dev        # http://localhost:8080
  # 포트를 바꾸려면: PORT=9000 npm run dev
  ```

  발표자는 **URL 하나만 열면 된다**:

  | 역할 | 주소 | 하는 일 |
  | --- | --- | --- |
  | 발표자 | `http://localhost:8080/present/` | 세미나 선택 · 질문 보드 · 반응 집계 · 청중 링크 안내 |
  | 청중 | `http://<발표자-IP>:8080/live` | 지금 발표 중인 세미나로 자동 연결 · 시작 전이면 대기 화면 |

  발표자 콘솔에서 세미나 카드의 **`발표 시작 →`** 을 누르면 그 덱이 `?present` 모드로 열리고,
  따라가기 중인 청중 화면도 같은 덱으로 자동 이동한다. 발표 중간에 다른 세미나로 넘어가도
  **질문·투표·이모지는 하나의 세션으로 계속 이어진다** (덱마다 방이 갈리지 않는다).

  **발표자는 탭 하나만 쓴다.** 콘솔 ↔ 발표자 화면은 같은 탭에서 오간다 — 콘솔의 카드를
  누르면 그 자리에서 덱으로 넘어가고, 발표자 바의 `🎛️ 발표자 콘솔` 을 누르면 콘솔로
  돌아온다. 발표 중인 덱으로 돌아갈 때는 첫 장이 아니라 보고 있던 슬라이드로 복귀한다.
  새 탭으로 열지 않는 이유는, 발표가 끝난 덱의 `?present` 탭이 남아 있으면 거기서 방향키만
  눌러도 세션이 그 덱으로 되돌아가 청중 전체가 끌려가기 때문이다.

  청중 링크는 `/live` 하나면 되므로, 세미나를 바꿀 때마다 새 주소를 불러줄 필요가 없다.
  콘솔의 `복사` 버튼이 같은 Wi-Fi에서 접속 가능한 LAN 주소를 그대로 복사해 준다.
  발표를 시작하기 전에 들어온 청중은 대기 화면에서 그대로 기다리다가, 발표자가 첫 덱을
  열면 자동으로 넘어간다 — 시작 시각 전에 링크를 미리 뿌려도 된다.

  개별 덱을 직접 열어도 된다 — `/<폴더>/?present`(발표자) · `/<폴더>/`(청중).
  새 세미나 폴더(최상위에 `index.html`이 있는 폴더)는 서버 코드 수정 없이 자동으로 라우팅되고,
  `assets/decks.js`에 한 줄 추가하면 발표자 콘솔 목록에도 나타난다.

  `?present`는 UI 구분용일 뿐 별도의 비밀번호가 없다 — 어차피 URL에 노출되어 보호 효과가 없었기 때문에 제거했다.

  발표가 끝나면 서버(Ctrl+C)를 끄면 모든 질문/반응 기록이 사라진다 (영속 저장 없음).

### 실시간 Q&A 구성

| 파일 | 역할 |
| --- | --- |
| `server.js` | 단일 라이브 세션(현재 덱 · 슬라이드 · 질문 · 반응)과 SSE 브로드캐스트 |
| `assets/qa.js` | 모든 덱이 공유하는 Q&A 클라이언트 — `?present` 판정도 여기 한 곳에서만 한다 |
| `assets/qa.css` | 포스트잇 · 도크 · 발표자 바 스타일 |
| `assets/decks.js` | 발표자 콘솔이 읽는 세미나 목록 |
| `present/index.html` | 통합 발표자 콘솔 |

덱 쪽은 아래 두 줄만 넣으면 실시간 Q&A가 붙는다:

```html
<link rel="stylesheet" href="../assets/qa.css">
<script src="../assets/qa.js" defer></script>
```

## 내레이션 (`use-cases/`)

`use-cases/` 덱은 장을 넘길 때마다 아나운서 톤의 여성 내레이션(Gemini TTS, `Kore` 보이스)이 흐르고,
문장이 시작되는 순간 그 문장에 묶인 모션이 터진다.

- **대본의 원본은 발표자 노트다.** 각 장의 `<aside class="notes">` 안 `<p>` 하나가 한 문장(한 박자)이고,
  박자 N이 시작될 때 `data-b="N"` 요소에 `.on`, `data-x="N"` 요소에 `.gone`이 붙는다. 문장을 나누거나 합치면 `data-b` 번호도 맞춘다.
- 발음만 바꾸려면 `<p data-say="피피티에">PPT에</p>` — 자막은 원문, 읽기는 `data-say`.
- 대본을 고쳤으면 다시 생성한다. 바뀐 문장만 요청하고, 쓰이지 않는 mp3는 지운다:

  ```bash
  python3 scripts/build-narration.py use-cases --dry   # 무엇을 만들지 목록만
  python3 scripts/build-narration.py use-cases         # 생성 → use-cases/audio/*.mp3 + manifest.js
  ```

  키는 환경변수 `GEMINI_API_KEY` → 루트 `.env` → `../bookcast/.env` 순서로 찾는다(커밋되지 않음). 요청 사이 12초 간격.
- 다시 생성하지 않고 고친 문장은 소리 대신 글자 수로 추정한 길이만큼 자막만 보여 준다 — 덱이 깨지지는 않는다.
- 재생: 첫 화면에서 **▶ 내레이션과 함께 재생**(소리 + 자동 넘김) 또는 **소리 없이 보기**(발표용, 모션만 자동).
  단축키 `M` 소리 · `A` 자동 넘김 · `C` 자막 · `R` 이 장 다시 재생.

## 링크 미리보기(OG) 이미지

허브는 루트 `og-image.png`(원본 `assets/og-image.html`), 각 세미나는 `og/<폴더>.png`(1200×630)를 쓴다.
세미나 카드는 템플릿 하나(`assets/og-deck.html?id=<폴더>`)로 그리며, 트랙·이모지·설명은 `assets/decks.js`에서,
큰 제목·태그라인·터미널 문구는 템플릿 안 `OG` 표에서 가져온다. 고쳤으면 다시 찍고 해당 덱의 `og:image` `?v=`를 올린다:

```bash
npm run og                    # 전체 → og/*.png (로컬 Chrome + macOS sips)
npm run og -- intro ui-ux     # 일부만
```

## 테스트

```bash
npm test
```

## 라이선스

이 저장소의 슬라이드·문서·예제 코드·이미지는
[**CC BY-NC 4.0**](https://creativecommons.org/licenses/by-nc/4.0/deed.ko)
(저작자표시-비영리 4.0 국제) 라이선스로 배포된다. 전문은 [`LICENSE`](LICENSE) 참고.

| | |
| --- | --- |
| ✅ 공유 | 복제·배포·전시·공유 — 매체나 형식에 상관없이 자유롭게 |
| ✅ 변경 | 리믹스·수정·번안 — 사내 세미나에 맞게 고쳐 쓰는 것도 자유 |
| ⚠️ 저작자 표시 | 저작자·출처 URL·라이선스를 밝히고, 변경했다면 변경 사실을 표시 |
| 🚫 비영리 | 상업적 목적(유료 강의·유료 교육 상품·상업 출판 등)으로는 이용 불가 |

사내 스터디·부서 세미나처럼 **돈을 받지 않는 교육**에 쓰는 것은 허용된다.
영리 목적으로 쓰고 싶다면 [이슈](https://github.com/geniuskey/vibe-coding/issues)로 문의하면 된다.

출처 표기 예시:

> "바이브 코딩 세미나 슬라이드" by geniuskey (https://github.com/geniuskey/vibe-coding),
> [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) — 일부 수정함

### 제3자 구성요소

아래는 각자의 원 라이선스를 따르며 CC BY-NC 4.0의 적용을 받지 않는다.

| 경로 | 구성요소 | 라이선스 |
| --- | --- | --- |
| `vendor/reveal/` | reveal.js 5.1.0 | MIT |
| `vendor/fonts/` | Pretendard, JetBrains Mono | SIL Open Font License 1.1 |
| `assets/home-fonts.css` | 위 두 글꼴의 서브셋 (홈 전용) | SIL Open Font License 1.1 |
