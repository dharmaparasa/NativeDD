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

## Android app

The Android wrapper uses Capacitor and Android local notifications; the GitHub Pages PWA remains a separate web build with the same UI and browser-only behavior.

1. Install Node.js 22.22.2+ (or 24.15+) and Android Studio, including the Android SDK. Use Android Studio's bundled JDK or another JDK supported by the generated Android Gradle Plugin (JDK 21 is a suitable choice; JDK 25 is not supported by this Gradle wrapper).
2. Run `npm install`, then `npm run android:sync`. This creates/updates the native web assets and generates the three notification sound files under `android/app/src/main/res/raw/`.
3. Open the project with `npm run android:open`, let Android Studio install its Gradle/SDK components, then build or run the `app` configuration. A debug APK can be built from Android Studio or with `cd android; .\gradlew.bat assembleDebug`; it is written to `android/app/build/outputs/apk/debug/app-debug.apk`.
4. Install the APK on an Android phone, launch Daybloom, and use **Settings → Scheduled notifications** to grant notification permission and, when requested, **Alarms & reminders** access.
5. In **Settings → Sounds**, use a preview to test each native sound. For a scheduled test, create an activity starting a few minutes ahead, enable the relevant sound and scheduled notifications, then lock the phone before the time arrives.

Android notifications use three generated WAV sounds based on the existing hourly/start/end tone recipes. Each sound has its own Android notification channel; after installation, channel sound and importance are controlled by Android settings. Native alert loudness follows the phone's notification volume (the app volume sliders control Web Audio previews). The app reconciles changes, undo/redo, and imports into a rolling schedule of up to 450 future alarms, rebuilt at launch and when the app resumes. Capacitor's Android plugin restores scheduled alarms after reboot. Android can delay alarms in Doze or restrict exact alarms, and the OS rate-limits alarms allowed during idle; force-stopping the app or device-specific battery controls may also prevent delivery until Daybloom is opened again. Test on the target device and do not treat these reminders as emergency alerts. Opening Daybloom refills the future queue; later alarms beyond the current queue cannot be restored while the app remains closed.

The Android app has its own local IndexedDB and does not automatically share data with the browser-installed PWA. Export a backup from the PWA before installing/using the Android app, then import it in Android Settings → Your data. Import explicitly replaces the Android app's current data after confirmation. The Capacitor application ID is `com.daybloom.planner`; change it before publishing if you need a uniquely owned Play Store application ID.

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

## PWA notifications — what is and isn't guaranteed

The browser version has three generated sounds (hourly bell, rising start trio, falling end pair), each with its own toggle, volume and preview. Each event plays **at most once** (keys are recorded in IndexedDB before playing, so refreshes and day navigation never repeat them). After sleep or a throttled background tab, events older than 90 seconds are recorded but **not** replayed.

Honest limits of a browser-only PWA:
- Sounds need the app **open or recently open**. Browsers suspend pages and timers in the background, and a service worker cannot play audio or run continuously. Nothing here pretends otherwise.
- Browsers keep audio locked until you've touched the page once after loading. The first tap anywhere unlocks it; the preview buttons tell you if audio was blocked.
- *System notifications* (optional toggle; permission is requested only when you turn it on) show banners only while the PWA page is still alive in the background. A browser PWA cannot promise alerts with the page fully closed; see [Android app](#android-app) for device-scheduled notifications.
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
src/lib/nativeNotifications.ts Android permission checks and bounded local-alarm reconciliation
src/lib/sound.ts        Web Audio recipes
src/lib/db.ts, store.ts Dexie persistence + app state
tests/                  behaviour tests (recurrence, bulk+undo, focus blocks, notifications, DB, app smoke)
```
