# logpose-app

Frontend for **Logpose**, a personal life-tracking app. The name is a One Piece reference — the Log Pose is the navigation instrument that records every island you visit.

## What it is

A user interface on two platforms that share the same data via sync with `logpose-api`:

- **Desktop** — native Linux app built with React + Tauri 2
- **Mobile** — Android app built with React Native + Expo (standalone APK)

## Stack

| Platform | Technology |
|---|---|
| Desktop | React 19 · Vite · Tauri 2 · `@tauri-apps/plugin-sql` |
| Mobile | React Native 0.81 · Expo 54 · `expo-sqlite` |

## Modules

| Module | Desktop | Mobile | Description |
|---|---|---|---|
| Body Weight | ✅ | ✅ | Weight log with evolution chart and date filter |
| Gym | ✅ | ✅ | Weekly routines, exercise catalogue, set logging (weight + reps), progression chart |
| Calendar | ✅ | ✅ | Day/week/month views, events with daily/weekly recurrence, integration with gym days |
| Tasks | ✅ | ✅ | Task lists with items, completed state |
| Journal | ✅ | ✅ | Daily entry, consecutive-day streak, history |
| Quotes | ✅ | ✅ | Motivational quotes with author, a random one shown on Home |
| Home | ✅ | ✅ | Greeting, date and quote of the day |
| Settings | ✅ | ✅ | Visual theme (Normal / Warm / Old TV / Pixel / Cuphead), dark/light mode, language (ES/EN) |

## Local-first architecture

Every screen works offline. Each record in SQLite has three control fields:

- `server_id` — id on the server (null if not yet synced)
- `synced` — 0/1
- `pending_delete` — 1 if marked for deletion on the server

The sync cycle runs when entering each screen: push deletes → push unsynced → pull server → prune stale. If the server doesn't respond within 3 seconds it's skipped silently and local data remains the source of truth.

## Repo structure

```
logpose-app/           — desktop app (React + Tauri)
  src/
    App.jsx            — sidebar + routing
    db/database.js     — local SQLite: tables, CRUD and sync helpers
    api/client.js      — HTTP calls to logpose-api with a 3s timeout
    *.jsx              — one screen per module
    translations/      — strings in ES and EN
logpose-mobile/        — mobile app (React Native + Expo)
  src/
    screens/           — one screen per module
    db/database.js     — local SQLite (expo-sqlite): same logic as desktop
    api/client.js      — HTTP calls (server at archlinux.local:8000)
    ThemeContext.js    — theme persisted in AsyncStorage
    LangContext.js     — language persisted in AsyncStorage
```

## Running in development

```bash
# Desktop — requires Tauri for native SQLite access
cd logpose-app && npx tauri dev

# Mobile
cd logpose-mobile && npx expo start
```

Requires `logpose-api` running with `--host 0.0.0.0` on the same network.

Desktop uses `localhost:8000`. Mobile discovers the server via mDNS (`archlinux.local:8000`).

## Building

```bash
# Desktop — native Linux binary
cd logpose-app && npx tauri build
# Binary: src-tauri/target/release/app

# Mobile — standalone APK (no Expo Go)
cd logpose-mobile && eas build --platform android --profile preview
```
