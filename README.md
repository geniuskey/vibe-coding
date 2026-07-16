# vibe-coding

바이브 코딩 세미나 슬라이드 모음 (reveal.js, 폴더별 단일 `index.html`, 빌드 없음).

루트 `index.html`은 전체 세미나를 안내하는 대표(허브) 페이지이고, 각 세미나는 주제별 폴더에 있다:

| 폴더 | 내용 |
| --- | --- |
| `intro/` | 바이브 코딩이란 무엇인가? (원본 입문 세미나) |
| `context/` | 컨텍스트 — AI 에이전트의 작업 책상 |
| `knowledge/` | LLM에게 지식을 가르치는 법 (LLM 위키 · RAG · 지식 그래프 · 온톨로지) |
| `github/` | 바이브 코딩을 위한 최소한의 Git & GitHub |
| `workshop/` | 바이브 코딩 실습 워크숍 (8시간 핸즈온) |
| `agent-skills/` | 반도체 현업을 위한 Agent Skills (DRM 엑셀·PPT·GDS·RTL·TCAD 실무 예제 + 예제 스킬 모음 `agent-skills/skills/`) |
| `forChildren/` | 나만의 게임 만들기 (어린이 × 부모) |

## 실행

- **정적 열람 (GitHub Pages)**: 저장소를 그대로 정적 호스팅. 질문/반응 기능 없이 슬라이드만 동작한다.
- **실제 발표 (로컬 실시간 Q&A)**:

  ```bash
  npm run dev        # http://localhost:8080
  # 포트를 바꾸려면: PORT=9000 npm run dev
  ```

  URL 끝에 `?present`가 붙으면 발표자 모드(슬라이드 이동 브로드캐스트 + 질문 기록/정리),
  없으면 청중 모드(질문 입력·투표·반응·발표자 따라가기)로 열린다.

  | 슬라이드 | 발표자 | 청중 |
  | --- | --- | --- |
  | 입문(원본) | `http://localhost:8080/intro/?present` | `http://localhost:8080/intro/` |
  | 워크숍 | `http://localhost:8080/workshop/?present` | `http://localhost:8080/workshop/` |
  | 컨텍스트 | `http://localhost:8080/context/?present` | `http://localhost:8080/context/` |
  | 깃허브 | `http://localhost:8080/github/?present` | `http://localhost:8080/github/` |
  | 지식 정리 | `http://localhost:8080/knowledge/?present` | `http://localhost:8080/knowledge/` |
  | Agent Skills | `http://localhost:8080/agent-skills/?present` | `http://localhost:8080/agent-skills/` |

  같은 Wi-Fi에서는 `http://<발표자-IP>:8080/` 로 접속한다 (서버 시작 시 콘솔에 출력됨).

  각 슬라이드는 서로 다른 "방(room)"을 쓰므로 질문·투표·반응·슬라이드가 섞이지 않는다.
  `?present`는 UI 구분용일 뿐 별도의 비밀번호가 없다 — 어차피 URL에 노출되어 보호 효과가 없었기 때문에 제거했다.

  발표가 끝나면 서버(Ctrl+C)를 끄면 모든 질문/반응 기록이 사라진다 (영속 저장 없음).

## 테스트

```bash
npm test
```
