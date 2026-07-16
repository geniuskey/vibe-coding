---
name: office-drm
description: 사내 엑셀(.xlsx)/파워포인트(.pptx)/워드(.docx) 파일을 읽거나 수정할 때의 필수 규칙. DRM(문서 암호화) 환경에서 Office 문서 작업을 하기 전 반드시 이 규칙을 따른다. "엑셀 열어줘", "PPT 수정", "워드 문서" 등 Office 파일 작업 전부에 적용.
---

# 사내 Office 문서(DRM) 취급 철칙

사내 Office 문서는 DRM으로 암호화되어 있다. 파일을 바이트로 직접 파싱하는
라이브러리에게 이 파일들은 **깨진 암호문**으로 보인다. 반면 Excel/PowerPoint/Word
**앱 자체는 DRM을 해독할 권한**이 있으므로, 앱을 자동화(COM)해서 읽고 쓰면 된다.
이것은 우회가 아니라 권한 있는 정식 경로다.

## 철칙 (예외 없음)

1. **기존 .xlsx** → `xlwings` 또는 `win32com`만 사용.
   - `pandas.read_excel()`, `openpyxl.load_workbook()` 등 파일 직접 파싱 **금지** (깨진 데이터/에러).
2. **기존 .pptx / .docx** → `win32com`만 사용.
   - `python-pptx`, `python-docx`로 기존 사내 파일 열기 **금지**.
3. **새 파일 생성**은 자유 — `openpyxl`, `python-pptx`, `python-docx`, `matplotlib` 등 아무거나.
   (DRM은 저장 후 정책에 따라 적용되므로 생성 자체는 표준 라이브러리로 가능.)
4. 작업이 끝나면 **반드시 앱을 종료**(`app.quit()` / `Application.Quit()`)한다.
   안 하면 파일이 잠긴 채 남아 다음 사람이 열지 못한다.
5. 수정 작업 전에는 **백업 사본**을 만들고, 수정한 위치(셀 주소/슬라이드 번호)를 로그로 남긴다.
6. DRM 해제·포맷 변환으로 보호를 벗기려는 시도는 **금지**. 안 되면 사람에게 보고한다.

## 기본 코드 패턴

```python
# 엑셀 (xlwings 권장)
import xlwings as xw
app = xw.App(visible=False)
try:
    wb = app.books.open(r"C:\work\수율대장.xlsx")   # Excel이 DRM 해독
    val = wb.sheets["주간"].range("A1").expand().value
    wb.save()
    wb.close()
finally:
    app.quit()                                        # 잠금 해제 필수
```

```python
# 파워포인트 / 워드 (win32com)
import win32com.client
ppt = win32com.client.Dispatch("PowerPoint.Application")
pres = ppt.Presentations.Open(r"C:\work\주간보고.pptx", WithWindow=False)
# ... 수정 ...
pres.Save(); pres.Close(); ppt.Quit()
```

## 성능 주의

- 셀을 하나씩 루프로 읽지 말 것 — `range(...).expand().value`로 한 번에 (100배 이상 차이).
- COM 호출은 느리므로 반복 호출을 최소화하고 파이썬 쪽에서 가공한다.

## 보안

- 사내 문서 내용은 사내 승인된 AI 환경에서만 다룬다. 외부 서비스 전송 금지.
