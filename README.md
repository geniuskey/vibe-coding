# vibe-coding-202607

바이브 코딩 세미나 슬라이드 (reveal.js, 단일 `index.html`, 빌드 없음).

## 실행

- **정적 열람 (GitHub Pages)**: `index.html`을 그대로 정적 호스팅. 질문/반응 기능 없이 슬라이드만 동작한다.
- **실제 발표 (로컬 실시간 Q&A)**:

  ```bash
  npm run dev        # http://localhost:8080
  # 발표자 키를 바꾸려면: PRESENT_KEY=mykey PORT=8080 npm run dev
  ```

  - **발표자**: `http://localhost:8080/?present=change-me` (화살표/Space로 슬라이드 이동, 우측 상단에서 질문 기록 확인)
  - **청중**: `http://localhost:8080/` 또는 같은 Wi-Fi의 `http://<발표자-IP>:8080/` (서버 시작 시 콘솔에 출력됨)

  같은 서버로 워크숍 슬라이드(`workshop/index.html`)도 실시간 Q&A와 함께 발표할 수 있다.

  - **발표자**: `http://localhost:8080/workshop/?present=change-me`
  - **청중**: `http://localhost:8080/workshop/`

  메인 발표(`/`)와 워크숍(`/workshop/`)은 서로 다른 "방(room)"을 쓰므로 질문·투표·반응·슬라이드가 섞이지 않는다.

  발표가 끝나면 서버(Ctrl+C)를 끄면 모든 질문/반응 기록이 사라진다 (영속 저장 없음).

## 테스트

```bash
npm test
```
