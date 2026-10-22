# Daybloom — a bright, minimal daily planner (PWA)

A personal timetable with a **Priority Inbox** and dynamic **Focus Blocks**. React + TypeScript + Vite + Tailwind, IndexedDB (Dexie) for storage, Web Audio for chimes, `vite-plugin-pwa`/Workbox for offline + install. No backend, accounts or analytics — everything stays on your device.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit + persistence + app smoke tests
npm run build      # type-check + production build into dist/
npm run verify     # checks asset paths, manifest scope and service-worker precache
npm run preview    # serve the production build (service worker active)
```

## Deploy to GitHub Pages

1. Create a GitHub repository and push this folder to the `main` branch.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. Push. `.github/workflows/deploy.yml` runs tests, builds, verifies, and publishes.

The base path is derived automatically from the repository name (`owner/planner` → `/planner/`; `owner/owner.github.io` → `/`). To override, set `BASE_PATH=/something/` when building. Your app will be at `https://<owner>.github.io/<repo>/`.

**Install it:** Chrome/Edge/Android → Settings → *Install Daybloom* (or the browser's install icon). iPhone: Safari → Share → *Add to Home Screen*. After the first load it works offline.

## Using it

| Do this | To get this |
| --- | --- |
| Double-tap an empty spot on the timeline | New activity at that time (name optional → "New activity", 1 hour, no repeat) |
| **+** button | New activity at the next quarter-hour |
| Tap a card | Details (edit / duplicate / delete, hidden tasks) |
| Long-press, right-click, or the **⋯** on a card | Edit · Duplicate · Delete |
| Swipe left/right, ← → keys, chevrons, tap the date | Change day. After 8 s idle it glides back to today and centres "now" (never while a form is open) |
| **⋯** in the header | Reuse yesterday's schedule · Copy this day to a date range |
| Undo / Redo icons, toast, Ctrl/⌘+Z | Reverse anything significant |

**Recurring activities** store one rule plus exceptions (never a copy per day). Editing or deleting asks: this occurrence / this and following / entire series. Monthly on the 29th–31st falls back to the month's last day; a Feb 29 yearly activity lands on Feb 28 in non-leap years.

**Bulk copy** shows exactly what will be created (and what is skipped as an exact duplicate) before applying, then "Created 14 activities · Undo". Undo removes only that batch.

**Priority Inbox:** the list order *is* the priority. New tasks go to the middle by default (tap the position chip for Top/Bottom, or "Add below" on a task). Drag the grip, or use Up/Down in a task's expanded row. Completing a task moves it to **History** (restorable) and every Focus Block immediately shows the next one. The Inbox is the single source of truth; Focus Blocks never copy tasks, and tasks never auto-complete when time passes.

**Focus Blocks:** tick "Focus Block" under *More options* when creating. Settings chooses 2 or 3 tasks. Hide a task from one block via its details sheet.

## Notifications — what is and isn't guaranteed

Three generated sounds (hourly bell, rising start trio, falling end pair), each with its own toggle, volume and preview. Each event plays **at most once** (keys are recorded in IndexedDB before playing, so refreshes and day navigation never repeat them). After sleep or a throttled background tab, events older than 90 seconds are recorded but **not** replayed.

Honest limits of a browser-only PWA:
- Sounds need the app **open or recently open**. Browsers suspend pages and timers in the background, and a service worker cannot play audio or run continuously. Nothing here pretends otherwise.
- Browsers keep audio locked until you've touched the page once after loading. The first tap anywhere unlocks it; the preview buttons tell you if audio was blocked.
- *System notifications* (optional toggle; permission is requested only when you turn it on) show banners only while the page is still alive in the background. Reliable alerts with the app fully closed would need a push server, which this project deliberately doesn't have.
- iOS supports notifications only for the installed Home Screen app.

## Data

IndexedDB stores: `activities` (definitions + recurrence + exceptions), `tasks` (active Inbox), `completed` (history), `fired` (notification records, pruned after 3 days), `settings`. Dates/times use the device's local timezone; activities cannot cross midnight (split overnight items such as sleep into two). **Settings → Your data** exports/imports JSON (validated, with a replace warning) and can clear everything (explicit confirmation). Undo history lives for the current session.

## Code map

```
src/lib/recurrence.ts   rules, exceptions, occurrence resolution
src/lib/timeline.ts     y↔time mapping, overlap column layout
src/lib/priority.ts     task ordering, focus-block contents, complete/restore ops
src/lib/undo.ts         transactions (exact before/after records) + history
src/lib/activities.ts   create/edit/delete scopes, bulk-copy planning, defaults
src/lib/notify.ts       event building, de-duplication, sleep-safe selection
src/lib/sound.ts        Web Audio recipes
src/lib/db.ts, store.ts Dexie persistence + app state
tests/                  behaviour tests (recurrence, bulk+undo, focus blocks, notifications, DB, app smoke)
```
