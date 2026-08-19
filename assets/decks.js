/*
 * 세미나 덱 목록 — 발표자 콘솔(/present/)이 읽는 단일 목록.
 * 루트 index.html의 카드와 같은 순서·같은 문구를 유지한다.
 * 새 세미나 폴더를 추가하면 여기에도 한 줄 추가하면 된다 (서버 라우팅은 자동).
 */
window.SEMINAR_DECKS = [
  { track: '01 시작하기', id: 'setup',         emoji: '🧰', title: '0교시 — 설치와 첫 실행',                  desc: '환경 세팅 · 로그인 · 첫 대화 · 트러블슈팅 TOP 5' },
  { track: '01 시작하기', id: 'intro',         emoji: '🚀', title: '바이브 코딩이란 무엇인가?',                desc: '원본 입문 세미나 — 시리즈의 출발점' },
  { track: '01 시작하기', id: 'prompt',        emoji: '🗣️', title: 'AI에게 일 시키는 법 — 프롬프트 엔지니어링', desc: '3요소 프레임 · 패턴 8가지 · 다듬기 루프' },
  { track: '01 시작하기', id: 'github',        emoji: '🌿', title: '최소한의 Git & GitHub',                    desc: '바이브 코딩에 꼭 필요한 만큼의 버전 관리' },

  { track: '02 더 깊이',  id: 'context',       emoji: '🧠', title: '컨텍스트 — AI 에이전트의 작업 책상',        desc: '컨텍스트 창의 원리와 컨텍스트 엔지니어링' },
  { track: '02 더 깊이',  id: 'knowledge',     emoji: '📚', title: 'LLM에게 지식을 가르치는 법',                desc: 'LLM 위키 · RAG · 지식 그래프 · 온톨로지' },
  { track: '02 더 깊이',  id: 'verification',  emoji: '⚖️', title: 'AI가 쓴 코드를 믿는 법 — 검증과 테스트',     desc: '검증의 사다리 · TDD · AI 리뷰 · 평가' },
  { track: '02 더 깊이',  id: 'orchestration', emoji: '🤖', title: '서브에이전트와 오케스트레이션',              desc: '컨텍스트 격리 · 병렬 fan-out · 파이프라인' },
  { track: '02 더 깊이',  id: 'security',      emoji: '🔐', title: '사내 환경에서의 AI — 보안과 거버넌스',       desc: '데이터 경로 · 프롬프트 인젝션 · 권한 설계' },

  { track: '03 직접 해보기', id: 'workshop',      emoji: '🛠️', title: '바이브 코딩 실습 워크숍',             desc: '8시간 핸즈온 — 강사 런북은 workshop/README.md' },
  { track: '03 직접 해보기', id: 'agent-skills',  emoji: '🧬', title: '반도체 현업을 위한 Agent Skills',     desc: 'DRM 엑셀 · 주간보고 PPT · GDS · RTL · TCAD' },
  { track: '03 직접 해보기', id: 'making-slides', emoji: '🎬', title: '바이브 코딩으로 슬라이드 자료 만들기', desc: '레퍼런스 앵커링 → 피드백 루프 → Agent Skill' },
  { track: '03 직접 해보기', id: 'forChildren',   emoji: '🎮', title: '나만의 게임 만들기',                   desc: '어린이 × 부모 — AI와 함께 게임 만들기' },
];
