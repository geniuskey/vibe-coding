---
name: spec-doc
description: Word 공정 사양서(.docx)의 파라미터를 개정하고 개정 이력을 남긴다. "사양서 업데이트", "스펙 문서 반영", "사양서 개정" 요청 시 사용. 기존 사내 docx는 win32com만 사용 (office-drm 규칙).
---

# 공정 사양서 개정

문서 관리 규정(개정 이력, 검토 표시, 승인 후 저장)을 절차 안에 내장한다.
기존 사내 docx는 win32com으로만 연다.

## 절차

1. 원본 복사 → `..._revN+1_draft.docx`로 작업 (원본 보존, rev 번호는 파일명/이력표에서 추론).
2. win32com으로 열기:
   ```python
   import win32com.client
   word = win32com.client.Dispatch("Word.Application")
   word.Visible = False
   doc = word.Documents.Open(draft_path)
   ```
3. 변경 파라미터는 **문서 전체 찾기/바꾸기가 아니라 해당 표의 좌표로** 교체한다
   (같은 숫자가 다른 문맥에 또 있을 수 있음 — 오치환 방지):
   ```python
   tbl = doc.Tables(2)                      # "공정 조건" 표
   tbl.Cell(4, 3).Range.Text = "455 Å"
   ```
4. 바뀐 문장/셀은 **강조 표시**를 남긴다 (검토자용):
   `tbl.Cell(4,3).Range.HighlightColorIndex = 7  # 노랑`
5. '개정 이력' 표에 행 추가: 날짜 / 개정 항목 / 사유 / 작성자.
6. **저장 전 멈춘다**: 바뀐 곳 목록(표·셀·이전→이후 값)을 채팅으로 보고하고,
   사용자가 승인하면 그때 `doc.Save()` → `doc.Close(); word.Quit()`.

## 검증

- 교체한 셀 수 = 요청된 변경 항목 수인지 확인.
- 개정 이력 표의 마지막 rev 번호가 연속인지 확인 (건너뛰면 보고).

## 하지 말 것

- 사용자 승인 없이 저장하지 않는다 (절차 6이 게이트다).
- 본문 서술 문장의 기술적 의미를 바꾸는 문장 재작성은 하지 않는다 — 값 교체와 이력 기록까지만.
