import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * firebase.js reaches out to the real Firebase SDK the moment it's
 * imported (initializeApp, signInAnonymously, etc.), so every test here
 * mocks the SDK modules before importing firebase.js. This tests the
 * module's own logic — that waitForAuth() correctly gates on the
 * anonymous sign-in completing — without making any real network calls
 * or depending on a live Firebase project.
 */

let authStateCallback;
const mockUser = { uid: "test-uid-123" };

vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(() => ({})),
}));

vi.mock("firebase/database", () => ({
  getDatabase: vi.fn(() => ({})),
  connectDatabaseEmulator: vi.fn(),
}));

const signInAnonymously = vi.fn(() => Promise.resolve({ user: mockUser }));
const onAuthStateChanged = vi.fn((auth, cb) => {
  authStateCallback = cb;
  return () => {}; // unsubscribe function
});

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({})),
  signInAnonymously: (...args) => signInAnonymously(...args),
  onAuthStateChanged: (...args) => onAuthStateChanged(...args),
  connectAuthEmulator: vi.fn(),
}));

describe("firebase.js auth gate", () => {
  beforeEach(() => {
    vi.resetModules();
    authStateCallback = undefined;
    signInAnonymously.mockClear();
    onAuthStateChanged.mockClear();
  });

  it("calls signInAnonymously on module load", async () => {
    await import("./firebase.js");
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it("waitForAuth() does not resolve before an auth state change fires", async () => {
    const { waitForAuth } = await import("./firebase.js");
    let resolved = false;
    waitForAuth().then(() => { resolved = true; });

    // Give any pending microtasks a chance to run — it still shouldn't
    // have resolved, since onAuthStateChanged hasn't fired yet.
    await Promise.resolve();
    await Promise.resolve();
    expect(resolved).toBe(false);
  });

  it("waitForAuth() resolves once onAuthStateChanged reports a signed-in user", async () => {
    const { waitForAuth } = await import("./firebase.js");
    let resolvedUser = null;
    const promise = waitForAuth().then((u) => { resolvedUser = u; });

    expect(typeof authStateCallback).toBe("function");
    authStateCallback(mockUser); // simulate Firebase reporting the anonymous session

    await promise;
    expect(resolvedUser).toEqual(mockUser);
  });

  it("waitForAuth() ignores a null user (signed-out) callback", async () => {
    const { waitForAuth } = await import("./firebase.js");
    let resolved = false;
    waitForAuth().then(() => { resolved = true; });

    authStateCallback(null); // Firebase reports "no user yet" — should NOT resolve
    await Promise.resolve();
    await Promise.resolve();
    expect(resolved).toBe(false);

    authStateCallback(mockUser); // now the real sign-in completes
    await Promise.resolve();
    expect(resolved).toBe(true);
  });

  it("waitForAuth() called multiple times all resolve from the same sign-in", async () => {
    const { waitForAuth } = await import("./firebase.js");
    const p1 = waitForAuth();
    const p2 = waitForAuth();

    authStateCallback(mockUser);

    const [u1, u2] = await Promise.all([p1, p2]);
    expect(u1).toEqual(mockUser);
    expect(u2).toEqual(mockUser);
  });
});
