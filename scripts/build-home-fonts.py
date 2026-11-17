#!/usr/bin/env python3
"""
홈(index.html) 전용 웹폰트 — assets/home-fonts.css 를 만든다.

  VibeDisplay       vendor/fonts/pretendard.css 의 Pretendard Variable(wght 45–930)에서
                    히어로 제목·부제에 실제로 쓰인 글자만 남긴 서브셋 (수 KB).
  JetBrains Mono    같은 파일의 ASCII 서브셋(400·600)을 그대로 옮긴다.

본문은 시스템 글꼴을 그대로 쓴다 — 벤더 Pretendard 는 덱에 나오는 600여 자만 담은 서브셋이라
홈 본문에 걸면 없는 글자만 다른 글꼴로 섞여 보인다. 그래서 큰 글자(제목·부제)에만 따로 뽑아 쓴다.
데이터 URI 로 넣어 file:// 로 열어도 동작한다.

글자는 index.html 에서 data-display 가 붙은 요소의 텍스트를 읽어 고른다.
히어로 문구를 바꿨으면 다시 실행:

    pip install fonttools brotli
    python3 scripts/build-home-fonts.py
"""
import base64
import io
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

try:
    from fontTools import subset
    from fontTools.ttLib import TTFont
except ImportError:
    sys.exit("fontTools 가 필요합니다: pip install fonttools brotli")

ROOT = Path(__file__).resolve().parent.parent
SRC_CSS = ROOT / "vendor/fonts/pretendard.css"
HTML = ROOT / "index.html"
OUT = ROOT / "assets/home-fonts.css"


class DisplayText(HTMLParser):
    """data-display 요소(와 그 자손) 안의 텍스트만 모은다."""

    VOID = {"br", "img", "input", "meta", "link", "hr", "wbr", "source"}

    def __init__(self):
        super().__init__()
        self.depth = 0
        self.text = []

    def handle_starttag(self, tag, attrs):
        if tag in self.VOID:
            return
        if self.depth or any(k == "data-display" for k, _ in attrs):
            self.depth += 1

    def handle_endtag(self, tag):
        if self.depth and tag not in self.VOID:
            self.depth -= 1

    def handle_data(self, data):
        if self.depth:
            self.text.append(data)


def faces(css):
    for block in re.findall(r"@font-face\{(.*?)\}", css, re.S):
        fam = re.search(r"font-family:'([^']*)'", block).group(1)
        weight = re.search(r"font-weight:([^;]*)", block).group(1).strip()
        data = base64.b64decode(re.search(r"base64,([^)]*)\)", block).group(1))
        yield fam, weight, data


def subset_woff2(data, text):
    font = TTFont(io.BytesIO(data))
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    sub = subset.Subsetter(opts)
    sub.populate(text=text)
    sub.subset(font)
    buf = io.BytesIO()
    font.flavor = "woff2"
    font.save(buf)
    return buf.getvalue()


def main():
    parser = DisplayText()
    parser.feed(HTML.read_text(encoding="utf-8"))
    text = "".join(sorted(set("".join(parser.text)) - set("\n\t")))
    if not text.strip():
        sys.exit("index.html 에서 data-display 텍스트를 찾지 못했습니다.")

    src = {(fam, w): data for fam, w, data in faces(SRC_CSS.read_text(encoding="utf-8"))}
    pretendard = src[("Pretendard", "45 930")]

    cmap = TTFont(io.BytesIO(pretendard)).getBestCmap()
    missing = [ch for ch in text if ch.strip() and ord(ch) not in cmap]
    if missing:
        print("⚠ 벤더 Pretendard 서브셋에 없는 글자 — 시스템 글꼴로 대체됩니다:", "".join(missing))

    display = subset_woff2(pretendard, text)
    b64 = lambda b: base64.b64encode(b).decode("ascii")

    css = [
        "/* 홈 전용 웹폰트 — scripts/build-home-fonts.py 가 만든 파일 (직접 고치지 말 것)",
        f" * VibeDisplay: Pretendard Variable 서브셋 {len(display):,} B — 글자: {text.strip()}",
        " * JetBrains Mono: vendor/fonts/pretendard.css 의 ASCII 서브셋 400·600",
        " * 라이선스: 둘 다 SIL Open Font License 1.1 */",
        "@font-face{font-family:'VibeDisplay';font-style:normal;font-weight:45 930;font-display:block;"
        f"src:url(data:font/woff2;base64,{b64(display)}) format('woff2');}}",
    ]
    for w in ("400", "600"):
        css.append(
            f"@font-face{{font-family:'JetBrains Mono';font-style:normal;font-weight:{w};font-display:swap;"
            f"src:url(data:font/woff2;base64,{b64(src[('JetBrains Mono', w)])}) format('woff2');}}"
        )
    OUT.write_text("\n".join(css) + "\n", encoding="utf-8")
    print(f"→ {OUT.relative_to(ROOT)}  ({OUT.stat().st_size:,} B, 디스플레이 글자 {len(text.strip())}자)")


if __name__ == "__main__":
    main()
