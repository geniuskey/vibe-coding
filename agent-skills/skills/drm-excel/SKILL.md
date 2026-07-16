---
name: drm-excel
description: DRM이 걸린 사내 엑셀 파일(수율 대장, 관리 시트 등)을 읽거나 값을 기입한다. "수율 대장", "엑셀 정리", "엑셀에 채워줘", "시트 읽어줘" 등 기존 사내 xlsx 작업 시 사용. office-drm 규칙을 전제로 한다.
---

# DRM 엑셀 대장 읽기/기입

기존 사내 xlsx는 **xlwings로 Excel 앱을 경유**해서만 접근한다 (`office-drm` 스킬 철칙).
pandas/openpyxl로 직접 열면 DRM 암호문이라 깨진다.

## 절차

1. **백업 먼저**: `원본명_bak_MMDD.xlsx`로 사본 생성 (shutil.copy — 복사는 파일 수준이라 OK).
2. xlwings로 열기:
   ```python
   import xlwings as xw
   app = xw.App(visible=False)
   try:
       wb = app.books.open(path)          # Excel이 DRM 해독
       sht = wb.sheets["주간"]
       data = sht.range("A1").expand().value   # 대량 읽기는 한 번에
       # ... 파이썬에서 가공 ...
       sht.range("B14").value = new_row        # 기입도 블록 단위로
       wb.save()
       wb.close()
   finally:
       app.quit()                          # 잠금 해제 — 예외가 나도 반드시
   ```
3. 수정한 셀 주소와 이전→이후 값을 **로그로 출력**하고, 사용자에게 확인을 요청한다.

## win32com 대안 (xlwings가 없을 때)

```python
import win32com.client
xl = win32com.client.Dispatch("Excel.Application")
xl.Visible = False
wb = xl.Workbooks.Open(path)
val = wb.Worksheets("주간").Range("A1").CurrentRegion.Value
wb.Save(); wb.Close(); xl.Quit()
```

## 함정 노트 (선배들의 피와 눈물)

- `app.quit()`을 빼먹으면 보이지 않는 Excel 프로세스가 파일을 잠근다 → 반드시 `try/finally`.
- 셀 하나씩 루프 금지 — COM 왕복이 느려서 1,000셀에 수 분 걸린다. 블록으로.
- 날짜 셀은 datetime으로 돌아온다. 문자열 비교하지 말고 `.date()`로 비교.
- 병합 셀 블록에 값을 쓰면 좌상단만 반영된다 — 대장 양식의 병합 구역은 주소를 정확히.

## 하지 말 것

- DRM 해제, 다른 포맷으로 변환해 보호를 벗기는 시도 금지.
- 대장의 수식 셀은 값으로 덮지 않는다 (수식 보존).
