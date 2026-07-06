---
name: verify
description: How to build, launch, and drive this reveal.js slide deck (index.html) to verify changes end-to-end in a real browser.
---

# Verifying this repo

This is a single-file reveal.js slide deck (`index.html`, everything inlined)
plus an optional live Q&A server (`server.js`, exercised by the tests in
`test/`).

## Launch

No build step. Serve statically from the repo root (the deck also polls
`/qa/health`; a 404 for it under a static server is expected noise):

```bash
python3 -m http.server 8765 &
```

To verify Q&A server changes instead, run `node server.js` and hit its routes
directly (see `test/*.test.js` for the route list).

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
- Reload → score persists via `localStorage.heroSignal`.

## Gotchas

- The deck needs ~2s after `load` before the canvas/HUD activate (Reveal
  `ready` + fade-in).
- Keep the pointer moving while gathering: after ~2.4s idle the attractor
  hands over to a wandering phantom (auto mode, slower collection).
- `prefers-reduced-motion: reduce` disables the whole canvas + game.
