# 바이브 코딩을 위한 최소한의 Git & GitHub

비개발자 임직원을 위한 Git & GitHub 세미나 슬라이드 (reveal.js, 단일 `index.html`).
**명령어 암기 0개** — 모든 사용법을 Claude Code, OpenCode 같은 에이전트 플랫폼의
**프롬프트(말로 시키기)** 로 배우고, 수동 명령어는 참고용으로만 작게 소개합니다.

## 무엇을 다루나

| 챕터 | 내용 | 형식 |
| --- | --- | --- |
| CH 1 · Git, 딱 필요한 만큼 | 왜 버전 관리인가(파일명의 비극), 바이브 코딩의 세이브 포인트, 개념 6개(저장소·커밋·브랜치·푸시·풀·PR), Git vs GitHub | 이론 |
| CH 2 · 사내 GitHub | **github.com vs 사내 GitHub Enterprise의 차이**, 어디에 올릴지 3초 판단법, 실습 0~5 (설정 → 첫 커밋 → 푸시 → 일상 루프 → 되돌리기 → 브랜치/PR), 상황별 처방전 | 이론 + 실습 |
| CH 3 · 내 웹앱 배포 | GitHub Pages 개념, **branch 방식 배포만** (사내 Actions 사용이 까다로운 환경 전제), 실습 6(정적 앱)·실습 7(빌드가 필요한 SPA), 문제 해결 체크리스트 | 이론 + 실습 |
| 부록 | 보안 수칙 4가지, 프롬프트 치트시트 | — |

총 24장, 약 90분 (이론 30% + 실습 70%) 구성입니다.

## ⚙️ 우리 회사에 맞게 바꾸기 (재사용 가이드)

슬라이드에 나오는 사내 GitHub 주소·회사명은 하드코딩이 아니라 **변수**입니다.
`index.html` 상단(`<body>` 바로 아래)의 설정 블록만 수정하면 모든 슬라이드에 반영됩니다:

```js
window.SEMINAR_CONFIG = {
  COMPANY_NAME: '우리 회사',            // 회사 이름 표기
  GHE_DOMAIN:   'github.company.net',  // 사내 GitHub Enterprise 도메인
  PAGES_HOST:   'pages.company.net',   // 사내 GitHub Pages 호스트
};
```

파일을 고치지 않고 **URL 파라미터로 즉석에서 덮어쓸 수도** 있습니다 (발표 당일 유용):

```
index.html?ghe=github.acme.net&pages=pages.acme.net&company=ACME
```

발표 전 체크리스트:

- [ ] `SEMINAR_CONFIG`를 회사 값으로 수정 (또는 URL 파라미터 준비)
- [ ] 사내 GitHub의 인증 방식(PAT / SSH / 자격증명 관리자) 확인 — 실습 2에서 시연
- [ ] 사내 GHE에서 **Pages 기능이 켜져 있는지**, Pages URL 형태 확인 — 실습 6~7 전제
- [ ] 참석자 준비물 공지: 에이전트 플랫폼 설치 + 사내 GitHub 로그인 + 실습용 폴더

## 실행

- **정적 열람**: `index.html`을 브라우저로 열거나 정적 호스팅(GitHub Pages 등)하면 슬라이드만 동작합니다.
- **실제 발표 (실시간 Q&A 포함)**: 저장소 루트에서

  ```bash
  npm run dev
  # 발표자: http://localhost:8080/github/?present
  # 청중:   http://localhost:8080/github/
  ```

  이 덱은 `github` 방(room)을 사용하므로 다른 덱(메인·워크숍·컨텍스트)과 질문이 섞이지 않습니다.

## 프롬프트 치트시트 (배포용)

실습에서 쓰는 프롬프트 모음입니다. 아래에서 `github.company.net`은 사내 GitHub 도메인으로 바꿔 읽으세요.

| 상황 | 에이전트에게 이렇게 말하세요 |
| --- | --- |
| 시작 | 이 폴더를 git 저장소로 만들고 "첫 버전"으로 커밋해줘 |
| 연결 + 업로드 | 이 주소를 원격으로 연결하고 푸시해줘: `https://github.company.net/내아이디/저장소` |
| 일상 저장 | 지금까지 변경사항을 보기 좋게 커밋하고 푸시해줘 |
| 상태 확인 | 지금 커밋 안 된 변경이 뭐가 있는지 요약해줘 |
| 되돌리기 | 마지막 커밋 이후의 변경을 전부 버리고 마지막 커밋 상태로 되돌려줘 |
| 과거로 이동 | 최근 커밋 목록 보여줘. 어제 오후에 잘 되던 버전으로 돌아가고 싶어 |
| 받아오기 | 원격 저장소의 최신 내용을 받아와줘 (pull) |
| 복제 | 이 저장소를 클론해줘: `https://github.company.net/팀/저장소` |
| 브랜치 | 새 기능은 feature/○○ 브랜치를 만들어서 거기서 작업해줘 |
| PR | 작업 끝났어. 푸시하고 main으로 Pull Request 만들어줘. 설명도 채워줘 |
| 충돌 | 충돌 났어. 안전하게 해결해줘. 판단이 애매한 부분은 나한테 물어봐 |
| 배포(정적) | 이 앱을 GitHub Pages(branch 방식)에 올릴 거야. 경로 문제 점검해서 고치고 커밋·푸시해줘 |
| 배포(SPA) | base 경로를 `/저장소이름/`으로 설정하고, 빌드 결과물(dist)을 gh-pages 브랜치로 푸시해줘 |
| 배포 갱신 | 수정한 내용으로 다시 배포해줘 |
| SPA 404 | Pages에서 새로고침하면 404가 떠. 해시 라우팅으로 바꾸거나 404.html 우회를 적용해줘 |
| 보안 | 커밋하기 전에 시크릿(키·비밀번호)이 들어있는지 검사해줘 |
| 배움 | 방금 네가 한 git 작업을 초보자에게 설명하듯 알려줘 |

## GitHub Pages — branch 방식 배포 요약

사내 GitHub Actions 사용이 까다로운 환경을 전제로, **Deploy from a branch** 방식만 사용합니다.

**정적 앱 (index.html이 저장소 루트에 있는 경우)**

1. 저장소 → `Settings` → `Pages`
2. Source: **Deploy from a branch**
3. Branch: `main` + `/(root)` → **Save**
4. 1~2분 뒤 표시되는 URL 접속

**SPA (React/Vite 등 빌드가 필요한 앱)**

1. base 경로를 `/저장소이름/`으로 설정 (에이전트에게 맡기세요)
2. 빌드 결과물(`dist`)을 `gh-pages` 브랜치로 푸시
   (수동: `npm run build && git subtree push --prefix dist origin gh-pages`)
3. Pages 설정에서 Branch를 `gh-pages` + `/(root)`로 변경

**URL 규칙**

- github.com: `https://아이디.github.io/저장소/`
- 사내 GHE: `https://pages.<사내도메인>/아이디/저장소/`
  (회사 설정에 따라 `https://<사내도메인>/pages/아이디/저장소/` 형태일 수도 있습니다)

## 보안 수칙 (요약)

1. 회사 코드는 **사내 GitHub에만** — github.com 업로드는 정보 유출입니다
2. 비밀번호·API 키는 커밋 금지 — `.env` + `.gitignore`
3. 이미 유출됐다면 기록 삭제보다 **키 즉시 재발급**이 먼저
4. Pages는 "게시"입니다 — 사내 Pages도 전 임직원이 볼 수 있을 수 있으니 올리기 전에 내용 점검
