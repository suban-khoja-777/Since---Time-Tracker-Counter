# Since — timers & counters

A working web app and Android PWA, plus a native Android Trusted Web Activity project. Account data lives in Cloudflare D1 and is scoped to the signed-in ChatGPT user. The first deployment is private to its owner; it is not a public multi-user launch.

## What works

- Create, switch, rename and delete workspaces; keep at least one.
- Create and rename folders. Removing a folder keeps its timers; deleting a workspace removes its contents.
- Compact days-since and days-until cards on a clean white surface, with no timer icons.
- 30 bright card colors plus a custom color picker and hex input. Older preset colors still work.
- Switch between cards and list rows; toggle each card independently between timer and counter.
- Create labels in the collapsible sidebar, then assign them to timers or use them as search filters.
- Download CSV or JSON for a selected workspace or the whole account, including reset history, folders and labels. CSV cells escape spreadsheet formulas and preserve Unicode, quotes and line breaks.
- Multiple labels per timer; search titles, notes and labels, including `#health`.
- Opt into a counter when defining a days-since timer; switch between timer and counter card views.
- Record resets with a chosen date/time and note; inspect and remove mistaken events.
- Counters start at zero and equal the number of recorded reset events. Editing a timer does not add a reset. Disabling the counter hides it and keeps its events.
- The elapsed timer uses the most recent event timestamp, falling back to its initial start. A backdated event increases the counter but never moves the timer behind a newer event.
- Reject future resets and resets before the initial start; completed countdowns stop at zero.
- Duplicate submission identifiers do not increment counters twice.
- Refresh on focus/connection recovery and every 15 seconds while the app is visible. Saves refresh immediately. Timers tick locally every second; an internet connection is required to load and save records.

### Fast-food example

Create **Fast food**, choose **Days since**, enter an initial date and enable **Include a counter card**. It starts at **0 times**. Choose **Log & reset**, enter when you ate it, and save. The counter becomes **1**, and the timer runs from that event time. Creating the timer itself does not count as eating fast food.

## Run locally

Requires Node.js 22.13 or newer. From this directory:

```powershell
npm ci
npm run db:generate
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_numerous_wilson_fisk.sql
npm run dev
```

Apply the initial migration only once to a fresh local database. On this Windows host, the installed `npm.cmd` shim failed when launched by a child process; running `node 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js' <npm arguments>` works. This is a host tooling workaround, not an application dependency.

Local previews simulate a test identity at `/signin-with-chatgpt?return_to=/`. Mock identity is excluded from production. Hosted pages use dispatch-owned ChatGPT sign-in; the server verifies ownership for every query and mutation. Data is never cached by the service worker or stored in localStorage.

## Checks

```powershell
node node_modules/typescript/bin/tsc --noEmit
node --test tests/timers.test.ts
node --test tests/export.test.ts
node tests/api.mjs
node tests/export-api.mjs
node tests/isolation.mjs
npm run build
```

API checks require the local preview and migrated database. They create and remove their own test fixtures. The isolation test additionally uses Wrangler against the local database; never run these tests against production.

## Android

Open the deployed app in Chrome on Android, sign in, then use the browser’s **Install app** or **Add to home screen** option. Installation availability depends on the browser. This provides the same responsive interface and account storage as the web app. Network access is required; an offline page explains when the app cannot connect.

The `android/` directory contains a Gradle project using Google’s Android Browser Helper. It launches the same hosted app using a Trusted Web Activity, sharing the browser’s authenticated session instead of embedding credentials in a WebView. It falls back to a Custom Tab until origin verification is configured. See [Google’s TWA guide](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start).

Open `android/` in Android Studio with JDK 17, Android SDK 36 and Build Tools 35.0.0. AGP 8.13 requires Gradle 8.13 and JDK 17 ([compatibility reference](https://developer.android.com/build/releases/agp-8-13-0-release-notes)). Build with `./gradlew.bat assembleDebug`; the expected APK is `android/app/build/outputs/apk/debug/app-debug.apk`.

**The native project has not been built or run on a device.** The authoring machine only has Java 8 and no Android SDK, so no APK is included. Before native release, configure your signing key, publish its SHA-256 certificate fingerprint in a publicly accessible `/.well-known/assetlinks.json`, validate sign-in on a real device and complete store packaging. A private owner-only Site may block anonymous asset-link verification, so a verified public origin/access arrangement is needed for full-screen TWA mode. The Gradle wrapper is downloaded from the official Gradle v8.13.0 repository; no signing keys are generated or committed.

## Source

- `app/tracker.tsx`: responsive UI and shared visible search action.
- `app/api/tracker/route.ts`: authenticated API and ownership checks.
- `lib/timers.ts`: elapsed-time and search logic.
- `lib/validation.ts`: input and date validation.
- `app/api/export/route.ts` and `lib/export.ts`: authenticated export and CSV serialization.
- `db/schema.ts` and `drizzle/`: durable storage schema and migrations.
- `android/`: native browser-backed Android project.

This is an online first version. It does not include email/password sign-in, offline write queues, team collaboration, notifications or Android widgets.

Lifecycle timers: disable **Allow resets** to track one lifetime. The optional end date freezes the elapsed duration once reached; status becomes Closed. Future starts show Future and count down to activation. Existing timers keep resets enabled. Disabling resets preserves event history and measures duration from the initial start. Countdown timers are Active until their target, then Closed. List view shows name, all labels, lifecycle status and elapsed timer; tap the name for actions and details.

Lifecycle API verification: `node tests/lifecycle-api.mjs` (local preview only).
