# 실시간 질문 포스트잇 (Live Q&A) 설계

## 목표

`index.html`(reveal.js 단일 파일 슬라이드)에 실시간 질문/반응 기능을 추가한다.

- **GitHub Pages**(정적 호스팅)에서는 지금과 동일하게 순수 슬라이드로만 동작한다. 백엔드가 없으므로 Q&A 기능은 완전히 비활성화되며, 기존 동작에는 어떤 변경도 없다.
- **실제 발표 시**에는 발표자가 자신의 로컬에서 `npm run dev`로 임시 웹 서버를 띄우고, 같은 `index.html`을 그 서버로 열면 질문 제출·투표·반응·슬라이드 동기화가 실시간으로 동작한다. 발표가 끝나면 서버를 끄면 그만이다(영속 저장 없음).

같은 `index.html` 파일 하나가 두 모드를 모두 커버한다. 별도 빌드 단계나 분기 파일은 만들지 않는다.

## 비목표 (Out of scope)

- 질문 모더레이션(사전 승인) — 발표자의 "전체 삭제" 버튼으로 충분하다.
- 영속 저장(DB, 파일 저장) — 인메모리로 충분하다. 발표 종료 = 상태 소멸.
- GitHub Pages에서의 실시간 동작(클라우드 백엔드) — 브레인스토밍에서 로컬 전용으로 확정.
- QR 코드 생성 — 콘솔에 출력되는 LAN URL을 발표자가 직접 공유한다.
- 슬라이드 세로(vertical) 스택 동기화 — 현재 덱은 52개 섹션이 모두 수평(flat)이라 `indexh`만 동기화하면 된다 (확인 완료, `<section>` 중첩 없음).

## 아키텍처

```
                 ┌───────────────────────────┐
 GitHub Pages ──▶│  index.html (정적)         │  /qa/health 실패 → Q&A 레이어 비활성
                 └───────────────────────────┘

                 ┌───────────────────────────┐      ┌─────────────────────┐
 npm run dev ───▶│  server.js (Node http)     │◀────▶│ index.html (SSE 연결)│
                 │  - 정적 서빙 (/)            │      │  발표자 or 청중 모드   │
                 │  - /qa/* REST + SSE        │      └─────────────────────┘
                 │  - 인메모리 state           │
                 └───────────────────────────┘
```

## 서버 (`server.js`)

Node 내장 `http` 모듈만 사용, 의존성 0. 참고 프로젝트(`vibe-coding-live-slides`)와 동일한 zero-dependency 방식을 따른다.

### 환경변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `PORT` | `8080` | 서버 포트 |
| `PRESENT_KEY` | `change-me` | 발표자 인증 키 |

### 인메모리 상태

```js
const state = {
  slide: 0,                            // 현재 indexh (발표자가 갱신)
  questions: [],                       // { id, text, name, ts, votes }
  reactions: { up: 0, confused: 0 },   // 누적 카운트
};
let nextQuestionId = 1;
```

### 라우트

| Method | 경로 | 인증 | 설명 |
|---|---|---|---|
| GET | `/` | - | `index.html` 서빙 |
| GET | `/qa/health` | - | `{ ok: true }` — 클라이언트의 백엔드 감지용 |
| GET | `/qa/events` | - | SSE 스트림. 연결 즉시 `event: snapshot` 으로 전체 `state` 전송 |
| POST | `/qa/questions` | - | body `{ text, name }` → 질문 등록, `event: question` 브로드캐스트 |
| POST | `/qa/questions/vote` | - | body `{ id }` → 투표 수 +1, `event: vote` 브로드캐스트 |
| POST | `/qa/react` | - | body `{ kind: 'up'|'confused' }` → 카운트 +1, `event: react` 브로드캐스트 |
| POST | `/qa/slide` | 발표자 키 | body `{ h }` → `state.slide` 갱신, `event: slide` 브로드캐스트 |
| POST | `/qa/clear` | 발표자 키 | 질문 전체 삭제, `event: clear` 브로드캐스트 |

발표자 인증: `?key=<PRESENT_KEY>` 쿼리 또는 `x-present-key` 헤더 중 하나가 일치하면 통과, 아니면 403.

### 입력 검증 (참고 프로젝트와 동일 수준)

- `text`: trim 후 최대 280자, 빈 문자열이면 400.
- `name`: trim 후 최대 24자, 없으면 `'익명'`.
- 요청 바디 1MB 초과 시 연결 종료(flood guard).
- `kind`는 `'confused'`가 아니면 모두 `'up'`으로 취급.

### 기동 로그

서버 시작 시 다음을 콘솔에 출력한다:

```
Live Q&A running:
  발표자: http://localhost:8080/?present=change-me
  청중:   http://localhost:8080/          (같은 Wi-Fi에서는 http://<LAN-IP>:8080/)
```

LAN IP는 `os.networkInterfaces()`로 첫 번째 non-internal IPv4 주소를 찾아 표시한다.

## 클라이언트 (`index.html`에 추가되는 블록)

`</body>` 직전에 하나의 `<style>` + `<script>` 블록을 추가한다. 기존 슬라이드 마크업/스타일/스크립트는 건드리지 않는다.

### 백엔드 감지

```js
fetch('/qa/health', { signal: AbortSignal.timeout(800) })
  .then(r => r.ok && r.json())
  .then(d => { if (d && d.ok) initLiveQa(); })
  .catch(() => {}); // GH Pages, file://, 서버 미기동 등 → 아무 것도 하지 않음
```

`initLiveQa()`가 호출되지 않으면 Q&A 관련 DOM 요소는 아예 생성되지 않는다 — GH Pages 배포본과 100% 동일하게 동작함을 보장.

### 모드 판별

`?present=<key>` 쿼리 파라미터 존재 여부로 발표자/청중을 가른다.

```js
const params = new URLSearchParams(location.search);
const PRESENT_KEY = params.get('present');
const IS_PRESENTER = !!PRESENT_KEY;
```

### 슬라이드 동기화

- 발표자: `Reveal.on('slidechanged', e => postSlide(e.indexh))`.
- 청중: SSE `slide` 이벤트 수신 → `following`이 true면 `Reveal.slide(h)` 호출.
- 청중 UI에 "🔗 발표자 따라가기 ON/OFF" 토글 버튼 제공, 기본 ON. 청중이 키보드/스와이프로 직접 슬라이드를 넘기면(`Reveal.on('slidechanged', ...)`로 감지) 자동으로 `following = false`로 전환한다 — 그래야 발표자의 후속 `slide` 이벤트가 청중을 방금 넘긴 화면에서 도로 스냅해가지 않는다. 토글을 다시 켜면 즉시 발표자의 현재 슬라이드로 스냅한다.

### 질문 포스트잇 (`.qa-note`)

- 질문 등록/수신 시 화면 임의 위치에 포스트잇 카드가 나타나 살짝 회전된 채 표시, 14초 후 페이드아웃.
- 색상은 기존 테마 변수(`--accent`, `--accent-2`, `--accent-3`, `--accent-4`)를 질문 id 기준으로 순환 배정.
- 카드에는 닉네임, 질문 텍스트, 👍 투표 버튼(카운트 포함) 표시. 클릭 시 `/qa/questions/vote` 호출.
- 발표자 화면에는 추가로 토글 가능한 "질문 기록" 패널: 전체 질문을 투표순으로 정렬해 표시, "전체 삭제" 버튼(확인 다이얼로그 후 `/qa/clear` 호출).

### 반응 (👍/🤔)

- 청중 화면 하단 독(dock)에 두 버튼. 클릭 시 `/qa/react` 호출.
- 모든 화면에 하단에서 위로 떠오르는 이모지 애니메이션 + 상단 누적 카운터 배지.

### 닉네임

- 청중 최초 접속 시 닉네임 입력 모달(1회), `localStorage['qa_nickname']`에 저장. 스킵하면 `'익명'`.

### SSE 재연결

- `EventSource`는 브라우저가 자동 재연결하므로 별도 로직 불필요. `onopen`/`onerror`로 작은 연결 상태 표시(점) 정도만 둔다.

## 파일 변경 목록

| 파일 | 변경 |
|---|---|
| `server.js` | 신규 |
| `package.json` | 신규 — `scripts.dev = "node server.js"`, `scripts.start` 동일 별칭, 의존성 없음 |
| `index.html` | `</body>` 직전에 Q&A 블록 추가, `Reveal.on('slidechanged', ...)` 훅 1곳 추가 |
| `README.md` | "로컬 발표 모드" 실행법 섹션 추가 |
| `.gitignore` | 필요 시 (현재 없음 — Node 프로젝트가 되므로 `node_modules/` 라인 추가. 단 의존성이 없어 실제로는 생성되지 않지만 향후 대비로 추가) |

## 테스트 계획

1. `node server.js` 기동 후 브라우저 탭 2개: `http://localhost:8080/?present=change-me`(발표자), `http://localhost:8080/`(청중).
2. 청중 탭에서 질문 제출 → 두 탭 모두에 포스트잇 표시 확인, 발표자 탭 "질문 기록" 패널에 반영 확인.
3. 청중 탭에서 👍 반응 클릭 → 카운터 증가, 이모지 애니메이션 확인.
4. 발표자 탭에서 화살표로 슬라이드 이동 → 청중 탭이 따라가기 ON 상태에서 자동 이동하는지 확인.
5. 청중 탭에서 직접 슬라이드 이동 → 따라가기 자동 OFF, 다시 토글 클릭 시 발표자 슬라이드로 스냅 확인.
6. `index.html`을 서버 없이 파일로 직접 열기(`file://`) → Q&A 관련 UI가 전혀 나타나지 않는지 확인 (GH Pages 동작과 동치성 검증).
7. 발표자 키 없이 `/qa/slide` POST 호출 시 403 확인.

## 오류 처리 원칙

- 클라이언트: 백엔드 감지 실패는 예외적 상황이 아니라 "정상적인 정적 모드"로 취급 — 에러 로그를 남기지 않는다.
- 서버: 잘못된 JSON 바디는 빈 객체로 처리 후 각 라우트의 필수 필드 검증에서 400 처리(참고 프로젝트와 동일 패턴).
