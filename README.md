# vibe-coding

바이브 코딩 세미나 슬라이드 모음 (reveal.js, 폴더별 단일 `index.html`, 빌드 없음).

루트 `index.html`은 전체 세미나를 안내하는 대표(허브) 페이지이고, 각 세미나는 주제별 폴더에 있다:

| 폴더 | 내용 |
| --- | --- |
| `setup/` | 0교시 — 설치와 첫 실행 (환경 세팅 · 로그인 · 첫 대화 · 트러블슈팅 TOP 5) |
| `intro/` | 바이브 코딩이란 무엇인가? (원본 입문 세미나) |
| `prompt/` | AI에게 일 시키는 법 — 프롬프트 엔지니어링 (3요소 프레임 · 패턴 8가지 · 다듬기 루프) |
| `context/` | 컨텍스트 — AI 에이전트의 작업 책상 |
| `knowledge/` | LLM에게 지식을 가르치는 법 (LLM 위키 · RAG · 지식 그래프 · 온톨로지) |
| `verification/` | AI가 쓴 코드를 믿는 법 — 검증과 테스트 (검증의 사다리 · TDD · AI 리뷰 · 평가) |
| `orchestration/` | 서브에이전트와 오케스트레이션 (컨텍스트 격리 · 병렬 fan-out · 파이프라인 · CI 속 에이전트) |
| `security/` | 사내 환경에서의 AI — 보안과 거버넌스 (데이터 경로 · 프롬프트 인젝션 · 권한 설계) |
| `github/` | 바이브 코딩을 위한 최소한의 Git & GitHub |
| `workshop/` | 바이브 코딩 실습 워크숍 (8시간 핸즈온 — 강사용 런북은 `workshop/README.md`) |
| `agent-skills/` | 반도체 현업을 위한 Agent Skills (DRM 엑셀·PPT·GDS·RTL·TCAD 실무 예제 + 예제 스킬 모음 `agent-skills/skills/`) |
| `making-slides/` | 바이브 코딩으로 슬라이드 자료 만들기 (레퍼런스 앵커링 · 피드백 루프 · CLAUDE.md · Agent Skill — `slide-deck` 예제 스킬 동봉) |
| `forChildren/` | 나만의 게임 만들기 (어린이 × 부모) |

추천 학습 경로: `setup/` → `intro/` → `prompt/` → `github/` → `workshop/` → (심화) `context/` · `knowledge/` · `verification/` · `orchestration/` · `security/` · `agent-skills/` · `making-slides/`

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

## 테스트

```bash
npm test
```
