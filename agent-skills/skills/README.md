# 반도체 현업 예제 Agent Skills

`agent-skills/` 세미나(반도체 현업을 위한 Agent Skills)에서 다루는 예제 스킬 모음.
각 폴더가 스킬 하나이며, 실체는 `SKILL.md`(업무 매뉴얼) + 선택적인 `references/` 부록이 전부다.

## 설치

내 프로젝트(작업 폴더)의 `.claude/skills/` 아래로 원하는 스킬 폴더를 복사한다:

```
내프로젝트/
└─ .claude/
   └─ skills/
      ├─ office-drm/
      ├─ csv-report/
      └─ ...
```

설치 확인 프롬프트:

> 지금 사용할 수 있는 스킬 목록을 보여줘. 그리고 sample_data/ 폴더의 측정 CSV로
> csv-report 스킬을 실행해서 리포트를 만들어줘.

## 스킬 목록

| 스킬 | 하는 일 | 핵심 도구 |
| --- | --- | --- |
| `office-drm` | 사내 Office 문서(DRM) 취급 철칙 — 다른 스킬들의 공통 규칙 | xlwings · win32com |
| `csv-report` | 표준 측정 CSV 병합 → 일일 수율 리포트(HTML) | pandas (새 파일 = 자유) |
| `drm-excel` | DRM 엑셀 대장 읽기/기입 | xlwings (win32com 대안 포함) |
| `weekly-ppt` | 주간보고 PPT 복제·갱신 | win32com |
| `spec-doc` | Word 공정 사양서 개정 + 개정 이력 | win32com |
| `gds-inspect` | GDS/OASIS 레이아웃 통계·검사 | klayout (pya) |
| `rtl-helper` | Verilog 포트 요약·TB 생성·사내 룰 체크 | 텍스트 · iverilog(선택) |
| `tcad-sweep` | TCAD 입력덱 스윕 생성 + I-V 추출·요약 | 텍스트 덱 · CSV |

## 연습 데이터

`sample_data/`에 사내 데이터 없이 실습할 수 있는 가짜 데이터가 들어 있다:
측정 CSV 3개(설비 2대 × 날짜), 미니 Verilog 모듈, TCAD 스타일 I-V 로그.

## 주의

- xlwings / win32com(pywin32) 스킬은 **Windows + MS Office가 있는 PC에서만** 실제 동작한다.
- 예제의 스펙 값·경로·수치는 모두 가상의 값이다. 팀에 배포하기 전에 자기 팀 값으로 수정할 것.
- 사내 데이터는 사내 승인된 AI 환경에서만 다룰 것 (각 SKILL.md의 보안 규칙 참조).
