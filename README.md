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
3. To build locally, open the project with `npm run android:open`, let Android Studio install its Gradle/SDK components, then build or run the `app` configuration. A debug APK can also be built with `cd android; .\gradlew.bat assembleDebug`; it is written to `android/app/build/outputs/apk/debug/app-debug.apk`.
4. GitHub Actions builds the debug APK on pushes and pull requests targeting `main`, or on demand from **Actions → Build Android APK → Run workflow**. Download `daybloom-debug-apk` from the completed workflow run's **Artifacts** section.
5. Install the APK on an Android phone, launch Daybloom, and use **Settings → Scheduled notifications** to grant notification permission and **Alarms & reminders** access. Android exact alarms are required; reminders are not silently downgraded to inexact alarms if access is denied.
6. In **Settings → Sounds**, use **Schedule a 2-minute notification test** to check an exact wake-up alarm while the phone is locked. The test uses the activity-start sound. For the other sounds, use their **Play** previews.
7. For Realme phones, allow Daybloom notifications and sound in **Settings → Notifications & status bar → App notifications → Daybloom**. Also check **Settings → Battery → App battery management** (or **App battery usage**). If available, enable **Auto launch** and **Background activity** separately from choosing unrestricted battery use; unrestricted battery use alone may not override Realme's background controls. Menu names vary by device. These vendor settings can still affect delivery; they do not replace exact-alarm and notification permissions.

Android notifications use three generated mono PCM WAV sounds (`hourly.wav`, `start.wav`, and `end.wav`) in `android/app/src/main/res/raw/`. Android 8+ uses versioned channels `daybloom-v2-hourly`, `daybloom-v2-start`, and `daybloom-v2-end` at high importance; older `daybloom-*` channels are left untouched because Android does not let apps change a channel's sound after creation. Check that the corresponding Daybloom v2 channel is enabled and has its custom sound in Android's app-notification settings. Native alert loudness follows the phone's notification volume (the app volume sliders control Web Audio previews).

Capacitor's Local Notifications plugin schedules native `AlarmManager` alarms, handles exact-alarm and notification permissions, and restores pending notifications after boot. Daybloom's mandatory exact reminders use Android's alarm-clock priority (`setAlarmClock`) to improve delivery during idle; the system may show Daybloom as the next alarm and opening that system alarm can launch Daybloom. The app still refreshes a rolling schedule of up to 450 upcoming alarms on launch/resume and updates or cancels them after activity edits, deletions, undo/redo, and imports. Alarm receiver diagnostics are logged with the `DaybloomAlarm` tag (scheduled target, actual fire time/delay, channel sound, and post time); JavaScript also logs schedule and permission/channel checks while the app is running. On Android 12+, grant **Alarms & reminders**; on Android 13+, grant notification permission. The plugin manifest contributes `SCHEDULE_EXACT_ALARM`, `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`, and its alarm and boot receivers to the merged app manifest. Exact access can be revoked by Android, and force-stopping the app or device-specific battery controls can still prevent delivery. This alarm-clock priority is an improvement attempt, not a guarantee against vendor firmware restrictions; reminders are not emergency alerts. Opening Daybloom refills the future queue; later alarms beyond the current queue cannot be restored while the app remains closed.

**Realme device test:** install the newly built APK and launch Daybloom once. Grant notifications and **Alarms & reminders**, then verify all three Daybloom v2 channels are enabled and have sound. In **Settings → Sounds**, schedule the two-minute test and keep the screen on to verify delivery; schedule it again, press Home, lock the screen, and wait two minutes. Repeat after dismissing Daybloom from Recents (do not use Android **Force stop**). To verify task reconciliation, create a future activity, change its start time and confirm only the new time fires, then delete it and confirm no reminder fires; create a recurring activity and confirm the next occurrence is scheduled. For reboot recovery, schedule a reminder several minutes ahead, reboot, unlock the phone, and wait for it. In Android Studio Logcat, filter by `DaybloomAlarm` to compare scheduled, fired, and posted timestamps. Realme settings vary by model/version; if present, allow Daybloom **Auto launch**, **Background activity**, and unrestricted/allowed battery use in App management/Battery settings. Realme's background controls can still affect delivery; auto-launch or battery exemptions do not replace exact-alarm or notification permissions.

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
