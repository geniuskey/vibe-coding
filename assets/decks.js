/*
 * 세미나 덱 목록 — 발표자 콘솔(/present/)과 OG 카드(assets/og-deck.html)가 읽는 단일 목록.
 * 루트 index.html(허브)의 구성과 같은 순서·같은 문구를 유지한다:
 *   00 맛보기 → 핵심 경로(setup → intro → workshop) → 처방전 01·02·03 → 번외.
 * 새 세미나 폴더를 추가하면 여기에도 한 줄 추가하면 된다 (서버 라우팅은 자동).
 */
window.SEMINAR_DECKS = [
  { track: '00 맛보기', id: 'use-cases', emoji: '💡', title: '이것도 바이브 코딩으로 됩니다', desc: '5분 맛보기 — 상황별 활용 가이드, 내레이션 캠페인 덱' },

  { track: '핵심 경로', id: 'setup', emoji: '🧰', title: '0교시 — 설치와 기본 조작', desc: '설치 · 로그인 · 첫 대화 · 기본 조작 · 트러블슈팅 TOP 5' },
  { track: '핵심 경로', id: 'intro', emoji: '🚀', title: '바이브 코딩이란 무엇인가?', desc: '원본 입문 세미나 — 시리즈의 출발점' },
  { track: '핵심 경로', id: 'workshop', emoji: '🛠️', title: '바이브 코딩 실습 워크숍', desc: '90분·3시간·8시간 코스 선택형 핸즈온 — 강사 런북은 workshop/README.md' },

  { track: '01 기본기', id: 'prompt', emoji: '🗣️', title: 'AI에게 일 시키는 법 — 프롬프트 엔지니어링', desc: '3요소 프레임 · 패턴 8가지 · 다듬기 루프' },
  { track: '01 기본기', id: 'ui-ux', emoji: '🎨', title: '바이브 코더를 위한 UI/UX 용어 사전', desc: '레이아웃 · 사이드바 · 엘리먼트 도감 · 테마' },
  { track: '01 기본기', id: 'github', emoji: '🌿', title: '최소한의 Git & GitHub', desc: '커밋·되돌리기 · GitHub Pages 배포 정본' },
  { track: '01 기본기', id: 'debugging', emoji: '🐛', title: '고칠수록 꼬일 때 — AI와 함께 디버깅하기', desc: '재현 · 가설 · 한 번에 하나 · 사내 단골 에러 처방' },

  { track: '02 더 깊이', id: 'context', emoji: '🧠', title: '컨텍스트 — AI 에이전트의 작업 책상', desc: '컨텍스트 창의 원리와 컨텍스트 엔지니어링' },
  { track: '02 더 깊이', id: 'knowledge', emoji: '📚', title: 'LLM에게 지식을 가르치는 법', desc: 'LLM 위키 · RAG · 지식 그래프 · 온톨로지' },
  { track: '02 더 깊이', id: 'verification', emoji: '⚖️', title: 'AI가 쓴 코드를 믿는 법 — 검증과 테스트', desc: '검증의 사다리 · 분석 숫자 믿는 법 · TDD · AI 리뷰' },
  { track: '02 더 깊이', id: 'orchestration', emoji: '🤖', title: '서브에이전트와 오케스트레이션', desc: '위임→격리→보고 · 패턴 4가지 · 팀이냐 혼자냐' },
  { track: '02 더 깊이', id: 'security', emoji: '🔐', title: '사내 환경에서의 AI — 보안과 거버넌스', desc: '보안 약속 정본 · 데이터 경로 · 인젝션 · 권한 설계' },

  { track: '03 직접 해보기', id: 'agent-skills', emoji: '🧬', title: '내 노하우를 AI에게 물려주는 법 — CLAUDE.md · Agent Skills', desc: '반복 설명을 파일로 · 반도체 실무 예제 7종' },
  { track: '03 직접 해보기', id: 'making-slides', emoji: '🎬', title: '바이브 코딩으로 슬라이드 자료 만들기', desc: '레퍼런스 앵커링 → 좌표+증상 피드백 → 스킬' },
  { track: '03 직접 해보기', id: 'automation', emoji: '🔌', title: '내 도구가 혼자 돌게 — 연결 · 예약 실행 · 팀 공유', desc: '커넥터(MCP) · 예약 실행 · 팀이 같이 쓰는 앱' },

  { track: '번외', id: 'forChildren', emoji: '🎮', title: '나만의 게임 만들기', desc: '어린이 × 부모 — AI와 함께 게임 만들기' },
  { track: '번외', id: 'herdr', emoji: '🐑', title: 'herdr — 에이전트를 무리로', desc: 'space → tab 정리 · 답변 대기 알림 · 에이전트 여럿을 한 화면에서' },
  { track: '번외', id: 'ai-map', emoji: '🗺️', title: 'AI 업계 지도 — 2026.11', desc: '각 진영의 전략 — 3개월마다 바뀝니다' },
];
