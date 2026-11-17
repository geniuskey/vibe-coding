---
name: verify
description: How to build, launch, and drive this reveal.js slide deck (index.html) to verify changes end-to-end in a real browser.
---

# Verifying this repo

This is a set of reveal.js slide decks (one `index.html` per top-level folder,
everything inlined) plus a live presentation server (`server.js`, exercised by
the tests in `test/`).

The live Q&A layer is shared, not per-deck: `assets/qa.js` is the single client
every deck loads, and `present/index.html` is the unified presenter console.
`server.js` keeps ONE session (current deck + slide + questions + reactions),
so switching decks mid-talk carries the questions along and moves the audience.

## Launch

No build step. Serve statically from the repo root (the deck also polls
`/qa/health`; a 404 for it under a static server is expected noise):

```bash
python3 -m http.server 8765 &
```

To verify Q&A server changes instead, run `node server.js` and hit its routes
directly (see `test/*.test.js` for the route list). For the end-to-end
presentation flow, open `/present/`, click a deck's "발표 시작", and keep an
audience tab on another deck — it must navigate to the presented deck by itself.

Note: SSE keeps a connection open forever, so Playwright's `networkidle` never
fires on any page with the Q&A client. Use `waitUntil: 'load'`.

## Drive

Playwright is installed globally; Chromium is pre-provisioned — do NOT run
`playwright install`:

```js
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
```

Flows worth driving:

- Title slide: living canvas background (`#hero-canvas`) + signal-harvest
  mini game HUD (`#hero-hud`). Move the mouse in small circles near center
  for a few seconds → nodes charge and auto-collect (`#hud-score` grows);
  click at the cursor → harvest burst + `COMBO ×N` in `#hud-combo`.
- `ArrowRight` / `ArrowLeft` navigate slides; the HUD must show only on
  slide 1 (`#hero-hud.on`), the canvas also runs on the Q&A slide.
- Miss penalty: gather until charge rings appear, then yank the cursor to a
  far corner → half-charged nodes escape the well, red `−1` popups, current
  score drops while `#hud-best` (BEST) holds. Golden nodes expiring
  uncaptured cost −5.
- Reload → current score and best persist via `localStorage.heroSignal`
  and `localStorage.heroSignalBest`.

### Home page (root `index.html`) — the build scene

- A fresh context (empty `sessionStorage`) plays the ~4s build scene once:
  terminal centered → IME typing → `✻ Vibing…` → particles fly from the
  `● Write(index.html)` line into the giant title → `Update` lines reveal the
  rest. Done when `#term-status` reads `done`; the receipt `#rc-text` then
  shows `N초 · 입자 N개 · …`. `?intro` forces a replay; setting
  `sessionStorage['vibe-intro-seen']='1'` (via `addInitScript`) skips it.
- Any key/click/wheel during the scene must jump straight to the final state
  (`html.intro` gone, every `.hero [data-build]` has `.built`).
- Particle frames are JS-timed, so screenshots taken mid-scene drift unless
  the clock is frozen: `page.clock.install({time})` then
  `page.clock.pauseAt(time + 1000)` **before** `goto`, and step with
  `clock.runFor(ms)`. CSS transitions still run on real time.
- After the scene: hovering the title opens the lens (`#t-main.lens`,
  `window.__fxPerf.lensFrames` grows), click/tap bursts, scrolling past the
  hero sets `#t-main` inline opacity to 0 and back to `""` at the top.
- Slow machines: `Emulation.setCPUThrottlingRate` 4–6 should keep
  `__fxPerf.flightAvg` near 24–33 ms; the scene length is time-based.

## Gotchas

- The deck needs ~2s after `load` before the canvas/HUD activate (Reveal
  `ready` + fade-in).
- Keep the pointer moving while gathering: after ~2.4s idle the attractor
  hands over to a wandering phantom (auto mode, slower collection).
- `prefers-reduced-motion: reduce` disables the whole canvas + game.
