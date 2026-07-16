---
name: weekly-ppt
description: 주간보고 PPT를 지난주 파일 기반으로 복제·갱신한다. "주간보고", "위클리 장표", "주간 PPT" 요청 시 사용. 기존 사내 pptx는 win32com만 사용 (office-drm 규칙).
---

# 주간보고 PPT 자동 갱신

디자인을 코드로 다시 만들지 않는다 — **지난주 파일을 복사해 값만 교체**한다.
팀 포맷이 100% 보존되고, 기존 사내 pptx는 win32com으로만 연다.

## 절차

1. 지난주 파일을 이번 주 파일명으로 복사: `주간보고_W29.pptx → 주간보고_W30.pptx` (원본 불변).
2. win32com으로 열기:
   ```python
   import win32com.client
   ppt = win32com.client.Dispatch("PowerPoint.Application")
   pres = ppt.Presentations.Open(new_path, WithWindow=False)
   ```
3. **슬라이드 2 (표지/헤더)**: 제목 텍스트의 주차·날짜 갱신 (`W29 (7/7~7/11)` → `W30 (…)`)
   ```python
   for shape in pres.Slides(2).Shapes:
       if shape.HasTextFrame and "W" in shape.TextFrame.TextRange.Text: ...
   ```
4. **슬라이드 3 (집계 표)**: 최신 일일 리포트(csv-report 산출물)의 주간 집계로 셀 값 교체.
   `shape.Table.Cell(r, c).Shape.TextFrame.TextRange.Text = value`
5. **슬라이드 4 (트렌드 차트)**: 차트 내장 엑셀도 **COM 경유**로 갱신 —
   ```python
   chart = pres.Slides(4).Shapes("수율 트렌드").Chart
   wb = chart.ChartData.Workbook            # 내장 미니 엑셀 (직접 파싱 금지)
   wb.Worksheets(1).Range("B10").Value = 94.1
   chart.Refresh()
   ```
6. 저장 후 종료: `pres.Save(); pres.Close(); ppt.Quit()` — Quit 필수.

## 검증 (필수)

- 갱신한 표의 수율 합계·랏 수가 소스 CSV 집계와 일치하는지 검산 후 결과를 채팅으로 보고.
- 텍스트를 찾지 못한 슬라이드/도형이 있으면 임의로 넘어가지 말고 목록으로 보고.

## 함정 노트

- PPT 차트 안에는 미니 엑셀이 숨어 있다 — `ChartData.Workbook`으로만 접근.
- 도형은 이름(`Shapes("수율 트렌드")`)으로 찾는 게 인덱스보다 안전. 이름이 없으면 먼저 이름을 붙여 두라고 사용자에게 제안.
- 특이사항·코멘트 칸은 채우지 않고 비워 둔다 — 그건 엔지니어의 몫.
