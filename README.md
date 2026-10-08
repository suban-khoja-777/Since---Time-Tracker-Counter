# Since — timers & counters

Firebase Authentication (Google and email/password) and Cloud Firestore now power app accounts and records. New accounts start empty, with a Personal workspace. Previous D1 data is not migrated; the legacy API returns 410 and accepts no writes. Sites hosting retains its existing owner-private audience, so its platform access gate is separate from Firebase sign-in.

## Features

Multiple workspaces, folders, sidebar labels and label search; days-since and countdown timers; optional event counters and resets; end dates and Future/Active/Closed lifecycle states; compact cards and square list rows; 30 color presets/custom colors, colored title headers with black/white text and a live preview; timer Trash with restore and permanent deletion; account/workspace CSV and JSON exports. Closed lifetime timers freeze at the end date. Reset events are transactional and idempotent. Disabling counters or resets preserves event history. Moving a timer to Trash also preserves its history; CSV/JSON exports include trashed timers and their deletion dates.

Records live at users/{firebaseUid}/{workspaces,folders,labels,timers,events}/{id}. Firestore rules allow only the authenticated owner and validate writes. No Admin key is shipped to the browser. Firebase web configuration in lib/firebase.ts is public. Network access is required; the app refreshes immediately after saves, on focus/reconnection, and every 15 seconds while visible.

## Local development

Use Node 22 or newer, npm install, and npm run dev. Use Firebase accounts in the configured project; there is no mock login. Email/password and Google must remain enabled in Firebase Authentication. The deployed domain is since-timers.suban-khoja.chatgpt.site. Firebase rules are in firestore.rules; deploy with firebase deploy --only firestore:rules --project since-tracker-app. Firestore stores structured records; no file attachments or Cloud Storage feature is needed.

## Verification

Run node --test tests/timers.test.ts tests/export.test.ts and node node_modules/typescript/bin/tsc --noEmit. The legacy API scripts cover the retired D1 implementation only. tests/firebase-integration.mjs explicitly opts into disposable Firebase accounts and checks signup/sign-in, persistence, resets, lifecycle, exports, rule enforcement and account isolation. Build its entry with .sites-runtime/build-firebase-test.mjs, then set SINCE_FIREBASE_TESTS=1 and run the test. It cleans up its own records and accounts.

## Android

Open the deployed app in Chrome on Android, sign in, then use the browser’s **Install app** or **Add to home screen** option. Installation availability depends on the browser. This provides the same responsive interface and account storage as the web app. Network access is required; an offline page explains when the app cannot connect.

The `android/` directory contains a Gradle project using Google’s Android Browser Helper. It launches the same hosted app using a Trusted Web Activity, sharing the browser’s authenticated session instead of embedding credentials in a WebView. It falls back to a Custom Tab until origin verification is configured. See [Google’s TWA guide](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start).

Open `android/` in Android Studio with JDK 17, Android SDK 36 and Build Tools 35.0.0. AGP 8.13 requires Gradle 8.13 and JDK 17 ([compatibility reference](https://developer.android.com/build/releases/agp-8-13-0-release-notes)). Build with `./gradlew.bat assembleDebug`; the expected APK is `android/app/build/outputs/apk/debug/app-debug.apk`.

**The native project has not been built or run on a device.** The authoring machine only has Java 8 and no Android SDK, so no APK is included. Before native release, configure your signing key, publish its SHA-256 certificate fingerprint in a publicly accessible `/.well-known/assetlinks.json`, validate sign-in on a real device and complete store packaging. A private owner-only Site may block anonymous asset-link verification, so a verified public origin/access arrangement is needed for full-screen TWA mode. The Gradle wrapper is downloaded from the official Gradle v8.13.0 repository; no signing keys are generated or committed.


## Source

app/firebase-account.tsx contains the sign-in/registration/reset-password screen. lib/firebase-data.ts owns Firestore operations and exports. app/tracker.tsx provides the timer interface. The Sites hosting manifest and historic D1 migrations are retained; application data no longer uses D1.
