# Technical details

This file has the reasoning behind how this project is built — useful if you're evaluating it for security, contributing to it, or just curious. Casual visitors probably just want the [README](./README.md).

## Stack

- **Frontend:** React 19 + Vite, single-page app, no router
- **Realtime sync:** Firebase Realtime Database (lobby state, presence, live game state)
- **Auth:** Firebase Anonymous Auth (silent — no login screen; every visitor gets a session)
- **Hosting:** Firebase Hosting, serving the Vite build output

No Cloud Functions in this version — it runs entirely on Firebase's free Spark plan, no billing account required. See "Analytics was removed" below for why.

## Automated tests

```bash
npm test              # watch mode
npm run test:run      # single run (what CI would do)
npm run test:coverage # single run + coverage report
```

Tests are split by what they can honestly verify without a live backend:

- **`src/gameLogic.test.js`** — the pure game logic (scoring thresholds, spectrum selection, team balancing, presence timeouts, win conditions) lives in `src/gameLogic.js`, a dependency-free module with no Firebase or React in it. That separation is what makes it fully unit-testable: 58 tests, 100% statement/branch/function coverage.
- **`src/firebase.test.js`** — mocks the Firebase SDK to test that `waitForAuth()` correctly gates on the anonymous sign-in completing, without any real network calls.
- **`src/App.test.jsx`** — component-level smoke tests for the menu screen: rendering, form validation (and confirming validation failures never touch the database), and the "create a lobby" happy path writing a correctly-shaped initial game state.

**What isn't covered, and why:** `App.jsx` is a single ~2,000-line component with roughly 15 game screens (lobby, clue-giving, guessing, counter-guess voting, reveal, game-over, etc.), all driven by live Firebase Realtime Database listeners reacting to what other players do. Testing those screens meaningfully would mean either mocking that entire realtime sync layer in enough detail that the tests mostly verify the mocks rather than the app, or running them against the real Emulator Suite with multiple simulated clients — a heavier, more valuable effort that deserves its own pass rather than being bolted on here. Actually playing a full round across two browser tabs against the Emulator Suite (see below) is the real coverage for that part of the app right now.

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

## Deploying to your own Firebase project

```bash
firebase use --add   # first time only — links this folder to your Firebase project
npm run build
firebase deploy
```

This deploys the built frontend to Hosting and `database.rules.json` to your Realtime Database, in one command — no Blaze plan needed. You can also deploy pieces individually: `firebase deploy --only hosting` or `--only database`.

**Note on `.firebaserc`:** this file records which Firebase project `firebase deploy` targets. It's gitignored in this repo on purpose, so cloning it doesn't accidentally point your deploys at someone else's project — run `firebase use --add` once and it'll be created for you, pointed at your own project.

## Analytics was removed

An earlier version of this project logged visits, presence, and game starts to an `analytics` node in the database. That required routing one write (game-start logging) through a Cloud Function for server-side validation, which in turn required upgrading the Firebase project to the Blaze (pay-as-you-go) plan — Cloud Functions can't run on the free Spark plan.

To keep this version deployable on Spark with no billing account, analytics has been removed entirely. The game itself is unaffected — analytics was never part of the game logic, only a side-channel for usage stats.

If you want it back later: per-user data (visits, presence) can be scoped directly to `auth.uid` in the rules and written by the client directly; anything that needs real server-side validation (like a trustworthy count of game starts) needs a Cloud Function, which means Blaze. That tradeoff is yours to make deliberately.

## Security model

This section is here deliberately — if you're evaluating whether this is safe to run publicly, this is the honest answer.

### What's protected

| Risk | Status | How |
|---|---|---|
| Anyone, unauthenticated, scripting direct writes to any lobby | **Closed** | Every read and write requires a live Firebase Auth session (`auth != null` in `database.rules.json`). The app signs every visitor in anonymously on load — no login screen, but no more fully anonymous, no-session access either. |
| Open, uncapped writes to an analytics node by literally anyone, no lobby code needed | **N/A — removed** | The analytics node and everything that wrote to it has been removed entirely. There's nothing left to abuse. |
| A client writing malformed or oversized junk into a lobby | **Partially closed** | `.validate` rules still only check that required fields exist, not their types/sizes — see below. |

### What's *not* fully protected, and why that's an acceptable tradeoff here

**A player who has joined a lobby can still write fabricated state to it** — set their own score, claim a clue they didn't give, force a phase change — by calling the Realtime Database SDK directly from devtools, bypassing the app's UI entirely. Requiring auth stops a stranger with no session from touching a lobby; it does **not** stop a legitimate, signed-in player from lying about their own game state, because the client still has direct write access to `lobbies/{code}`.

Closing that completely means removing the client's database write access altogether and routing every game action through server-validated Cloud Functions that hold the real database credentials. That's a legitimate next step, but it means re-implementing all of the game's turn logic, scoring, and host/team assignment (currently ~1,000+ lines of client code) as server-side functions — real, careful work deserving its own dedicated pass with proper testing across real multi-player sessions, and it would also require the Blaze plan.

For a casual party game played with friends over a shared room code — no accounts, no persistent identity, no money or real stakes involved — the actual damage a cheating player could do is: ruin their own group's game. That's a low-severity, self-contained risk, and it's the deliberate scope boundary for this version. If this app ever grows real stakes (rankings, accounts, prizes), that's the point to invest in the full server-authoritative rewrite (and in Blaze).

**`.validate` rules check shape, not full correctness.** A signed-in user could still write a lobby with an oversized `players` array or junk fields — annoying, not dangerous, and bounded by the fact that they need a live auth session to do it at all now.

### Reasonable next steps, if you want to raise the bar further

- **Firebase App Check** — blocks traffic that isn't coming from your actual deployed app, even from a valid anonymous session. Not implemented here because it requires its own reCAPTCHA/App Check setup in the Firebase console tied to your specific project.
- **Server-authoritative game engine** — as described above, the real fix for in-lobby tampering. Requires Blaze.
- **Firebase Realtime Database usage alerts** — set a budget alert in the Google Cloud Console so unexpected spikes in reads/writes notify you before they become a surprise bill, if you upgrade to Blaze for any reason later.

### The Firebase config is not a secret, on purpose

`firebaseConfig` in `src/firebase.js` (apiKey, projectId, etc.) is loaded from `.env`, which is gitignored — but that's for hygiene, not secrecy. These values are baked into the shipped JS bundle regardless of where they're stored, and are visible to anyone via view-source or the network tab. That's expected and fine: they identify your Firebase project to the browser SDK, they don't grant any access by themselves — `database.rules.json` is what actually gates access. If you fork this project, generate your **own** Firebase project's config rather than reusing the one that ships here.
