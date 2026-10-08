#!/usr/bin/env python3
"""scripts/build-pdfs.js 의 보조 도구 (pip install fonttools brotli pypdf pillow).

  python3 scripts/pdf_tools.py fonts 300,400,700 < base64-woff2   # 가변 폰트 → 굵기별 정적 TTF(JSON)
  python3 scripts/pdf_tools.py compress in.pdf [quality]          # 래스터 레이어를 JPEG 으로 재압축
"""
import base64
import io
import json
import sys


def fonts(weights):
    from fontTools.ttLib import TTFont
    from fontTools.varLib.instancer import instantiateVariableFont

    src = base64.b64decode(sys.stdin.read())
    out = {}
    for w in weights:
        f = instantiateVariableFont(TTFont(io.BytesIO(src)), {'wght': w}, updateFontNames=False)
        f.flavor = None
        buf = io.BytesIO()
        f.save(buf)
        out[w] = base64.b64encode(buf.getvalue()).decode()
    print(json.dumps(out))


def compress(path, quality=82):
    # Chromium 은 그림자·글로우·그라데이션 텍스트를 무손실(Flate) 비트맵으로 굽는다.
    # 불투명 RGB 부분만 JPEG 으로 바꾸고, 투명도(SMask)는 그대로 둔다.
    import pypdf
    from pypdf.generic import NameObject, StreamObject
    from PIL import Image

    w = pypdf.PdfWriter(clone_from=pypdf.PdfReader(path))
    for num in range(1, len(w._objects) + 1):
        try:
            o = w.get_object(num)
        except Exception:
            continue
        if not (isinstance(o, StreamObject) and o.get('/Subtype') == '/Image'
                and o.get('/ColorSpace') == '/DeviceRGB' and o.get('/Filter') == '/FlateDecode'
                and o.get('/BitsPerComponent') == 8):
            continue
        data = o.get_data()
        size = (o['/Width'], o['/Height'])
        if len(data) != size[0] * size[1] * 3:
            continue
        buf = io.BytesIO()
        Image.frombytes('RGB', size, data).save(buf, 'JPEG', quality=quality, optimize=True)
        jpeg = buf.getvalue()
        if len(jpeg) < len(o._data):
            o._data = jpeg
            o[NameObject('/Filter')] = NameObject('/DCTDecode')
            o.pop('/DecodeParms', None)
    w.compress_identical_objects()
    w.write(path)


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'fonts':
        fonts([int(x) for x in sys.argv[2].split(',')])
    elif cmd == 'compress':
        compress(sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 82)
    else:
        sys.exit('unknown command: ' + cmd)
