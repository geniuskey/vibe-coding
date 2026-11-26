// 수학 · 시간 · 색 도우미. 모든 장면이 같이 쓴다.
// 장면 그림은 "시간 → 그림" 순수 함수라서, 여기 있는 함수들도 모두 부수 효과가 없다.
(() => {
  const TAU = Math.PI * 2;
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const invlerp = (a, b, x) => clamp((x - a) / (b - a));
  const smooth = (a, b, x) => { const t = invlerp(a, b, x); return t * t * (3 - 2 * t); };
  const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  const ease = {
    linear: (t) => clamp(t),
    in2: (t) => (t = clamp(t), t * t),
    out2: (t) => (t = clamp(t), 1 - (1 - t) * (1 - t)),
    inOut2: (t) => (t = clamp(t), t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    in3: (t) => (t = clamp(t), t * t * t),
    out3: (t) => (t = clamp(t), 1 - Math.pow(1 - t, 3)),
    inOut3: (t) => (t = clamp(t), t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    in4: (t) => Math.pow(clamp(t), 4),
    out4: (t) => 1 - Math.pow(1 - clamp(t), 4),
    inOut4: (t) => (t = clamp(t), t < 0.5 ? 8 * t ** 4 : 1 - Math.pow(-2 * t + 2, 4) / 2),
    out5: (t) => 1 - Math.pow(1 - clamp(t), 5),
    inExpo: (t) => (t = clamp(t), t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
    outExpo: (t) => (t = clamp(t), t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    inOutExpo: (t) => (t = clamp(t), t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
    outBack: (t, s = 1.6) => (t = clamp(t) - 1, 1 + (s + 1) * t * t * t + s * t * t),
    inBack: (t, s = 1.6) => (t = clamp(t), (s + 1) * t * t * t - s * t * t),
    // 감쇠 진동: 0에서 출발해 1 근처에서 흔들리다 멈춘다. t는 초 단위로 써도 된다.
    spring: (t, freq = 1.4, damp = 5.5) => (t <= 0 ? 0 : 1 - Math.exp(-damp * t) * Math.cos(TAU * freq * t)),
  };
  // 옛 이름 호환
  ease.out = ease.out3; ease.in = ease.in3; ease.inOut = ease.inOut3; ease.back = ease.outBack; ease.expo = ease.outExpo;

  // t초 시점에서 delay 뒤 dur 동안 0→1로 가는 진행도
  const prog = (t, delay = 0, dur = 1, e = ease.out3) => (t <= delay ? 0 : e(clamp((t - delay) / Math.max(1e-6, dur))));

  // 재현 가능한 난수 (mulberry32)
  function rng(seed = 1) {
    let a = (seed * 2654435761) >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  // 1차원 부드러운 잡음 (-1..1)
  const noise = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u) * 2 - 1; };
  // 프레임 간격과 무관한 지수 감쇠
  const damp = (cur, target, lambda, dt) => lerp(cur, target, 1 - Math.exp(-lambda * dt));

  // 색: "#rrggbb" → [r,g,b] (0..1, sRGB)
  const hex = (h) => {
    if (Array.isArray(h)) return h;
    const n = parseInt(String(h).replace("#", ""), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };
  const toLin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const lin = (h) => hex(h).map(toLin);

  window.Deck = window.Deck || {};
  Deck.util = { TAU, clamp, lerp, invlerp, smooth, mix3, ease, prog, rng, hash, noise, damp, hex, lin };
})();
