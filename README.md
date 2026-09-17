# Wavelength 🌈

A party game for friends: one player sees a secret target on a scale (like *Hot ↔ Cold*), gives a one-word clue, and their team tries to guess where it lands. Play it in your browser — no app to install, no accounts to make.

## How to play

1. One person creates a lobby and shares the code with friends
2. Everyone splits into two teams
3. Each round, one player from the active team sees a hidden target on a spectrum (e.g. *Boring ↔ Exciting*) and gives a one-word clue
4. Their teammates try to guess where the target is
5. The other team votes which side of the guess the real target is on, for a bonus point
6. First team to 10 points wins!

## Play it

🔗 **[Play now](#)** *(add your deployed link here once you've deployed it)*

## Running it yourself

Want your own copy, hosted under your own Firebase account? You'll need:

- [Node.js](https://nodejs.org) installed
- A free [Firebase](https://firebase.google.com) account

Then:

```bash
git clone <your-repo-url>
cd wavelength
npm install
cp .env.example .env
```

Open `.env` and fill in your Firebase project's config — you'll find this in the Firebase console under **Project settings → General → Your apps**.

In the Firebase console, turn on **Authentication → Sign-in method → Anonymous**. This lets players join without creating an account.

Then, to run it on your own computer:

```bash
npm run dev
```

Or to put it online:

```bash
npm install -g firebase-tools
firebase login
firebase use --add        # pick your Firebase project
npm run build
firebase deploy
```

That's it — no paid plan required.

## Built with

React, Vite, and Firebase (Realtime Database + Authentication + Hosting).

---

Want the technical details — the test suite, or how player data is kept secure? See [`SECURITY.md`](./SECURITY.md).
