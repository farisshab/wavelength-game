import { describe, it, expect } from "vitest";
import {
  SPECTRUMS,
  genId,
  genLobbyCode,
  pickUnusedSpectrum,
  averageGuesses,
  calculateGuessPoints,
  resolveCounterVoteDirection,
  counterGuessOutcome,
  isPresenceAlive,
  pickSmallerTeam,
  hasTeamReachedWinningScore,
  isGameOver,
  determineWinner,
} from "./gameLogic";

describe("SPECTRUMS", () => {
  it("is a non-empty array of [left, right] string pairs", () => {
    expect(Array.isArray(SPECTRUMS)).toBe(true);
    expect(SPECTRUMS.length).toBeGreaterThan(0);
    for (const pair of SPECTRUMS) {
      expect(Array.isArray(pair)).toBe(true);
      expect(pair).toHaveLength(2);
      expect(typeof pair[0]).toBe("string");
      expect(typeof pair[1]).toBe("string");
      expect(pair[0].length).toBeGreaterThan(0);
      expect(pair[1].length).toBeGreaterThan(0);
    }
  });

  it("has no exact duplicate pairs", () => {
    const keys = SPECTRUMS.map((s) => s.join("|"));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("genId", () => {
  it("returns a non-empty string", () => {
    const id = genId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("returns different values across calls (collision-unlikely)", () => {
    const ids = new Set(Array.from({ length: 50 }, () => genId()));
    expect(ids.size).toBe(50);
  });
});

describe("genLobbyCode", () => {
  it("returns an uppercase alphanumeric string", () => {
    const code = genLobbyCode();
    expect(code).toMatch(/^[A-Z0-9]+$/);
  });

  it("returns different values across calls (collision-unlikely)", () => {
    const codes = new Set(Array.from({ length: 50 }, () => genLobbyCode()));
    expect(codes.size).toBe(50);
  });
});

describe("pickUnusedSpectrum", () => {
  it("returns a spectrum from the full pool when nothing has been used", () => {
    const result = pickUnusedSpectrum([], () => 0);
    expect(result).toEqual(SPECTRUMS[0]);
  });

  it("defaults to an empty used list when none is given", () => {
    const result = pickUnusedSpectrum(undefined, () => 0);
    expect(result).toEqual(SPECTRUMS[0]);
  });

  it("never returns a spectrum that's already in the used list", () => {
    // Exhaustively pick with a fixed "always pick index 0 of what's left"
    // random function, and confirm we visit every spectrum exactly once
    // before any repeat.
    const used = [];
    const seen = new Set();
    for (let i = 0; i < SPECTRUMS.length; i++) {
      const next = pickUnusedSpectrum(used, () => 0);
      const key = next.join("|");
      expect(seen.has(key)).toBe(false); // no repeat until pool exhausted
      seen.add(key);
      used.push(next);
    }
    expect(seen.size).toBe(SPECTRUMS.length);
  });

  it("falls back to the full pool once every spectrum has been used", () => {
    const allUsed = SPECTRUMS;
    // With every spectrum "used", the available pool is empty, so it must
    // fall back to picking from the full SPECTRUMS array rather than
    // throwing or returning undefined.
    const result = pickUnusedSpectrum(allUsed, () => 0);
    expect(SPECTRUMS).toContainEqual(result);
  });

  it("respects the injected random function for pool selection", () => {
    const usedKeys = new Set([SPECTRUMS[0].join("|")]);
    const available = SPECTRUMS.filter((s) => !usedKeys.has(s.join("|")));
    // randomFn returning ~1 should select the last item in the available pool
    const result = pickUnusedSpectrum([SPECTRUMS[0]], () => 0.999999);
    expect(result).toEqual(available[available.length - 1]);
  });
});

describe("averageGuesses", () => {
  it("averages a list of guesses", () => {
    expect(averageGuesses([0, 90, 180])).toBe(90);
    expect(averageGuesses([10, 20])).toBe(15);
  });

  it("returns a single value unchanged", () => {
    expect(averageGuesses([42])).toBe(42);
  });

  it("falls back to 90 (dial midpoint) when there are no guesses", () => {
    expect(averageGuesses([])).toBe(90);
  });

  it("falls back to 90 when given null or undefined", () => {
    expect(averageGuesses(null)).toBe(90);
    expect(averageGuesses(undefined)).toBe(90);
  });

  it("handles decimal averages correctly", () => {
    expect(averageGuesses([1, 2])).toBeCloseTo(1.5);
  });
});

describe("calculateGuessPoints", () => {
  it("awards 4 points for an exact match", () => {
    expect(calculateGuessPoints(90, 90)).toBe(4);
  });

  it("awards 4 points at the edge of the bullseye zone (diff === 4)", () => {
    expect(calculateGuessPoints(94, 90)).toBe(4);
    expect(calculateGuessPoints(86, 90)).toBe(4);
  });

  it("awards 3 points just outside the bullseye zone (diff === 4.01 to 11)", () => {
    expect(calculateGuessPoints(94.5, 90)).toBe(3);
    expect(calculateGuessPoints(101, 90)).toBe(3); // diff === 11, edge
  });

  it("awards 2 points in the outer scoring zone (diff 11.01 to 18)", () => {
    expect(calculateGuessPoints(102, 90)).toBe(2);
    expect(calculateGuessPoints(108, 90)).toBe(2); // diff === 18, edge
  });

  it("awards 0 points outside every scoring zone", () => {
    expect(calculateGuessPoints(109, 90)).toBe(0); // diff === 19, just outside
    expect(calculateGuessPoints(180, 0)).toBe(0);
  });

  it("is symmetric — direction of the miss doesn't matter", () => {
    expect(calculateGuessPoints(85, 90)).toBe(calculateGuessPoints(95, 90));
    expect(calculateGuessPoints(70, 90)).toBe(calculateGuessPoints(110, 90));
  });

  it("handles a target at the very edge of the dial (0 or 180)", () => {
    expect(calculateGuessPoints(0, 0)).toBe(4);
    expect(calculateGuessPoints(180, 180)).toBe(4);
    expect(calculateGuessPoints(4, 0)).toBe(4);
  });
});

describe("resolveCounterVoteDirection", () => {
  it("picks 'left' when left votes outnumber right", () => {
    expect(resolveCounterVoteDirection(3, 1)).toBe("left");
  });

  it("picks 'right' when right votes outnumber left", () => {
    expect(resolveCounterVoteDirection(1, 3)).toBe("right");
  });

  it("breaks a 0-0 tie using the injected random function", () => {
    expect(resolveCounterVoteDirection(0, 0, () => 0)).toBe("left");
    expect(resolveCounterVoteDirection(0, 0, () => 0.999999)).toBe("right");
  });

  it("breaks a nonzero tie using the injected random function", () => {
    expect(resolveCounterVoteDirection(2, 2, () => 0.1)).toBe("left");
    expect(resolveCounterVoteDirection(2, 2, () => 0.9)).toBe("right");
  });

  it("defaults to Math.random when no random function is given (returns a valid direction)", () => {
    const result = resolveCounterVoteDirection(0, 0);
    expect(["left", "right"]).toContain(result);
  });
});

describe("counterGuessOutcome", () => {
  it("says the target was to the left when it's a lower angle than the guess", () => {
    const { actualDirection } = counterGuessOutcome(30, 90, "left");
    expect(actualDirection).toBe("left");
  });

  it("says the target was to the right when it's a higher angle than the guess", () => {
    const { actualDirection } = counterGuessOutcome(150, 90, "right");
    expect(actualDirection).toBe("right");
  });

  it("reports actualDirection as null when target and guess are identical", () => {
    const { actualDirection, correct } = counterGuessOutcome(90, 90, "left");
    expect(actualDirection).toBeNull();
    expect(correct).toBe(false); // can't be "correct" about a non-existent direction
  });

  it("is correct when the guessed direction matches the actual direction", () => {
    expect(counterGuessOutcome(30, 90, "left").correct).toBe(true);
    expect(counterGuessOutcome(150, 90, "right").correct).toBe(true);
  });

  it("is incorrect when the guessed direction doesn't match", () => {
    expect(counterGuessOutcome(30, 90, "right").correct).toBe(false);
    expect(counterGuessOutcome(150, 90, "left").correct).toBe(false);
  });
});

describe("isPresenceAlive", () => {
  const now = 1_000_000;

  it("is alive when online and heartbeat is recent", () => {
    expect(isPresenceAlive({ online: true, lastSeen: now - 1000 }, now)).toBe(true);
  });

  it("is not alive when online is false", () => {
    expect(isPresenceAlive({ online: false, lastSeen: now - 1000 }, now)).toBe(false);
  });

  it("is not alive when the heartbeat is exactly at the timeout boundary", () => {
    expect(isPresenceAlive({ online: true, lastSeen: now - 60000 }, now, 60000)).toBe(false);
  });

  it("is alive one millisecond inside the timeout boundary", () => {
    expect(isPresenceAlive({ online: true, lastSeen: now - 59999 }, now, 60000)).toBe(true);
  });

  it("respects a custom timeout window", () => {
    expect(isPresenceAlive({ online: true, lastSeen: now - 5000 }, now, 3000)).toBe(false);
    expect(isPresenceAlive({ online: true, lastSeen: now - 2000 }, now, 3000)).toBe(true);
  });

  it("is not alive when lastSeen is missing", () => {
    expect(isPresenceAlive({ online: true }, now)).toBe(false);
  });

  it("is not alive for a null/undefined entry", () => {
    expect(isPresenceAlive(null, now)).toBe(false);
    expect(isPresenceAlive(undefined, now)).toBe(false);
  });

  it("is not alive when online is truthy but not exactly `true`", () => {
    // Guards against someone writing online: "true" (a string) or online: 1
    expect(isPresenceAlive({ online: "true", lastSeen: now - 1000 }, now)).toBe(false);
    expect(isPresenceAlive({ online: 1, lastSeen: now - 1000 }, now)).toBe(false);
  });
});

describe("pickSmallerTeam", () => {
  it("picks team 0 when it has fewer players", () => {
    const players = [{ team: 1 }, { team: 1 }, { team: 0 }];
    expect(pickSmallerTeam(players)).toBe(0);
  });

  it("picks team 1 when it has fewer players", () => {
    const players = [{ team: 0 }, { team: 0 }, { team: 1 }];
    expect(pickSmallerTeam(players)).toBe(1);
  });

  it("picks team 0 on a tie", () => {
    const players = [{ team: 0 }, { team: 1 }];
    expect(pickSmallerTeam(players)).toBe(0);
  });

  it("picks team 0 when there are no players yet", () => {
    expect(pickSmallerTeam([])).toBe(0);
    expect(pickSmallerTeam(undefined)).toBe(0);
  });

  it("ignores spectators (team: -1) when balancing", () => {
    const players = [{ team: -1 }, { team: -1 }, { team: 0 }];
    // team 0 has 1, team 1 has 0 -> team 1 is smaller
    expect(pickSmallerTeam(players)).toBe(1);
  });
});

describe("hasTeamReachedWinningScore", () => {
  it("is false when both teams are below 10", () => {
    expect(hasTeamReachedWinningScore([5, 9])).toBe(false);
  });

  it("is true right at the threshold (10)", () => {
    expect(hasTeamReachedWinningScore([10, 0])).toBe(true);
    expect(hasTeamReachedWinningScore([0, 10])).toBe(true);
  });

  it("is true above the threshold", () => {
    expect(hasTeamReachedWinningScore([14, 2])).toBe(true);
  });

  it("is true when both teams have reached it", () => {
    expect(hasTeamReachedWinningScore([11, 12])).toBe(true);
  });
});

describe("isGameOver", () => {
  it("is false if no team has reached the winning score, even with equal turns", () => {
    expect(isGameOver([5, 5], { 0: 3, 1: 3 })).toBe(false);
  });

  it("is false if a team has won but turns are unequal (trailing team gets their turn)", () => {
    expect(isGameOver([10, 4], { 0: 5, 1: 4 })).toBe(false);
  });

  it("is true once a team has won AND turns are equal", () => {
    expect(isGameOver([10, 4], { 0: 5, 1: 5 })).toBe(true);
  });

  it("treats a missing teamTurnCount as 0-0 (equal)", () => {
    expect(isGameOver([10, 0], undefined)).toBe(true);
    expect(isGameOver([10, 0], null)).toBe(true);
  });

  it("treats missing individual team counts as 0", () => {
    expect(isGameOver([10, 0], { 0: 0 })).toBe(true); // team 1 count missing -> 0, equal to team 0's 0
    expect(isGameOver([10, 0], { 1: 2 })).toBe(false); // team 0 count missing -> 0, team 1 is 2, unequal
  });
});

describe("determineWinner", () => {
  it("declares team 0 the winner when they have more points", () => {
    expect(determineWinner([12, 8])).toBe(0);
  });

  it("declares team 1 the winner when they have more points", () => {
    expect(determineWinner([8, 12])).toBe(1);
  });

  it("returns -1 on a tie", () => {
    expect(determineWinner([10, 10])).toBe(-1);
    expect(determineWinner([0, 0])).toBe(-1);
  });
});
