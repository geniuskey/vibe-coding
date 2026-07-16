---
name: gds-inspect
description: GDS/OASIS 레이아웃 파일의 셀·레이어 통계, 면적/밀도 계산, 간단한 룰 체크, 리비전 간 비교를 한다. "GDS 열어줘", "레이어 면적", "밀도 체크", "레이아웃 비교" 요청 시 사용. 반드시 klayout 파이썬 모듈(pya)을 사용한다.
---

# GDS 레이아웃 검사·통계

`.gds`는 바이너리 포맷이다 — **klayout 파이썬 모듈만 사용**한다 (`pip install klayout`).
GDS 바이너리를 직접 파싱하는 코드를 새로 작성하는 것은 금지.
GUI 없이 동작하므로 서버/배치 환경에서도 그대로 쓸 수 있다.

## 기본 패턴

```python
import klayout.db as db

ly = db.Layout()
ly.read("chip.gds")
top = ly.top_cell()
print("dbu =", ly.dbu)        # 좌표 단위 (보통 0.001 = 1nm)
```

## 할 수 있는 일

1. **셀 트리 요약**: top cell부터 셀 계층, 인스턴스 수, 배열(AREF) 여부를 표로.
2. **레이어 통계**: 레이어(layer/datatype)별 도형 수·총면적:
   ```python
   for li in ly.layer_indexes():
       info = ly.get_info(li)
       reg = db.Region(top.begin_shapes_rec(li))
       area_um2 = reg.area() * ly.dbu * ly.dbu     # dbu² → µm²
   ```
3. **밀도 체크**: 창(window)별 금속 밀도 — `Region` 을 타일로 잘라 면적비 계산,
   기준(예: M1 20~80%) 밖 타일을 좌표와 함께 보고.
4. **간단 룰 스크리닝**: 최소 폭/간격 후보 검출 —
   `reg.width_check(w)` / `reg.space_check(s)` 결과를 마커 좌표 목록으로.
5. **리비전 diff**: 두 GDS를 레이어별 `Region` XOR로 비교, 차이 면적·위치 요약.

## 절대 규칙 — 단위

- KLayout 좌표는 **정수 dbu**다. µm로 보고할 때 반드시 `ly.dbu`를 곱한다.
  (면적은 `dbu²`이므로 **두 번** 곱한다.) µm로 착각하면 1,000배 틀린다.

## 한계 (스킬이 하지 않는 일)

- 사인오프 DRC/LVS 판정은 전용 EDA 툴 영역 — 여기서는 **후보 스크리닝·통계·리포트**까지만.
- 레이아웃 수정(도형 추가/삭제)은 사용자가 명시적으로 요청하고 대상 셀·레이어를 지정했을 때만,
  수정본은 반드시 새 파일로 저장한다 (`ly.write("chip_mod.gds")`).

## 보안

- 레이아웃은 핵심 설계 자산이다. 사내 승인된 환경에서만 다루고, 좌표·구조를 외부로 내보내지 않는다.
