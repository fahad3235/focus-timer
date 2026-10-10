# Focus Timer — ফোকাস টাইমার

A free, fully offline bilingual (Bangla/English) Pomodoro focus timer. Customizable
focus / short-break / long-break durations, drift-corrected timing, session history
with daily and weekly totals, browser notifications and sound on phase changes —
all in your browser, no account, no server.

## 1. Problem being solved

Staying focused is hard, and most Pomodoro timers are English-only, ad-supported,
or require accounts. Students and professionals in Bangladesh need a simple,
private, bilingual focus timer that works offline and respects their data.

## 2. Implemented features

- Pomodoro cycle: focus → short break → … → long break, with configurable
  durations and sessions-per-cycle.
- Circular progress ring + large time display; Start / Pause / Resume / Reset / Skip.
- Drift-corrected timing (deadline timestamps, not naive interval counting).
- Session history log persisted in `localStorage`, with today / this-week totals.
- Browser notification + WebAudio chime on every phase change (graceful fallback
  to title flashing when notifications are unavailable).
- Full Bangla ⇄ English UI toggle; responsive mobile and desktop layouts.
- Test override `?t=<seconds>` compresses every phase for automated testing.

## 3. Technology stack

- Plain HTML, CSS, JavaScript — zero dependencies, zero build step.
- Web APIs only: `localStorage`, `Notification`, `AudioContext`, SVG.

## 4. Prerequisites

Any modern browser (Chrome, Edge, Firefox, Safari). No installation, no Node,
no accounts.

## 5. Installation instructions

None — open `index.html` in a browser, or serve the folder with any static
server:

```bash
cd focus-timer
python3 -m http.server 8000
# open http://localhost:8000
```

## 6. Local development commands

There is no build. Edit the files and reload the page. Optional local server:

```bash
python3 -m http.server 8000
```

## 7. Environment variable setup

None. The app is fully offline and uses no environment variables or secrets.

## 8. Testing instructions

Automated headless-Chromium suite (Playwright):

```bash
python3 -m http.server 8123 >/dev/null 2>&1 &
python3 /tmp/ft-test/test.py
```

The suite uses the `?t=<seconds>` override (e.g. `?t=3`) to compress phases so
phase transitions complete in seconds. It covers: zero console errors, countdown
and phase transitions, pause/resume time preservation, skip, reset, history
persistence across reload, BN/EN label toggle, and invalid-duration rejection.

## 9. Deployment instructions

GitHub Pages compatible: push the folder contents to a repository's `main`
branch and enable Pages (Deploy from branch → `main` / `/ (root)`). No build
step required.

## 10. Known limitations

- History and settings live in per-browser `localStorage` — no cross-device sync.
- Timer keeps running while the tab is open; closing the tab stops the session
  (a closed tab cannot keep time).
- Notifications require the browser permission; without it the app falls back
  to a title flash + sound.
- Sound requires a user gesture first (browser autoplay policy); the first
  Start click satisfies this.
- In test mode (`?t=`) focus completions are not logged to history.

## 11. Current project status

v1 complete. All features above are implemented and covered by the automated
suite (see §8).

## 12. License

MIT — see LICENSE file.
