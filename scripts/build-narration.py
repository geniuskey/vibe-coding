#!/usr/bin/env python3
"""덱 내레이션 생성기 — 발표자 노트(<aside class="notes"> 안의 <p>)를 Gemini TTS로 읽혀 mp3로 만든다.

    python3 scripts/build-narration.py use-cases          # 바뀐 문장만 새로 생성
    python3 scripts/build-narration.py use-cases --dry    # 무엇을 만들지 목록만

- 대본의 원본은 덱 index.html 의 노트다. 한 <p> = 한 문장(한 박자). 덱은 박자가 시작될 때
  data-b="N" 요소를 켜므로, 문장을 나누거나 합치면 data-b 번호도 같이 맞춘다.
- 발음을 바꾸고 싶으면 <p data-say="피피티">PPT</p> 처럼 data-say 에 읽을 문장을 둔다(자막은 원문).
- 결과: <덱>/audio/<장>-<번호>-<해시>.mp3 와 <덱>/audio/manifest.js (window.NARRATION).
  해시는 읽는 문장 + 목소리 설정이라, 그대로인 문장은 다시 요청하지 않는다. 쓰이지 않는 mp3 는 지운다.
- 키: 환경변수 GEMINI_API_KEY → <저장소>/.env → ../bookcast/.env 순서로 찾는다. 키는 어디에도 복사하지 않는다.
- 요청 간격: 분당 한도가 낮아 요청 사이를 12초 띄운다. bookcast 의 work/tts.gate 가 있으면
  같은 잠금 파일을 써서, 두 저장소가 동시에 돌아도 한도를 넘지 않게 한다.
"""
import base64
import fcntl
import hashlib
import html.parser
import io
import json
import os
import pathlib
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
import wave

ROOT = pathlib.Path(__file__).resolve().parent.parent
MODEL = 'gemini-3.8-flash-tts'
VOICE = 'Kore'
SPEED = 1.06
STYLE = ('한국어 표준어. 메인 뉴스를 진행하는 30대 여성 아나운서의 목소리. 또렷하고 똑 부러지며 자신감 있고 '
         '전달력이 강하다. 기업 브랜드 캠페인 영상의 내레이션처럼 리듬감 있게, 핵심 단어에 힘을 주어 읽는다. '
         '쉼표에서 짧게 끊고, 문장 끝을 흐리지 않고 단단하게 맺는다. 과장된 광고 톤이나 감정 과잉은 피한다.')
MIN_GAP = 12.0
GATES = [ROOT.parent / 'bookcast' / 'work' / 'tts.gate', ROOT / '.tts.gate']


class Notes(html.parser.HTMLParser):
    """<section data-nid="..."> 안 <aside class="notes"> 의 <p> 들을 (nid, [(자막, 읽을 문장)]) 로."""

    def __init__(self):
        super().__init__()
        self.slides, self.nid, self.in_notes, self.p, self.say = [], None, False, None, None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'section' and a.get('data-nid'):
            self.nid = a['data-nid']
            self.slides.append((self.nid, []))
        elif tag == 'aside' and 'notes' in (a.get('class') or '').split() and self.nid:
            self.in_notes = True
        elif tag == 'p' and self.in_notes:
            self.p, self.say = [], a.get('data-say')

    def handle_endtag(self, tag):
        if tag == 'p' and self.p is not None:
            text = norm(''.join(self.p))
            if text:
                self.slides[-1][1].append((text, norm(self.say or text)))
            self.p = None
        elif tag == 'aside':
            self.in_notes = False

    def handle_data(self, data):
        if self.p is not None:
            self.p.append(data)


def norm(t):
    return re.sub(r'\s+', ' ', t or '').strip()


def api_key():
    if os.environ.get('GEMINI_API_KEY'):
        return os.environ['GEMINI_API_KEY']
    for env in (ROOT / '.env', ROOT.parent / 'bookcast' / '.env'):
        if env.exists():
            for line in env.read_text().splitlines():
                if line.startswith('GEMINI_API_KEY='):
                    return line.split('=', 1)[1].strip().strip('"\'')
    raise SystemExit('GEMINI_API_KEY 가 없습니다 — 환경변수나 .env 에 넣어 주세요.')


def throttle():
    gate = next((g for g in GATES if g.parent.exists()), GATES[-1])
    fd = open(gate, 'a+')
    fcntl.flock(fd, fcntl.LOCK_EX)
    fd.seek(0)
    try:
        last = float(fd.read().strip() or 0)
    except ValueError:
        last = 0
    wait = last + MIN_GAP - time.time()
    if wait > 0:
        time.sleep(wait)
    fd.seek(0)
    fd.truncate()
    fd.write(str(time.time()))
    fd.flush()
    return fd


def tts(text):
    payload = {'contents': [{'role': 'user', 'parts': [{'text': text, 'speech_metadata': {'style': STYLE}}]}],
               'generationConfig': {'responseModalities': ['AUDIO'],
                                    'speechConfig': {'voiceConfig': {'voice': VOICE}}}}
    body = json.dumps(payload).encode()
    for attempt in range(8):
        gate = throttle()
        try:
            req = urllib.request.Request(
                f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent', data=body,
                headers={'x-goog-api-key': api_key(), 'Content-Type': 'application/json'})
            with urllib.request.urlopen(req, timeout=180) as r:
                data = json.load(r)
            break
        except urllib.error.HTTPError as e:
            err = e.read().decode('utf8', 'replace')
            if e.code not in (429, 500, 503):
                raise SystemExit(f'TTS 오류 {e.code}: {err[:800]}')
            delay = 0
            m = re.search(r'"retryDelay":\s*"(\d+(?:\.\d+)?)s"', err)
            if m:
                delay = float(m.group(1))
            if delay > 300:
                raise SystemExit(f'TTS 일일 한도 소진 — 약 {delay / 3600:.1f}시간 뒤 다시 시도하세요.')
            wait = max(delay, 15 * (attempt + 1))
            print(f'  TTS {e.code}, {wait:.0f}초 뒤 재시도', flush=True)
            time.sleep(wait)
        finally:
            gate.close()
    else:
        raise SystemExit('TTS 재시도 횟수 초과')
    part = next(p['inlineData'] for p in data['candidates'][0]['content']['parts'] if 'inlineData' in p)
    raw = base64.b64decode(part['data'])
    if raw[:4] == b'RIFF':
        with wave.open(io.BytesIO(raw)) as w:
            return w.readframes(w.getnframes()), w.getframerate()
    return raw, 24000


def encode(pcm, rate, target):
    trim = ('silenceremove=start_periods=1:start_threshold=-50dB,areverse,'
            'silenceremove=start_periods=1:start_threshold=-50dB,areverse')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(rate), '-ac', '1', '-i', '-',
                    '-af', f'{trim},atempo={SPEED},loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '44100',
                    '-c:a', 'libmp3lame', '-b:a', '64k', str(target)], input=pcm, check=True)


def duration(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(path)],
                         capture_output=True, text=True, check=True).stdout
    return round(float(out.strip()), 2)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    dry = '--dry' in sys.argv
    if not args:
        raise SystemExit(__doc__)
    deck = ROOT / args[0]
    parser = Notes()
    parser.feed((deck / 'index.html').read_text())
    out = deck / 'audio'
    out.mkdir(exist_ok=True)
    settings = json.dumps([MODEL, VOICE, SPEED, STYLE], ensure_ascii=False)

    manifest, keep, todo = {}, set(), []
    for nid, lines in parser.slides:
        manifest[nid] = []
        for i, (text, say) in enumerate(lines):
            h = hashlib.sha1((say + settings).encode()).hexdigest()[:8]
            name = f'{nid}-{i:02d}-{h}.mp3'
            keep.add(name)
            manifest[nid].append({'t': text, 'f': name})
            if not (out / name).exists():
                todo.append((nid, i, say, out / name))

    total = sum(len(v) for v in manifest.values())
    print(f'{deck.name}: {len(manifest)}장 · {total}문장 · 새로 생성 {len(todo)}개 (약 {len(todo) * MIN_GAP / 60:.0f}분)')
    if dry:
        for nid, i, say, _ in todo:
            print(f'  {nid}#{i}  {say}')
        return
    for n, (nid, i, say, target) in enumerate(todo, 1):
        print(f'[{n}/{len(todo)}] {nid}#{i}  {say}', flush=True)
        pcm, rate = tts(say)
        encode(pcm, rate, target)

    for f in out.glob('*.mp3'):
        if f.name not in keep:
            f.unlink()
    for entries in manifest.values():
        for e in entries:
            e['d'] = duration(out / e['f'])
    js = ('/* scripts/build-narration.py 가 생성 — 직접 고치지 말 것. 대본은 index.html 의 발표자 노트. */\n'
          f'/* voice: {VOICE} · model: {MODEL} · speed: {SPEED} */\n'
          'window.NARRATION = ' + json.dumps(manifest, ensure_ascii=False, indent=1) + ';\n')
    (out / 'manifest.js').write_text(js)
    secs = sum(e['d'] for v in manifest.values() for e in v)
    print(f'완료 — 내레이션 합계 {secs / 60:.1f}분 → {out / "manifest.js"}')


if __name__ == '__main__':
    main()
