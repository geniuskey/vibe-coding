// 사운드: Web Audio로 직접 합성하는 배경음악과 효과음. 외부 음원 파일 없음.
// 브라우저 정책상 첫 키 입력이나 클릭이 있어야 소리가 시작된다.
//
// 배경음악: 느린 화음 패드(스테레오로 넓게) + 유리종 같은 아르페지오 + 낮은 저음.
//   장면의 mood(0..1)가 밝기(필터)·밀도(음 수)·반짝임을 정한다.
// 효과음: Snd.play(name, opts). 이름은 아래 SFX 표 참고.
(() => {
  let ac = null, master, comp, musicBus, sfxBus, delayIn, noiseBuf, verbIn, padFilter;
  let started = false, muted = false, musicOn = true, mood = 0.35, sceneId = "", timer = 0;
  let nextChord = 0, chordIdx = 0, nextArp = 0, arpStep = 0;
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const rand = (a, b) => a + Math.random() * (b - a);

  // Fmaj9 → Am7(11) → Dm9 → B♭maj9 → (다시)  MIDI
  const PROG = [
    { bass: 41, pad: [53, 57, 60, 64, 67], arp: [65, 69, 72, 74, 76, 79] },
    { bass: 45, pad: [52, 57, 60, 62, 67], arp: [64, 67, 69, 72, 74, 76] },
    { bass: 38, pad: [53, 57, 60, 62, 64], arp: [62, 65, 69, 72, 74, 77] },
    { bass: 34, pad: [50, 53, 57, 60, 62], arp: [62, 65, 69, 70, 72, 74] },
  ];
  const CHORD_SEC = 9;

  function impulse(seconds = 3.6, decay = 2.4, pre = 0.02) {
    const len = Math.floor(ac.sampleRate * seconds), p = Math.floor(ac.sampleRate * pre);
    const b = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let lp = 0;
      for (let i = p; i < len; i++) {
        const t = (i - p) / (len - p);
        const n = Math.random() * 2 - 1;
        lp += (n - lp) * (0.25 + 0.6 * (1 - t)); // 꼬리로 갈수록 어둡게
        d[i] = lp * Math.pow(1 - t, decay);
      }
    }
    const cv = ac.createConvolver(); cv.buffer = b; return cv;
  }

  function init() {
    if (ac) return;
    ac = new (window.AudioContext || window.webkitAudioContext)();
    build();
  }
  function build() {
    comp = ac.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.25;
    const limit = ac.createDynamicsCompressor();
    limit.threshold.value = -3; limit.knee.value = 0; limit.ratio.value = 20; limit.attack.value = 0.001; limit.release.value = 0.1;
    comp.connect(limit); limit.connect(ac.destination);
    master = ac.createGain(); master.gain.value = 0.9; master.connect(comp);

    // 잔향 (스테레오, 앞 지연)
    verbIn = ac.createGain();
    const rv = impulse(); const rvg = ac.createGain(); rvg.gain.value = 0.42;
    const pre = ac.createDelay(0.2); pre.delayTime.value = 0.025;
    verbIn.connect(pre); pre.connect(rv); rv.connect(rvg); rvg.connect(master);

    // 아르페지오용 핑퐁 딜레이
    delayIn = ac.createGain();
    const dl = ac.createDelay(1), dr = ac.createDelay(1);
    dl.delayTime.value = 0.42; dr.delayTime.value = 0.63;
    const fb = ac.createGain(); fb.gain.value = 0.36;
    const dlp = ac.createBiquadFilter(); dlp.type = "lowpass"; dlp.frequency.value = 2800;
    const pl = ac.createStereoPanner(), pr = ac.createStereoPanner(); pl.pan.value = -0.7; pr.pan.value = 0.7;
    delayIn.connect(dl); dl.connect(dlp); dlp.connect(dr); dr.connect(fb); fb.connect(dl);
    dl.connect(pl); dr.connect(pr);

    musicBus = ac.createGain(); musicBus.gain.value = 0;
    musicBus.connect(master); musicBus.connect(verbIn);
    const dret = ac.createGain(); dret.gain.value = 0.5; pl.connect(dret); pr.connect(dret); dret.connect(musicBus);
    padFilter = ac.createBiquadFilter(); padFilter.type = "lowpass"; padFilter.frequency.value = 1200; padFilter.Q.value = 0.5;
    padFilter.connect(musicBus);

    sfxBus = ac.createGain(); sfxBus.gain.value = 0.85;
    sfxBus.connect(master);
    const sfxVerb = ac.createGain(); sfxVerb.gain.value = 0.5; sfxBus.connect(sfxVerb); sfxVerb.connect(verbIn);

    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  // ── 배경음악 ──────────────────────────────────────────────────────
  function pad(t, ch) {
    const L = CHORD_SEC;
    // 저음
    {
      const o = ac.createOscillator(); o.type = "sine"; o.frequency.value = hz(ch.bass);
      const o2 = ac.createOscillator(); o2.type = "triangle"; o2.frequency.value = hz(ch.bass + 12);
      const g = ac.createGain(), g2 = ac.createGain(); g2.gain.value = 0.18;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.13, t + 2.5);
      g.gain.setValueAtTime(0.13, t + L - 0.6); g.gain.linearRampToValueAtTime(0.0001, t + L + 2.4);
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(musicBus);
      o.start(t); o2.start(t); o.stop(t + L + 2.6); o2.stop(t + L + 2.6);
    }
    // 패드: 톱니 두 개를 살짝 어긋나게 + 삼각파, 음마다 좌우로 펼친다
    ch.pad.forEach((m, i) => {
      const pan = ac.createStereoPanner(); pan.pan.value = ((i / (ch.pad.length - 1)) * 2 - 1) * 0.65;
      const g = ac.createGain();
      const peak = 0.024 - i * 0.002;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + 3 + i * 0.25);
      g.gain.setValueAtTime(peak, t + L - 0.8);
      g.gain.linearRampToValueAtTime(0.0001, t + L + 3);
      g.connect(pan); pan.connect(padFilter);
      [["sawtooth", -8], ["sawtooth", 7], ["triangle", 0]].forEach(([type, det]) => {
        const o = ac.createOscillator(); o.type = type; o.frequency.value = hz(m); o.detune.value = det + rand(-2, 2);
        o.connect(g); o.start(t); o.stop(t + L + 3.2);
      });
    });
    // 높은 반짝임 층 (mood가 높을 때)
    if (mood > 0.45) {
      const m = ch.arp[ch.arp.length - 1] + 12;
      const o = ac.createOscillator(); o.type = "sine"; o.frequency.value = hz(m);
      const trem = ac.createOscillator(); trem.frequency.value = 0.18; const tg = ac.createGain(); tg.gain.value = 0.006;
      const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.008 + (mood - 0.45) * 0.02, t + 4); g.gain.linearRampToValueAtTime(0.0001, t + L + 2);
      trem.connect(tg); tg.connect(g.gain);
      const pan = ac.createStereoPanner(); pan.pan.value = rand(-0.5, 0.5);
      o.connect(g); g.connect(pan); pan.connect(musicBus); pan.connect(verbIn);
      o.start(t); trem.start(t); o.stop(t + L + 2.2); trem.stop(t + L + 2.2);
    }
  }
  // 유리종 같은 FM 음
  function bell(t, m, vel, dest = musicBus, { ratio = 3.5, index = 2.2, decay = 1.6, pan = rand(-0.6, 0.6) } = {}) {
    const f = hz(m);
    const car = ac.createOscillator(); car.type = "sine"; car.frequency.value = f;
    const mod = ac.createOscillator(); mod.type = "sine"; mod.frequency.value = f * ratio;
    const mg = ac.createGain();
    mg.gain.setValueAtTime(f * index, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + decay * 0.6);
    mod.connect(mg); mg.connect(car.frequency);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    const p = ac.createStereoPanner(); p.pan.value = pan;
    car.connect(g); g.connect(p); p.connect(dest);
    if (dest === musicBus) p.connect(delayIn);
    car.start(t); mod.start(t); car.stop(t + decay + 0.05); mod.stop(t + decay + 0.05);
  }
  function schedule() {
    if (!ac) return;
    scheduleUntil(ac.currentTime + 1.4);
  }
  function scheduleUntil(ahead) {
    const now = ac.currentTime;
    padFilter.frequency.setTargetAtTime(420 + mood * 1700, now, 1.5);
    while (nextChord < ahead) {
      pad(nextChord, PROG[chordIdx % PROG.length]);
      chordIdx++; nextChord += CHORD_SEC;
    }
    while (nextArp < ahead) {
      const ch = PROG[(chordIdx - 1 + PROG.length) % PROG.length];
      const density = 0.12 + mood * 0.5;
      const strong = arpStep % 8 === 0;
      if (Math.random() < density + (strong ? 0.3 : 0)) {
        const pool = ch.arp;
        const m = pool[Math.floor(Math.random() * pool.length)] + (Math.random() < 0.3 ? 12 : 0);
        bell(nextArp + rand(0, 0.015), m, 0.018 + mood * 0.022, musicBus, { index: 1.4 + mood * 1.5, decay: 1.4 + Math.random() });
      }
      nextArp += 0.3; arpStep++;
    }
  }

  // ── 효과음 도우미 ──────────────────────────────────────────────────
  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function osc(type, f0, f1, t, dur, peak, a = 0.005, { pan = 0, dest = sfxBus } = {}) {
    const o = ac.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain(); env(g, t, a, peak, dur);
    const p = ac.createStereoPanner(); p.pan.value = pan;
    o.connect(g); g.connect(p); p.connect(dest); o.start(t); o.stop(t + a + dur + 0.05);
    return o;
  }
  function noise(t, dur, peak, type, f0, f1 = f0, q = 1, a = 0.005, { pan = 0, pan1 = pan } = {}) {
    const n = ac.createBufferSource(); n.buffer = noiseBuf;
    n.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ac.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain(); env(g, t, a, peak, dur);
    const p = ac.createStereoPanner(); p.pan.setValueAtTime(pan, t); if (pan1 !== pan) p.pan.linearRampToValueAtTime(pan1, t + a + dur);
    n.connect(f); f.connect(g); g.connect(p); p.connect(sfxBus);
    n.start(t, Math.random()); n.stop(t + a + dur + 0.05);
  }

  const SFX = {
    whoosh({ up = true, dur = 0.85 } = {}, t) {
      noise(t, dur, 0.26, "bandpass", up ? 240 : 2600, up ? 2600 : 240, 1.2, dur * 0.45, { pan: up ? -0.6 : 0.6, pan1: up ? 0.6 : -0.6 });
      noise(t + 0.02, dur * 0.8, 0.08, "highpass", 3000, up ? 7000 : 2500, 0.7, dur * 0.5);
    },
    sweep({ up = true, dur = 0.6 } = {}, t) { noise(t, dur, 0.12, "bandpass", up ? 900 : 6000, up ? 6000 : 900, 3, dur * 0.4, { pan: up ? -0.4 : 0.4, pan1: up ? 0.4 : -0.4 }); },
    key(_, t) {
      noise(t, 0.028, 0.05 + Math.random() * 0.035, "bandpass", 1900 + Math.random() * 1500, undefined, 2.4, 0.002, { pan: rand(-0.25, 0.25) });
      osc("square", 130 + Math.random() * 40, 90, t, 0.018, 0.008, 0.002);
    },
    tick(_, t) { noise(t, 0.018, 0.045, "highpass", 4200, undefined, 0.7, 0.001, { pan: rand(-0.3, 0.3) }); },
    click(_, t) { noise(t, 0.012, 0.09, "bandpass", 3200, undefined, 1.5, 0.001); osc("sine", 1900, 1200, t, 0.03, 0.04, 0.001); },
    tock(_, t) { osc("sine", 620, 540, t, 0.09, 0.12, 0.002); noise(t, 0.05, 0.08, "bandpass", 1100, 900, 6, 0.001); },
    pop({ pitch = 520, vol = 0.16 } = {}, t) { osc("sine", pitch, pitch * 0.55, t, 0.15, vol, 0.004, { pan: rand(-0.3, 0.3) }); },
    blip({ note = 84, vol = 0.035 } = {}, t) { osc("square", hz(note), hz(note), t, 0.045, vol, 0.002, { pan: rand(-0.4, 0.4) }); },
    chime({ note = 76, vol = 0.12 } = {}, t) {
      const pan = rand(-0.35, 0.35);
      osc("sine", hz(note), hz(note), t, 1.7, vol, 0.004, { pan });
      osc("sine", hz(note + 12), hz(note + 12), t, 0.9, vol * 0.32, 0.004, { pan });
      osc("sine", hz(note + 19), hz(note + 19), t, 0.45, vol * 0.1, 0.004, { pan });
    },
    glass({ note = 84, vol = 0.07 } = {}, t) { bell(t, note, vol, sfxBus, { ratio: 3.5, index: 2.4, decay: 1.8 }); },
    ding({ note = 81, vol = 0.09 } = {}, t) { bell(t, note, vol, sfxBus, { ratio: 2, index: 1.6, decay: 2.2, pan: 0 }); bell(t + 0.002, note + 7, vol * 0.4, sfxBus, { ratio: 3, index: 1, decay: 1.4, pan: 0.2 }); },
    shimmer({ vol = 0.05 } = {}, t) {
      const pent = [0, 2, 4, 7, 9];
      for (let i = 0; i < 7; i++) {
        const m = 84 + pent[Math.floor(Math.random() * 5)] + (Math.random() < 0.4 ? 12 : 0);
        bell(t + i * 0.045 + rand(0, 0.02), m, vol * rand(0.5, 1), sfxBus, { ratio: 4, index: 1.2, decay: 1.2 });
      }
      noise(t, 0.9, vol * 0.5, "highpass", 7000, 9000, 0.8, 0.2);
    },
    thud({ vol = 0.45 } = {}, t) {
      osc("sine", 125, 44, t, 0.32, vol, 0.004);
      noise(t, 0.12, vol * 0.25, "lowpass", 420, 120, 0.7, 0.002);
    },
    stamp({ vol = 0.25 } = {}, t) {
      noise(t, 0.14, vol * 0.55, "lowpass", 900, 200, 0.8, 0.002, { pan: rand(-0.2, 0.2) });
      osc("sine", 180, 70, t, 0.12, vol * 0.6, 0.002);
      noise(t, 0.02, vol * 0.25, "highpass", 3500, undefined, 0.7, 0.001);
    },
    impact({ vol = 0.5 } = {}, t) {
      osc("sine", 90, 32, t, 0.9, vol, 0.004);
      osc("triangle", 60, 30, t, 0.5, vol * 0.3, 0.004);
      noise(t, 0.35, vol * 0.35, "lowpass", 900, 80, 0.7, 0.002);
      noise(t, 1.6, vol * 0.08, "bandpass", 300, 120, 0.8, 0.05);
    },
    bass({ vol = 0.35 } = {}, t) { osc("sine", 62, 40, t, 1.1, vol, 0.01); },
    buzz(_, t) {
      osc("sawtooth", 82, 78, t, 0.5, 0.05, 0.02, { pan: -0.2 });
      osc("sawtooth", 87, 83, t, 0.5, 0.045, 0.02, { pan: 0.2 });
    },
    hum({ dur = 0.8 } = {}, t) {
      const o = ac.createOscillator(); o.type = "sawtooth"; o.frequency.value = 110;
      const f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 500; f.Q.value = 4;
      const lfo = ac.createOscillator(); lfo.frequency.value = 7; const lg = ac.createGain(); lg.gain.value = 180; lfo.connect(lg); lg.connect(f.frequency);
      const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.035, t + 0.12); g.gain.setValueAtTime(0.035, t + dur - 0.15); g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(f); f.connect(g); g.connect(sfxBus); o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
    },
    rise({ dur = 1.1, vol = 0.09 } = {}, t) {
      osc("sine", 220, 880, t, dur, vol, dur * 0.8);
      noise(t, dur, vol * 0.55, "bandpass", 400, 3000, 2, dur * 0.8);
    },
    riser({ dur = 2.2, vol = 0.08 } = {}, t) {
      noise(t, dur, vol, "bandpass", 300, 5000, 2.5, dur * 0.92, { pan: -0.3, pan1: 0.3 });
      osc("sawtooth", 110, 440, t, dur, vol * 0.15, dur * 0.9);
      osc("sine", 220, 880, t, dur, vol * 0.5, dur * 0.9);
    },
    send(_, t) { SFX.pop({ pitch: 700, vol: 0.14 }, t); SFX.rise({ dur: 0.7, vol: 0.05 }, t + 0.02); },
    swell({ root = 53, vol = 0.065 } = {}, t) {
      [0, 7, 12, 16, 19, 24].forEach((iv, i) => osc(i % 2 ? "triangle" : "sine", hz(root + iv), hz(root + iv), t + i * 0.03, 3.0, vol, 0.1, { pan: (i % 2 ? 1 : -1) * 0.3 }));
      noise(t, 1.5, 0.045, "bandpass", 3000, 9000, 1, 0.35);
    },
  };

  // 소리별 음량 보정: 오프라인 렌더링으로 잰 최대값을 목표 음량(발표자 목소리 아래에 깔리는 정도)에 맞춘다.
  //   배경음악 RMS ≈ -30 dBFS, 잔잔한 소리(타자·틱) 최대 ≈ -25, 보통 효과음 ≈ -15, 큰 순간(임팩트·스웰) ≈ -8~-12
  const TRIM = {
    key: 2.3, tick: 1.2, click: 1.4, blip: 1.35, pop: 0.7, chime: 0.9, glass: 1.45, ding: 1.27, shimmer: 0.85,
    thud: 0.65, stamp: 1, impact: 0.8, bass: 0.78, buzz: 1.9, hum: 1.25, rise: 1.27, riser: 1.7, whoosh: 1.2, sweep: 2.2, send: 1, swell: 0.82, tock: 1,
  };
  function fire(name, opts, t) {
    const trim = ac.createGain(); trim.gain.value = TRIM[name] ?? 1; trim.connect(sfxBus);
    const bus = sfxBus; sfxBus = trim;
    try { SFX[name](opts || {}, t); } finally { sfxBus = bus; }
    if (ac instanceof AudioContext) setTimeout(() => { try { trim.disconnect(); } catch {} }, 8000);
  }
  // 같은 소리가 한 프레임에 몰려 터지지 않도록 소리마다 최소 간격을 둔다
  const lastAt = {};
  function play(name, opts = {}) {
    if (!started || muted || !SFX[name]) return;
    const t = ac.currentTime;
    const gap = name === "key" || name === "tick" || name === "click" ? 0.022 : name === "pop" || name === "blip" || name === "chime" ? 0.03 : 0.045;
    if (lastAt[name] && t - lastAt[name] < gap) return;
    lastAt[name] = t;
    try { fire(name, opts, t + 0.005); } catch (e) { /* 소리 하나 실패해도 발표는 계속 */ }
  }

  const MUSIC_GAIN = 0.19;
  function fadeMusic() {
    if (!ac) return;
    const t = ac.currentTime;
    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setValueAtTime(musicBus.gain.value, t);
    musicBus.gain.linearRampToValueAtTime(musicOn && !muted ? MUSIC_GAIN : 0, t + (musicOn ? 3 : 0.6));
  }

  document.addEventListener("visibilitychange", () => {
    if (!ac || !started) return;
    if (document.hidden) ac.suspend(); else ac.resume();
  });

  window.Snd = {
    get started() { return started; },
    get muted() { return muted; },
    get musicOn() { return musicOn; },
    start() {
      if (started) return;
      init();
      ac.resume();
      started = true;
      nextChord = ac.currentTime + 0.1; nextArp = nextChord + 2.5;
      schedule(); timer = setInterval(schedule, 250);
      fadeMusic();
    },
    play,
    setMood(m, id = "") { mood = Math.max(0, Math.min(1, m)); sceneId = id; },
    toggleMute() {
      muted = !muted;
      if (ac) master.gain.setTargetAtTime(muted ? 0 : 0.9, ac.currentTime, 0.05);
      return muted;
    },
    toggleMusic() { musicOn = !musicOn; fadeMusic(); return musicOn; },
    names: () => Object.keys(SFX),
    _test(name) { init(); fire(name, {}, ac.currentTime + 0.01); },
    // 시험용: 오프라인으로 배경음악 + 효과음을 렌더링해서 구간별 최대·RMS(dBFS)를 잰다
    async _offline(sec = 24, events = [], m = 0.5) {
      const keep = { ac, master, comp, musicBus, sfxBus, delayIn, noiseBuf, verbIn, padFilter, started, nextChord, chordIdx, nextArp, arpStep, mood };
      ac = new OfflineAudioContext(2, 48000 * sec, 48000);
      build(); started = true; mood = Math.max(0, m);
      musicBus.gain.value = m < 0 ? 0 : MUSIC_GAIN;
      nextChord = 0.1; nextArp = 2.6; chordIdx = 0; arpStep = 0;
      if (m >= 0) scheduleUntil(sec);
      for (const [t, name, opts] of events) fire(name, opts, t);
      const buf = await ac.startRendering();
      const L = buf.getChannelData(0), Rr = buf.getChannelData(1), sr = 48000;
      const seg = (a, b) => { let pk = 0, ss = 0, n = 0; for (let i = Math.floor(a * sr); i < Math.min(L.length, b * sr); i++) { const v = Math.max(Math.abs(L[i]), Math.abs(Rr[i])); pk = Math.max(pk, v); ss += (L[i] * L[i] + Rr[i] * Rr[i]) / 2; n++; } const db = (x) => (x > 0 ? 20 * Math.log10(x) : -999).toFixed(1); return { peak: db(pk), rms: db(Math.sqrt(ss / Math.max(1, n))) }; };
      Object.assign({}, keep);
      ({ ac, master, comp, musicBus, sfxBus, delayIn, noiseBuf, verbIn, padFilter, started, nextChord, chordIdx, nextArp, arpStep, mood } = keep);
      return { seg };
    },
  };
})();
