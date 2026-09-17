# Wavelength

A browser-based party game (inspired by the board game *Wavelength*): one player sees a hidden target on a spectrum (e.g. *Hot ↔ Cold*), gives a one-word clue, and their team tries to guess where it falls.

Built with React + Vite on the frontend, and Firebase (Realtime Database, Anonymous Auth, Hosting) as the backend.

## Stack

- **Frontend:** React 19 + Vite, single-page app, no router
- **Realtime sync:** Firebase Realtime Database (lobby state, presence, live game state)
- **Auth:** Firebase Anonymous Auth (silent — no login screen; every visitor gets a session)
- **Hosting:** Firebase Hosting, serving the Vite build output

There's no Cloud Functions dependency in this version, which means it runs entirely on Firebase's free **Spark** plan — no billing account or credit card required. (An earlier version of this project used one Cloud Function for server-validated analytics logging; analytics has been removed for now specifically to avoid that requirement. See "Analytics was removed" below if you want it back.)

## Setup

```bash
npm install
```

Copy `.env.example` to `.env` and fill in your Firebase project's web app config (Firebase console → Project settings → General → Your apps → SDK setup and configuration):

```bash
cp .env.example .env
```

> These values (`apiKey`, `projectId`, etc.) are **not secrets** — see the Security model section below for why, and why they're safe to have in a local `.env` even though that file is gitignored.

You'll also need the Firebase CLI, and to be logged into the Firebase account that owns this project:

```bash
npm install -g firebase-tools
firebase login
```

**In the Firebase console, enable Anonymous sign-in:** Authentication → Sign-in method → Anonymous → Enable. Without this, every read/write in the app will fail with `auth/configuration-not-found`, because `database.rules.json` requires a live auth session for all access.

## Test it locally before deploying

Don't point local development at your real, live database — use the **Firebase Emulator Suite**, which spins up a local Auth and Realtime Database on your machine. Nothing you do locally touches production data or your Firebase usage quota.

**1. Start the emulators** (in one terminal):

```bash
firebase emulators:start
```

This opens the Emulator UI at `http://localhost:4000`, where you can watch database writes happen live and inspect signed-in (anonymous) users.

**2. Point the app at the emulators.** In your `.env`, set:

```
VITE_USE_EMULATORS=true
```

**3. Start the frontend** (in a second terminal):

```bash
npm run dev
```

Open the app, create a lobby, join it from a second browser tab (or a private/incognito window, so it gets its own anonymous session), and play through a round. Check the Emulator UI to confirm an anonymous user was created for each tab and that `lobbies/{code}` and `presence/{code}` are being written.

When you're done testing, set `VITE_USE_EMULATORS` back to `false` (or just unset it) before running `npm run dev` against your real project.

## Deploying

```bash
npm run build
firebase deploy
```

This deploys the built frontend to Hosting and `database.rules.json` to your Realtime Database, in one command — no Blaze plan needed. You can also deploy pieces individually: `firebase deploy --only hosting` or `--only database`.

## Analytics was removed

The previous version of this project logged visits, presence, and game starts to `analytics/*` in the database. That required routing one write (`analytics/games`) through a Cloud Function for server-side validation, which in turn required upgrading the Firebase project to the Blaze (pay-as-you-go) plan — Cloud Functions can't run on the free Spark plan.

To keep this version deployable on Spark with no billing account, analytics has been removed entirely: the tracking functions, their call sites, the `analytics` rules, and the Cloud Function are all gone. The game itself is unaffected — analytics was never part of the game logic, only a side-channel for usage stats.

If you want it back later, the pattern to bring back is: any per-user data (visits, presence) can be scoped directly to `auth.uid` in the rules and written by the client; anything that needs real server-side validation (like a trustworthy count of game starts) needs a Cloud Function, which means Blaze. That tradeoff is now yours to make deliberately, rather than something the app forces on you.

## Security model

This section is here deliberately — if you're evaluating whether this is safe to run publicly, this is the honest answer.

### What's protected

| Risk | Status | How |
|---|---|---|
| Anyone, unauthenticated, scripting direct writes to any lobby | **Closed** | Every read and write requires a live Firebase Auth session (`auth != null` in `database.rules.json`). The app signs every visitor in anonymously on load — no login screen, but no more fully anonymous, no-session access either. |
| Open, uncapped writes to an `analytics` node by literally anyone, no lobby code needed | **N/A — removed** | The `analytics` node and everything that wrote to it (client code, rules, the Cloud Function) has been removed entirely. There's nothing left to abuse. |
| A client writing malformed or oversized junk into a lobby | **Partially closed** | `.validate` rules still only check that required fields exist, not their types/sizes — see below. |

### What's *not* fully protected, and why that's an acceptable tradeoff here

**A player who has joined a lobby can still write fabricated state to it** — set their own score, claim a clue they didn't give, force a phase change — by calling the Realtime Database SDK directly from devtools, bypassing the app's UI entirely. Requiring auth stops a stranger with no session from touching a lobby; it does **not** stop a legitimate, signed-in player from lying about their own game state, because the client still has direct write access to `lobbies/{code}`.

Closing that completely means removing the client's database write access altogether and routing every game action (submit clue, submit guess, resolve counter-guess, change teams, etc.) through server-validated Cloud Functions that hold the real database credentials. That's a legitimate next step, but it means re-implementing all of the game's turn logic, scoring, and host/team assignment (currently ~1,000+ lines of client code) as server-side functions — real, careful work deserving its own dedicated pass with proper testing across real multi-player sessions, and it would also require the Blaze plan.

For a casual party game played with friends over a shared room code — no accounts, no persistent identity, no money or real stakes involved — the actual damage a cheating player could do is: ruin their own group's game. That's a low-severity, self-contained risk, and it's the deliberate scope boundary for this version. If this app ever grows real stakes (rankings, accounts, prizes), that's the point to invest in the full server-authoritative rewrite (and in Blaze).

**`.validate` rules check shape, not full correctness.** A signed-in user could still write a lobby with an oversized `players` array or junk fields — annoying, not dangerous, and bounded by the fact that they need a live auth session to do it at all now.

### Reasonable next steps, if you want to raise the bar further

- **Firebase App Check** — blocks traffic that isn't coming from your actual deployed app (e.g. a script calling the Auth/Database REST APIs directly with the public config), even from a valid anonymous session. Not implemented here because it requires its own reCAPTCHA/App Check setup in the Firebase console tied to your specific project.
- **Server-authoritative game engine** — as described above, the real fix for in-lobby tampering. Requires Blaze.
- **Firebase Realtime Database usage alerts** — set a budget alert in the Google Cloud Console so unexpected spikes in reads/writes (abuse or otherwise) notify you before they become a surprise bill, if you upgrade to Blaze for any reason later.

### The Firebase config is not a secret, on purpose

`firebaseConfig` in `src/firebase.js` (apiKey, projectId, etc.) is loaded from `.env`, which is gitignored — but that's for hygiene, not secrecy. These values are baked into the shipped JS bundle regardless of where they're stored, and are visible to anyone via view-source or the network tab. That's expected and fine: they identify your Firebase project to the browser SDK, they don't grant any access by themselves — `database.rules.json` is what actually gates access. If you fork this project, generate your **own** Firebase project's config rather than reusing the one that ships here.
