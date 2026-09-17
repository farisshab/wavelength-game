// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase, connectDatabaseEmulator } from "firebase/database";
import { getAuth, signInAnonymously, onAuthStateChanged, connectAuthEmulator } from "firebase/auth";

// Your web app's Firebase configuration.
// These values are NOT secret — they identify your Firebase project to the
// browser SDK and are always visible in the shipped JS bundle, .env or not.
// Real security comes from database.rules.json + Cloud Functions, not from
// hiding these. They live in .env purely so you can swap projects (e.g. a
// separate dev project) without editing source, and to keep config out of
// git history as a matter of hygiene.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);

// Point the SDKs at the local Firebase Emulator Suite during `npm run dev`
// when VITE_USE_EMULATORS=true is set (see .env.example). Never used in the
// deployed build.
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === "true") {
  connectDatabaseEmulator(db, "127.0.0.1", 9000);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
}

/* ─── Anonymous auth gate ───
 * database.rules.json requires `auth != null` for every read and write.
 * There's no login screen — every visitor is silently signed in anonymously
 * so the database has a real auth session (and therefore a stable, spoof-
 * resistant `auth.uid`) to check writes against, instead of trusting
 * anyone who merely knows a 6-character lobby code with zero authentication
 * at all, which is the setup this project started with.
 *
 * `waitForAuth()` resolves once that sign-in completes. Every function in
 * App.jsx that touches the database awaits it first, so no read/write can
 * ever race the sign-in call and hit a permission-denied error.
 */
let resolveAuthReady;
const authReadyPromise = new Promise((resolve) => { resolveAuthReady = resolve; });

onAuthStateChanged(auth, (user) => {
  if (user) resolveAuthReady(user);
});

signInAnonymously(auth).catch((err) => {
  console.error("Anonymous sign-in failed — reads/writes will be denied until this succeeds:", err);
});

export function waitForAuth() {
  return authReadyPromise;
}
