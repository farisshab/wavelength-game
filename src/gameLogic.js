/**
 * Pure game logic for Wavelength.
 *
 * Everything in this file is deliberately side-effect-free: no Firebase, no
 * React, no DOM, no dates from `new Date()` unless passed in as an argument.
 * That's what makes it unit-testable — see gameLogic.test.js — and it's why
 * this logic lives here instead of inline in App.jsx, where it would be
 * entangled with database calls and component state.
 *
 * App.jsx imports from this file rather than duplicating these formulas, so
 * there is exactly one place each rule (scoring thresholds, win condition,
 * team balancing, presence timeout) is defined.
 */

/* ─── Spectrum Data ─── */
export const SPECTRUMS = [
  // ─── Original 50 ───
  ["Hot","Cold"],["Overrated","Underrated"],["Good","Evil"],["Round","Pointy"],
  ["Boring","Exciting"],["Cheap","Expensive"],["Famous","Unknown"],["Old","Young"],
  ["Easy","Hard"],["Beautiful","Ugly"],["Safe","Dangerous"],["Loud","Quiet"],
  ["Fast","Slow"],["Sweet","Sour"],["Healthy","Unhealthy"],["Common","Rare"],
  ["Useful","Useless"],["Simple","Complex"],["Strong","Weak"],["Funny","Serious"],
  ["Real","Fictional"],["Mainstream","Niche"],["Relaxing","Stressful"],["Natural","Artificial"],
  ["Classic","Modern"],["Innocent","Guilty"],["Ordinary","Extraordinary"],["Dry","Wet"],
  ["Fragile","Durable"],["Friendly","Intimidating"],["Necessary","Luxury"],["Permanent","Temporary"],
  ["Predictable","Unpredictable"],["Public","Private"],["Romantic","Unromantic"],
  ["Scary","Not Scary"],["Smelly","Odorless"],["Soft","Hard"],["Trendy","Timeless"],
  ["Urban","Rural"],["Weird","Normal"],["Wild","Tame"],["Addictive","Forgettable"],
  ["Calming","Energizing"],["Colorful","Dull"],["Deep","Shallow"],["Elegant","Tacky"],
  ["Generous","Stingy"],["Guilty Pleasure","Openly Loved"],["Humble","Arrogant"],
  // ─── Size & Scale ───
  ["Tiny","Enormous"],["Microscopic","Cosmic"],["Lightweight","Heavy"],
  ["Narrow","Wide"],["Short","Tall"],
  // ─── Taste & Food ───
  ["Spicy","Mild"],["Savory","Sweet"],["Crunchy","Mushy"],["Gourmet","Fast Food"],
  ["Raw","Overcooked"],["Appetizing","Disgusting"],["Refreshing","Heavy"],
  // ─── Texture & Sensation ───
  ["Smooth","Rough"],["Sticky","Slippery"],["Fluffy","Dense"],["Warm","Cool"],
  ["Crispy","Soggy"],["Silky","Coarse"],
  // ─── Time & Speed ───
  ["Ancient","Futuristic"],["Instant","Eternal"],["Punctual","Fashionably Late"],
  // ─── Emotion & Mood ───
  ["Joyful","Melancholy"],["Hopeful","Cynical"],["Nostalgic","Forward-Looking"],
  ["Cozy","Unsettling"],["Euphoric","Numb"],["Sentimental","Detached"],
  ["Comforting","Disturbing"],["Peaceful","Chaotic"],
  // ─── Social & Personality ───
  ["Introverted","Extroverted"],["Rebellious","Obedient"],["Classy","Trashy"],
  ["Chill","Intense"],["Polite","Rude"],["Charming","Awkward"],
  ["Trusting","Suspicious"],["Petty","Gracious"],["Mysterious","Open Book"],
  ["Leader","Follower"],["High Maintenance","Low Maintenance"],
  // ─── Culture & Entertainment ───
  ["Indie","Blockbuster"],["Cult Classic","Crowd Pleaser"],["Binge-Worthy","Skip"],
  ["Award-Winning","Box Office Flop"],
  ["Catchy","Forgettable"],
  ["For Kids","For Adults"],["Heartwarming","Heartbreaking"],
  // ─── Aesthetics & Style ───
  ["Minimalist","Maximalist"],["Vintage","Futuristic"],["Photogenic","Unphotogenic"],
  ["Glamorous","Plain"],["Artsy","Practical"],["Polished","Raw"],
  ["Monochrome","Rainbow"],["Sleek","Bulky"],
  // ─── Intelligence & Knowledge ───
  ["Genius","Clueless"],["Book Smart","Street Smart"],["Wise","Foolish"],
  ["Logical","Emotional"],["Creative","Analytical"],["Literal","Abstract"],
  // ─── Risk & Morality ───
  ["Risky","Safe Bet"],["Legal","Illegal"],["Ethical","Sketchy"],
  ["Heroic","Villainous"],["Selfless","Selfish"],["Brave","Cowardly"],
  ["Wholesome","Cursed"],
  // ─── Nature & Environment ───
  ["Tropical","Arctic"],["Mountain","Beach"],["Desert","Rainforest"],
  ["Sunrise","Sunset"],["Calm Sea","Stormy Sea"],["Garden","Wilderness"],
  // ─── Technology & Progress ───
  ["Analog","Digital"],["High-Tech","Low-Tech"],["Innovative","Outdated"],
  ["Open Source","Proprietary"],["Automated","Handmade"],
  // ─── Daily Life ───
  ["Morning Person","Night Person"],["Overachiever","Slacker"],
  ["Homebody","Adventurer"],["Organized","Messy"],["DIY","Hire Someone"],
  ["Takeout","Home-Cooked"],["Window Seat","Aisle Seat"],
  ["Road Trip","Flight"],["Spontaneous","Planned"],
  // ─── Abstract & Philosophical ───
  ["Temporary Fix","Permanent Solution"],["Overblown","Understated"],
  ["Mainstream Hit","Hidden Gem"],["Overhyped","Slept On"],
  ["Cringe","Based"],["Mid","Peak"],["Cursed","Blessed"],
  ["Main Character","Background Extra"],["Canon","Fanfiction"],
  ["Touch Grass","Chronically Online"],["W","L"],
  ["Slay","Flop"],["Core Memory","Forgotten"],
  // ─── Custom ───
  ["Good Person", "Bad Person"], ["Green Flag", "Red Flag"], ["Worth the Money", "Total Ripoff"]
];

/** Random id for a player (not a security identifier — see App.jsx/README). */
export function genId() {
  return Math.random().toString(36).slice(2, 10);
}

/** Random 6-character lobby/room code. */
export function genLobbyCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/**
 * Pick a random spectrum not yet used in this game. Falls back to the full
 * pool if every spectrum has already been used (so the game never runs out
 * of rounds, it just starts allowing repeats).
 *
 * `randomFn` defaults to Math.random but can be injected for deterministic
 * tests.
 */
export function pickUnusedSpectrum(usedSpectrums, randomFn = Math.random) {
  const usedKeys = new Set((usedSpectrums || []).map((s) => s.join("|")));
  const available = SPECTRUMS.filter((s) => !usedKeys.has(s.join("|")));
  const pool = available.length > 0 ? available : SPECTRUMS;
  return pool[Math.floor(randomFn() * pool.length)];
}

/**
 * Average a team's guesses (0–180 scale). Falls back to the dial's
 * midpoint (90) if nobody guessed, matching the app's prior behavior.
 */
export function averageGuesses(guessValues) {
  if (!guessValues || guessValues.length === 0) return 90;
  return guessValues.reduce((a, b) => a + b, 0) / guessValues.length;
}

/**
 * Score a team's average guess against the hidden target, using the same
 * tiered thresholds as the physical Wavelength board game:
 *   within 4°  -> 4 points ("bullseye")
 *   within 11° -> 3 points
 *   within 18° -> 2 points
 *   otherwise  -> 0 points
 */
export function calculateGuessPoints(avgGuess, targetAngle) {
  const diff = Math.abs(avgGuess - targetAngle);
  if (diff <= 4) return 4;
  if (diff <= 11) return 3;
  if (diff <= 18) return 2;
  return 0;
}

/**
 * Decide the opposing team's counter-guess direction from their votes.
 * Ties are broken with a coin flip. `randomFn` defaults to Math.random but
 * can be injected for deterministic tests of the tie-break path.
 */
export function resolveCounterVoteDirection(leftCount, rightCount, randomFn = Math.random) {
  if (leftCount > rightCount) return "left";
  if (rightCount > leftCount) return "right";
  return randomFn() < 0.5 ? "left" : "right";
}

/**
 * Given the hidden target and the guessing team's average guess, work out
 * which side of the average the target was actually on ("left"/"right", or
 * null if they landed on exactly the same angle), and whether the opposing
 * team's guessed direction matches it.
 */
export function counterGuessOutcome(targetAngle, teamGuessAngle, direction) {
  const actualDirection =
    targetAngle < teamGuessAngle ? "left" : targetAngle > teamGuessAngle ? "right" : null;
  const correct = actualDirection !== null && direction === actualDirection;
  return { actualDirection, correct };
}

/**
 * Whether a presence entry counts as "online" right now: it must be marked
 * online and have sent a heartbeat within the timeout window (default 60s,
 * matching the app's heartbeat interval elsewhere).
 */
export function isPresenceAlive(entry, now, timeoutMs = 60000) {
  if (!entry) return false;
  return entry.online === true && !!entry.lastSeen && now - entry.lastSeen < timeoutMs;
}

/**
 * Which team (0 or 1) a new or rejoining player should be assigned to, to
 * keep teams balanced. Ties go to team 0.
 */
export function pickSmallerTeam(players) {
  const t0 = (players || []).filter((p) => p.team === 0).length;
  const t1 = (players || []).filter((p) => p.team === 1).length;
  return t0 <= t1 ? 0 : 1;
}

/**
 * Whether at least one team has reached the winning score (10) — on its
 * own, without the "turns equal" fairness check that isGameOver adds.
 */
export function hasTeamReachedWinningScore(scores) {
  return scores[0] >= 10 || scores[1] >= 10;
}

/**
 * Whether the game has ended: at least one team has reached the winning
 * score (10) AND both teams have taken an equal number of turns (so the
 * team that went second always gets a fair shot at the same round).
 */
export function isGameOver(scores, teamTurnCount) {
  const ttc = teamTurnCount || { 0: 0, 1: 0 };
  const turnsEqual = (ttc[0] || 0) === (ttc[1] || 0);
  return hasTeamReachedWinningScore(scores) && turnsEqual;
}

/**
 * The winning team index (0 or 1), or -1 if the scores are tied.
 */
export function determineWinner(scores) {
  if (scores[0] > scores[1]) return 0;
  if (scores[1] > scores[0]) return 1;
  return -1;
}
