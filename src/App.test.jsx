import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * These are smoke tests, not exhaustive coverage of every one of the app's
 * ~15 game screens (lobby, clue, guess, counter-guess, reveal, game-over,
 * etc.). Those screens are deeply intertwined with live Firebase listeners
 * (onValue subscriptions driving phase transitions) and are best verified
 * by actually playing the game across multiple browser sessions — see
 * README.md's "Test it locally" section — rather than by mocking that
 * entire realtime sync layer here, which would test the mocks more than
 * the app.
 *
 * What IS safely and meaningfully testable without a live backend: the
 * menu screen renders correctly, form validation behaves correctly (and
 * does so WITHOUT touching the database — these checks return early,
 * before any Firebase call), and the "create a lobby" happy path calls
 * the database with a correctly-shaped initial game state.
 */

const mockSet = vi.fn(() => Promise.resolve());
const mockGet = vi.fn(() => Promise.resolve({ exists: () => false, val: () => null }));
const mockRemove = vi.fn(() => Promise.resolve());
const mockOnDisconnectHandle = {
  remove: vi.fn(() => Promise.resolve()),
  set: vi.fn(() => Promise.resolve()),
  cancel: vi.fn(() => Promise.resolve()),
};

vi.mock("./firebase", () => ({
  db: {},
  waitForAuth: vi.fn(() => Promise.resolve({ uid: "test-uid" })),
}));

vi.mock("firebase/database", () => ({
  ref: vi.fn(() => ({})),
  set: (...args) => mockSet(...args),
  get: (...args) => mockGet(...args),
  remove: (...args) => mockRemove(...args),
  onValue: vi.fn(() => () => {}), // returns an unsubscribe fn, never fires the callback
  off: vi.fn(),
  onDisconnect: vi.fn(() => mockOnDisconnectHandle),
  serverTimestamp: vi.fn(() => ({ ".sv": "timestamp" })),
}));

// Imported AFTER the mocks above so App.jsx picks up the mocked modules.
const { default: App } = await import("./App.jsx");

describe("App — menu screen", () => {
  beforeEach(() => {
    mockSet.mockClear();
    mockGet.mockClear();
    mockRemove.mockClear();
    window.history.replaceState(null, "", "/");
    localStorage.clear();
    sessionStorage.clear();
    cleanup();
  });

  it("renders the title and the name input", () => {
    render(<App />);
    expect(screen.getByText("WAVELENGTH")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Your name...")).toBeInTheDocument();
  });

  it("renders Create Lobby and Join buttons", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: "Create Lobby" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join" })).toBeInTheDocument();
  });

  it("lets the user type their name into the input", async () => {
    const user = userEvent.setup();
    render(<App />);
    const input = screen.getByPlaceholderText("Your name...");
    await user.type(input, "Alice");
    expect(input).toHaveValue("Alice");
  });

  it("shows a validation error when creating a lobby with no name, and does NOT touch the database", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Create Lobby" }));

    expect(await screen.findByText("Enter your name!")).toBeInTheDocument();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("shows a validation error when joining with no name, and does NOT touch the database", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Join" }));

    expect(await screen.findByText("Enter your name!")).toBeInTheDocument();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("shows a validation error when joining with a name but no lobby code", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByPlaceholderText("Your name..."), "Alice");
    await user.click(screen.getByRole("button", { name: "Join" }));

    expect(await screen.findByText("Enter lobby code!")).toBeInTheDocument();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("clears a previous error once the person starts typing again", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Create Lobby" }));
    expect(await screen.findByText("Enter your name!")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Your name..."), "A");
    expect(screen.queryByText("Enter your name!")).not.toBeInTheDocument();
  });

  it("creating a lobby with a name writes a correctly-shaped initial game state and moves to the lobby screen", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByPlaceholderText("Your name..."), "Alice");
    await user.click(screen.getByRole("button", { name: "Create Lobby" }));

    // The lobby screen renders a "Start Game" (or the 2-per-team prompt)
    // once gs + screen === "lobby" are both set, confirming the create
    // flow actually completed rather than erroring out silently.
    expect(
      await screen.findByText(/Start Game|Need 2 players per team to begin/)
    ).toBeInTheDocument();

    // set() is also called by the presence heartbeat effect once the lobby
    // screen mounts, so find the call that's actually the lobby state
    // write (identified by having a `players` array) rather than assuming
    // it's the only or the first call.
    const lobbyWrite = mockSet.mock.calls.find(([, data]) => data && Array.isArray(data.players));
    expect(lobbyWrite).toBeDefined();
    const [, writtenState] = lobbyWrite;
    expect(writtenState.phase).toBe("lobby");
    expect(writtenState.scores).toEqual([0, 0]);
    expect(writtenState.players).toHaveLength(1);
    expect(writtenState.players[0]).toMatchObject({ name: "Alice", team: 0 });
    expect(writtenState.teams).toEqual(["Red Team", "Blue Team"]);
  });

  it("trims whitespace from the name before creating a lobby", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByPlaceholderText("Your name..."), "  Bob  ");
    await user.click(screen.getByRole("button", { name: "Create Lobby" }));

    await screen.findByText(/Start Game|Need 2 players per team to begin/);
    const lobbyWrite = mockSet.mock.calls.find(([, data]) => data && Array.isArray(data.players));
    expect(lobbyWrite).toBeDefined();
    expect(lobbyWrite[1].players[0].name).toBe("Bob");
  });

  it("rejects a name that is only whitespace", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByPlaceholderText("Your name..."), "   ");
    await user.click(screen.getByRole("button", { name: "Create Lobby" }));

    expect(await screen.findByText("Enter your name!")).toBeInTheDocument();
    expect(mockSet).not.toHaveBeenCalled();
  });
});
