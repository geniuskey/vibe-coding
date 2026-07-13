# vibe-coding-202607

바이브 코딩 세미나 슬라이드 (reveal.js, 단일 `index.html`, 빌드 없음).

## 실행

- **정적 열람 (GitHub Pages)**: `index.html`을 그대로 정적 호스팅. 질문/반응 기능 없이 슬라이드만 동작한다.
- **실제 발표 (로컬 실시간 Q&A)**:

  ```bash
  npm run dev        # http://localhost:8080
  # 포트를 바꾸려면: PORT=9000 npm run dev
  ```

  URL 끝에 `?present`가 붙으면 발표자 모드(슬라이드 이동 브로드캐스트 + 질문 기록/정리),
  없으면 청중 모드(질문 입력·투표·반응·발표자 따라가기)로 열린다.

  | 슬라이드 | 발표자 | 청중 |
  | --- | --- | --- |
  | 메인 | `http://localhost:8080/?present` | `http://localhost:8080/` |
  | 워크숍 | `http://localhost:8080/workshop/?present` | `http://localhost:8080/workshop/` |
  | 컨텍스트 | `http://localhost:8080/context/?present` | `http://localhost:8080/context/` |

  같은 Wi-Fi에서는 `http://<발표자-IP>:8080/` 로 접속한다 (서버 시작 시 콘솔에 출력됨).

  각 슬라이드는 서로 다른 "방(room)"을 쓰므로 질문·투표·반응·슬라이드가 섞이지 않는다.
  `?present`는 UI 구분용일 뿐 별도의 비밀번호가 없다 — 어차피 URL에 노출되어 보호 효과가 없었기 때문에 제거했다.

  발표가 끝나면 서버(Ctrl+C)를 끄면 모든 질문/반응 기록이 사라진다 (영속 저장 없음).

## 테스트

```bash
npm test
```
