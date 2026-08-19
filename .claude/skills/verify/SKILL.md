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

## Gotchas

- The deck needs ~2s after `load` before the canvas/HUD activate (Reveal
  `ready` + fade-in).
- Keep the pointer moving while gathering: after ~2.4s idle the attractor
  hands over to a wandering phantom (auto mode, slower collection).
- `prefers-reduced-motion: reduce` disables the whole canvas + game.
