import { useState, useEffect, useRef, useCallback } from "react";
import { db, waitForAuth } from "./firebase";
import { ref, set, onValue, off, get, onDisconnect, remove, serverTimestamp } from "firebase/database";

/* ─── Spectrum Data ─── */
const SPECTRUMS = [
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

const genId = () => Math.random().toString(36).slice(2, 10);
const genLobbyCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

/** Pick a random spectrum not yet used in this game. Falls back to full pool if all used. */
function pickUnusedSpectrum(usedSpectrums) {
  const usedKeys = new Set((usedSpectrums || []).map(s => s.join("|")));
  const available = SPECTRUMS.filter(s => !usedKeys.has(s.join("|")));
  const pool = available.length > 0 ? available : SPECTRUMS; // reset if exhausted
  return pool[Math.floor(Math.random() * pool.length)];
}

/* ─── Firebase helpers ─── */
function lobbyRef(code) {
  return ref(db, `lobbies/${code}`);
}

async function getGameState(code) {
  try {
    await waitForAuth(); // database.rules.json requires an auth session for every read
    const snapshot = await get(lobbyRef(code));
    return snapshot.exists() ? snapshot.val() : null;
  } catch { return null; }
}

async function setGameState(code, state) {
  try {
    await waitForAuth(); // database.rules.json requires an auth session for every write
    await set(lobbyRef(code), state);
    return true;
  } catch (e) { console.error("Firebase write error:", e); return false; }
}

async function deleteLobby(code) {
  try {
    await waitForAuth();
    await remove(ref(db, `lobbies/${code}`));
    await remove(ref(db, `presence/${code}`));
  } catch (e) { console.error("Firebase delete error:", e); }
}

/* ─── Stale lobby detection ─── */
async function isLobbyStale(code) {
  try {
    await waitForAuth();
    const snapshot = await get(ref(db, `presence/${code}`));
    if (!snapshot.exists()) return true;
    const presenceData = snapshot.val() || {};
    const now = Date.now();
    // Lobby is stale if nobody has a heartbeat within the last 60 seconds
    const anyAlive = Object.values(presenceData).some(
      v => v.online === true && v.lastSeen && (now - v.lastSeen) < 60000
    );
    return !anyAlive;
  } catch { return false; }
}

async function pruneStalePlayersAndRejoin(code, currentPlayerId) {
  const state = await getGameState(code);
  if (!state || !state.players) return state;

  // Never prune during an active game — too risky with connection flickers
  if (state.phase !== "lobby") return state;

  // Get presence data with heartbeat timestamps
  const presenceSnap = await get(ref(db, `presence/${code}`));
  const presenceData = presenceSnap.exists() ? presenceSnap.val() || {} : {};
  const now = Date.now();

  // A player is "alive" if their heartbeat is within the last 60 seconds
  const isAlive = (pid) => {
    if (pid === currentPlayerId) return true; // Joining player is always alive
    const p = presenceData[pid];
    return p && p.online === true && p.lastSeen && (now - p.lastSeen) < 60000;
  };

  const stalePlayers = state.players.filter(p => !isAlive(p.id));
  if (stalePlayers.length === 0) return state; // nothing to prune

  const newPlayers = state.players.filter(p => isAlive(p.id));

  const updatedState = { ...state, players: newPlayers };
  await setGameState(code, updatedState);
  return updatedState;
}

/* ─── Presence helpers ─── */
function presenceRef(code, pid) {
  return ref(db, `presence/${code}/${pid}`);
}

function presenceListRef(code) {
  return ref(db, `presence/${code}`);
}

/* ─── Analytics ───
 * Removed for now to avoid requiring the Blaze plan (analytics/games was
 * written by a Cloud Function, which only runs on Blaze). All calls to
 * trackVisit / trackGlobalPresence / trackGameStart / trackLobbyCreated /
 * trackLobbyDeleted have been taken out below. See README.md if you want
 * to bring analytics back later — it's a self-contained addition, not
 * something the rest of the app depends on.
 */


/* ─── Theme Definitions ─── */
const THEMES = {
  dark: {
    bg: "linear-gradient(165deg, #07071a 0%, #121228 40%, #0f1b30 100%)",
    text: "#d0d0ee",
    textMuted: "rgba(255,255,255,0.45)",
    cardBg: "rgba(255,255,255,0.03)",
    cardBorder: "rgba(255,255,255,0.07)",
    inputBg: "rgba(255,255,255,0.05)",
    inputBorder: "rgba(255,255,255,0.12)",
    dialTrack: "#1e1e38",
    dialCenter: "url(#dialBg)",
    dialCenterStroke: "#4a4a6a",
    dialRevealArc: "rgba(255,255,255,0.12)",
    rainbowAlpha: 0.22,
    overlayBg: "rgba(0,0,0,0.7)",
    modalBg: "linear-gradient(165deg, #141428 0%, #1a1a36 100%)",
    modalBorder: "rgba(255,255,255,0.1)",
    menuBg: "rgba(20,20,40,0.95)",
    menuBorder: "rgba(255,255,255,0.12)",
    hoverBg: "rgba(255,255,255,0.06)",
    separatorColor: "rgba(255,255,255,0.04)",
    scrollThumb: "rgba(255,255,255,0.15)",
    scrollThumbHover: "rgba(255,255,255,0.25)",
    red: "#ff6b5b", blue: "#4dd9f0",
    redBg: "rgba(232,68,49,0.08)", blueBg: "rgba(0,180,216,0.08)",
    redBgLobby: "rgba(232,68,49,0.06)", blueBgLobby: "rgba(0,180,216,0.06)",
    redBorder: "rgba(232,68,49,0.2)", blueBorder: "rgba(0,180,216,0.2)",
    redBorderLobby: "#e8443125", blueBorderLobby: "#00b4d825",
    tagRedBg: "#e8443122", tagBlueBg: "#00b4d822",
    tagRedBorder: "#e8443144", tagBlueBorder: "#00b4d844",
    scoreRedBg: "rgba(232,68,49,0.12)", scoreBlueBg: "rgba(0,180,216,0.12)",
    scoreRedBorder: "rgba(232,68,49,0.4)", scoreBlueBorder: "rgba(0,180,216,0.4)",
    gold: "#ffd93d", purple: "#c46bff", cyan: "#00e5ff",
    accent: "#6c63ff",
    helpBg: "rgba(108,99,255,0.85)",
    helpBorder: "rgba(255,255,255,0.15)",
    // Dial gradient stops
    dialGradStart: "#1a1a2e", dialGradEnd: "#16213e",
    needleColor: "#ffffff", needleStroke: "#aaa",
    targetMarkerStroke: "#fff", targetMarkerDot: "#fff",
  },
  light: {
    bg: "linear-gradient(165deg, #f0f2f5 0%, #e8eaef 40%, #dfe3ea 100%)",
    text: "#1a1a2e",
    textMuted: "rgba(0,0,0,0.45)",
    cardBg: "rgba(255,255,255,0.7)",
    cardBorder: "rgba(0,0,0,0.1)",
    inputBg: "rgba(0,0,0,0.04)",
    inputBorder: "rgba(0,0,0,0.15)",
    dialTrack: "#c8ccd4",
    dialCenter: "#e0e2e8",
    dialCenterStroke: "#b0b4c0",
    dialRevealArc: "rgba(0,0,0,0.08)",
    rainbowAlpha: 0.35,
    overlayBg: "rgba(0,0,0,0.4)",
    modalBg: "linear-gradient(165deg, #ffffff 0%, #f5f6fa 100%)",
    modalBorder: "rgba(0,0,0,0.12)",
    menuBg: "rgba(255,255,255,0.97)",
    menuBorder: "rgba(0,0,0,0.1)",
    hoverBg: "rgba(0,0,0,0.04)",
    separatorColor: "rgba(0,0,0,0.06)",
    scrollThumb: "rgba(0,0,0,0.15)",
    scrollThumbHover: "rgba(0,0,0,0.3)",
    red: "#d94535", blue: "#0094b4",
    redBg: "rgba(217,69,53,0.08)", blueBg: "rgba(0,148,180,0.08)",
    redBgLobby: "rgba(217,69,53,0.06)", blueBgLobby: "rgba(0,148,180,0.06)",
    redBorder: "rgba(217,69,53,0.25)", blueBorder: "rgba(0,148,180,0.25)",
    redBorderLobby: "rgba(217,69,53,0.15)", blueBorderLobby: "rgba(0,148,180,0.15)",
    tagRedBg: "rgba(217,69,53,0.12)", tagBlueBg: "rgba(0,148,180,0.12)",
    tagRedBorder: "rgba(217,69,53,0.25)", tagBlueBorder: "rgba(0,148,180,0.25)",
    scoreRedBg: "rgba(217,69,53,0.1)", scoreBlueBg: "rgba(0,148,180,0.1)",
    scoreRedBorder: "rgba(217,69,53,0.35)", scoreBlueBorder: "rgba(0,148,180,0.35)",
    gold: "#c9a000", purple: "#8b5cf6", cyan: "#0891b2",
    accent: "#6c63ff",
    helpBg: "rgba(108,99,255,0.9)",
    helpBorder: "rgba(0,0,0,0.1)",
    dialGradStart: "#e0e2e8", dialGradEnd: "#d0d4de",
    needleColor: "#1a1a2e", needleStroke: "#555",
    targetMarkerStroke: "#1a1a2e", targetMarkerDot: "#1a1a2e",
  },
};

/* ─── Dial Component ─── */
function Dial({ targetAngle, guessAngle, teamGuessAngle, individualGuesses, onGuess, revealed, interactive, showTarget, theme }) {
  const th = theme || THEMES.dark;
  const svgRef = useRef(null);
  const dragging = useRef(false);

  const angleToXY = (deg, r) => {
    const rad = (deg - 180) * Math.PI / 180;
    return [300 + r * Math.cos(rad), 300 + r * Math.sin(rad)];
  };

  const arcPath = (startDeg, endDeg, r) => {
    const [sx, sy] = angleToXY(startDeg, r);
    const [ex, ey] = angleToXY(endDeg, r);
    const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
    return `M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`;
  };

  const handlePointer = useCallback((e) => {
    if (!interactive) return;
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());
    const dx = svgPt.x - 300;
    const dy = svgPt.y - 300;
    let angle = Math.atan2(dy, dx) * 180 / Math.PI + 180;
    // Clamp to the semicircle range — if below center (angle wraps past 0 or 180), snap to nearest edge
    if (angle < 0) angle = 0;
    if (angle > 180) angle = angle < 270 ? 180 : 0;
    angle = Math.max(0, Math.min(180, angle));
    onGuess(angle);
  }, [interactive, onGuess]);

  const t = targetAngle;

  return (
    <svg ref={svgRef} viewBox="0 0 600 330" style={{ width: "100%", maxWidth: 540, userSelect: "none", cursor: interactive ? "crosshair" : "default", display: "block", margin: "0 auto", touchAction: "none" }}
      onPointerDown={(e) => { if (interactive) { dragging.current = true; handlePointer(e); } }}
      onPointerMove={(e) => { if (dragging.current) handlePointer(e); }}
      onPointerUp={() => { dragging.current = false; }}
      onPointerLeave={() => { dragging.current = false; }}
    >
      <defs>
        <linearGradient id="dialBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={th.dialGradStart} /><stop offset="100%" stopColor={th.dialGradEnd} />
        </linearGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <filter id="teamGlow"><feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <filter id="softGlow"><feGaussianBlur stdDeviation="2.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>

      <path d="M 30 300 A 270 270 0 0 1 570 300" fill="none" stroke={th.dialTrack} strokeWidth="62" strokeLinecap="round" />

      {/* Invisible wider touch target for easier mobile interaction */}
      {interactive && <path d="M 30 300 A 270 270 0 0 1 570 300" fill="none" stroke="transparent" strokeWidth="100" strokeLinecap="round" style={{ cursor: "crosshair" }} />}

      {/* Default white wheel (shown on reveal) */}
      {revealed && <path d={arcPath(0, 180, 270)} fill="none" stroke={th.dialRevealArc} strokeWidth="60" />}

      {/* Rainbow tint when NOT revealed */}
      {!revealed && Array.from({ length: 36 }).map((_, i) => {
        const a1 = i * 5; const a2 = (i + 1) * 5;
        const hue = (a1 / 180) * 280 + 10;
        return <path key={i} d={arcPath(a1, a2, 270)} fill="none" stroke={`hsla(${hue}, 65%, 45%, ${th.rainbowAlpha})`} strokeWidth="60" />;
      })}

      {/* Scoring zones: 2pts (outer), 3pts (middle), 4pts (inner) — visually equal bands */}
      {(revealed || showTarget) && (() => {
        const zone2Start = Math.max(0, t - 18);
        const zone2End = Math.min(180, t + 18);
        const zone3Start = Math.max(0, t - 11);
        const zone3End = Math.min(180, t + 11);
        const zone4Start = Math.max(0, t - 4);
        const zone4End = Math.min(180, t + 4);

        // Label positions — inside the arc band
        const labelR = 270;
        const [z4x, z4y] = angleToXY(t, labelR);
        const z3AngleL = Math.max(0, t - 7.5);
        const z3AngleR = Math.min(180, t + 7.5);
        const [z3Lx, z3Ly] = angleToXY(z3AngleL, labelR);
        const [z3Rx, z3Ry] = angleToXY(z3AngleR, labelR);
        const z2AngleL = Math.max(0, t - 14.5);
        const z2AngleR = Math.min(180, t + 14.5);
        const [z2Lx, z2Ly] = angleToXY(z2AngleL, labelR);
        const [z2Rx, z2Ry] = angleToXY(z2AngleR, labelR);

        return <>
          {/* Paint outer to inner so inner covers outer */}
          <path d={arcPath(zone2Start, zone2End, 270)} fill="none" stroke="rgba(240,100,40,0.7)" strokeWidth="60" />
          <path d={arcPath(zone3Start, zone3End, 270)} fill="none" stroke="rgba(250,200,30,0.75)" strokeWidth="60" />
          <path d={arcPath(zone4Start, zone4End, 270)} fill="none" stroke="rgba(50,200,90,0.8)" strokeWidth="60" />
        </>;
      })()}


      {/* Individual guess needle (cyan) */}
      {guessAngle !== null && !revealed && (() => {
        const [nx, ny] = angleToXY(guessAngle, 255);
        return <g filter="url(#glow)">
          <line x1="300" y1="300" x2={nx} y2={ny} stroke="#00e5ff" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx={nx} cy={ny} r="6" fill="#00e5ff" />
          <circle cx="300" cy="300" r="6" fill="#00e5ff" opacity="0.5" />
        </g>;
      })()}

      {/* Individual guess dots (shown on reveal) */}
      {revealed && individualGuesses && individualGuesses.map((ig, i) => {
        const [ix, iy] = angleToXY(ig.angle, 240);
        return <circle key={i} cx={ix} cy={iy} r="5" fill="#fff" stroke="#222" strokeWidth="1.5" opacity="0.85" />;
      })}

      {/* Team average guess needle (shown on reveal or counter_guess) */}
      {(revealed || teamGuessAngle !== null) && teamGuessAngle !== null && teamGuessAngle !== undefined && (() => {
        const [gx, gy] = angleToXY(teamGuessAngle, 255);
        return <g filter="url(#teamGlow)">
          <line x1="300" y1="300" x2={gx} y2={gy} stroke={th.needleColor} strokeWidth="4" strokeLinecap="round" />
          <circle cx={gx} cy={gy} r="7" fill={th.needleColor} stroke={th.needleStroke} strokeWidth="2" />
          <circle cx="300" cy="300" r="6" fill={th.needleColor} opacity="0.5" />
        </g>;
      })()}

      {/* Target needle for clue giver */}
      {showTarget && !revealed && (() => {
        const [tx, ty] = angleToXY(targetAngle, 255);
        return <g filter="url(#softGlow)">
          <line x1="300" y1="300" x2={tx} y2={ty} stroke="#ffd600" strokeWidth="3.5" strokeLinecap="round" opacity="0.7" />
          <circle cx="300" cy="300" r="6" fill="#ffd600" opacity="0.4" />
        </g>;
      })()}

      {/* Target marker */}
      {(revealed || showTarget) && (() => {
        const [tx, ty] = angleToXY(targetAngle, 270);
        return <g filter="url(#softGlow)">
          <circle cx={tx} cy={ty} r="9" fill="#ffd600" stroke={th.targetMarkerStroke} strokeWidth="2" />
          <circle cx={tx} cy={ty} r="3" fill={th.targetMarkerDot} />
        </g>;
      })()}

      <circle cx="300" cy="300" r="14" fill={th.dialCenter} stroke={th.dialCenterStroke} strokeWidth="2" />

      {/* Center notch at 90° (top of arc) */}
      {(() => {
        const [outerX, outerY] = angleToXY(90, 302);
        const [innerX, innerY] = angleToXY(90, 238);
        return <>
          <line x1={outerX} y1={outerY} x2={innerX} y2={innerY} stroke={th.text} strokeWidth="2" opacity="0.35" strokeLinecap="round" />
        </>;
      })()}

      {/* Point labels — rendered last so they appear above all needles and markers */}
      {(revealed || showTarget) && (() => {
        const labelR = 270;
        const [z4x, z4y] = angleToXY(t, labelR);
        const z3AngleL = Math.max(0, t - 7.5);
        const z3AngleR = Math.min(180, t + 7.5);
        const [z3Lx, z3Ly] = angleToXY(z3AngleL, labelR);
        const [z3Rx, z3Ry] = angleToXY(z3AngleR, labelR);
        const z2AngleL = Math.max(0, t - 14.5);
        const z2AngleR = Math.min(180, t + 14.5);
        const [z2Lx, z2Ly] = angleToXY(z2AngleL, labelR);
        const [z2Rx, z2Ry] = angleToXY(z2AngleR, labelR);
        return <>
          <text x={z4x} y={z4y} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="16" fontWeight="800" fontFamily="'Inter', sans-serif" opacity="0.95" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>4</text>
          {(t - 4 > 2) && <text x={z3Lx} y={z3Ly} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="14" fontWeight="700" fontFamily="'Inter', sans-serif" opacity="0.9" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>3</text>}
          {(180 - t - 4 > 2) && <text x={z3Rx} y={z3Ry} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="14" fontWeight="700" fontFamily="'Inter', sans-serif" opacity="0.9" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>3</text>}
          {(t - 11 > 2) && <text x={z2Lx} y={z2Ly} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="14" fontWeight="700" fontFamily="'Inter', sans-serif" opacity="0.8" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>2</text>}
          {(180 - t - 11 > 2) && <text x={z2Rx} y={z2Ry} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="14" fontWeight="700" fontFamily="'Inter', sans-serif" opacity="0.8" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>2</text>}
        </>;
      })()}
    </svg>
  );
}

/* ─── Score Bar ─── */
function ScoreBar({ scores, teamNames, theme }) {
  const th = theme || THEMES.dark;
  return (
    <div style={{ display: "flex", gap: 20, justifyContent: "center", margin: "12px 0 16px" }}>
      {scores.map((sc, i) => (
        <div key={i} style={{
          padding: "8px 26px", borderRadius: 14,
          background: i === 0 ? th.scoreRedBg : th.scoreBlueBg,
          border: `2px solid ${i === 0 ? th.scoreRedBorder : th.scoreBlueBorder}`,
          textAlign: "center",
        }}>
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 2, opacity: 0.6, color: i === 0 ? th.red : th.blue }}>{teamNames[i]}</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: i === 0 ? th.red : th.blue, fontFamily: "'Unbounded', sans-serif" }}>{sc}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── Main App ─── */
export default function App() {
  // Check URL for room code on load (e.g. /game/ABC123)
  const urlCode = (() => {
    const match = window.location.pathname.match(/^\/game\/([A-Za-z0-9]+)/);
    return match ? match[1].toUpperCase() : "";
  })();
  const [screen, setScreen] = useState(urlCode.length >= 4 ? "join_from_url" : "menu");
  const [playerId] = useState(() => {
    let stored = null;
    try { stored = sessionStorage.getItem("wl_pid"); } catch {}
    if (stored) return stored;
    const id = genId();
    try { sessionStorage.setItem("wl_pid", id); } catch {}
    return id;
  });
  const [playerName, setPlayerName] = useState(() => {
    try { return localStorage.getItem("wl_name") || ""; } catch { return ""; }
  });
  const [lobbyCode, setLobbyCode] = useState(urlCode.length >= 4 ? urlCode : "");
  const [joinCode, setJoinCode] = useState(urlCode.length >= 4 ? urlCode : "");
  const [gs, setGs] = useState(null);
  const [guessAngle, setGuessAngle] = useState(90);
  const [clueInput, setClueInput] = useState("");
  const [error, setError] = useState("");
  const [notification, setNotification] = useState("");
  const [notifColor, setNotifColor] = useState("#ff5a3c");
  const [showHelp, setShowHelp] = useState(false);
  const [showHostMenu, setShowHostMenu] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [autoAdvanceCountdown, setAutoAdvanceCountdown] = useState(null);
  const [themeMode, setThemeMode] = useState(() => {
    try { return localStorage.getItem("wl_theme") || "dark"; } catch { return "dark"; }
  });
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return localStorage.getItem("wl_sound") !== "false"; } catch { return true; }
  });
  const [firebaseConnected, setFirebaseConnected] = useState(true);
  const th = THEMES[themeMode];
  const listenerRef = useRef(null);
  const notifTimerRef = useRef(null);

  /* ─── Persist player preferences ─── */
  useEffect(() => {
    try { if (playerName) localStorage.setItem("wl_name", playerName); } catch {}
  }, [playerName]);
  useEffect(() => {
    try { localStorage.setItem("wl_theme", themeMode); } catch {}
  }, [themeMode]);
  useEffect(() => {
    try { localStorage.setItem("wl_sound", soundEnabled ? "true" : "false"); } catch {}
  }, [soundEnabled]);

  /* ─── Sound chime (Web Audio API — Safari/iOS compatible) ─── */
  const audioCtxRef = useRef(null);
  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Safari suspends AudioContext until resumed inside a user gesture
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // Unlock audio on first user interaction (required for Safari/iOS)
  useEffect(() => {
    const unlock = () => {
      getAudioCtx();
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("click", unlock);
    };
    document.addEventListener("touchstart", unlock, { once: true });
    document.addEventListener("click", unlock, { once: true });
    return () => {
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("click", unlock);
    };
  }, []);

  const playChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioCtx();
      const playTone = (freq, start, dur) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.15, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur);
      };
      playTone(587, 0, 0.15);    // D5
      playTone(880, 0.12, 0.2);  // A5
    } catch {}
  }, [soundEnabled, getAudioCtx]);

  /* ─── Haptic feedback ─── */
  const haptic = useCallback((ms = 50) => {
    try { navigator.vibrate?.(ms); } catch {}
  }, []);

  /* ─── Firebase connection status ─── */
  useEffect(() => {
    const connRef = ref(db, ".info/connected");
    const handler = (snap) => { setFirebaseConnected(!!snap.val()); };
    onValue(connRef, handler);
    return () => off(connRef, "value", handler);
  }, []);

  const showNotification = (msg, color = "#ff5a3c") => {
    setNotification(msg);
    setNotifColor(color);
    if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
    notifTimerRef.current = setTimeout(() => setNotification(""), 5000);
  };

  /* ─── Presence: heartbeat-based system with visibility-aware reconnection ─── */
  const heartbeatRef = useRef(null);
  useEffect(() => {
    if (!lobbyCode || !playerId || !playerName) return;
    const pRef = presenceRef(lobbyCode, playerId);

    // Write presence immediately
    const writePresence = () => {
      set(pRef, { name: playerName, online: true, lastSeen: Date.now() });
    };
    writePresence();

    // Set up onDisconnect to mark as offline (not remove — allows grace period)
    const setupDisconnect = () => {
      onDisconnect(pRef).set({ name: playerName, online: false, lastSeen: Date.now() });
    };
    setupDisconnect();

    // Heartbeat: update lastSeen every 5 seconds so others know we're alive
    heartbeatRef.current = setInterval(writePresence, 5000);

    // When user returns to the tab, immediately re-announce presence
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        writePresence();
        setupDisconnect(); // Re-register onDisconnect since reconnection may clear it
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    // Also handle window focus for browsers that don't fire visibilitychange reliably
    const onFocus = () => { writePresence(); setupDisconnect(); };
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(heartbeatRef.current);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
      remove(pRef);
    };
  }, [lobbyCode, playerId, playerName]);

  /* ─── Last-player lobby cleanup via onDisconnect ─── */
  const lobbyCleanupRef = useRef(null);
  useEffect(() => {
    if (!lobbyCode || (screen !== "lobby" && screen !== "game")) return;
    const pListRef = presenceListRef(lobbyCode);

    const handler = async (snapshot) => {
      const presenceData = snapshot.val() || {};
      // Count players who are actually online (heartbeat within last 60s)
      const now = Date.now();
      const aliveIds = Object.entries(presenceData).filter(
        ([, v]) => v.online === true && v.lastSeen && (now - v.lastSeen) < 60000
      ).map(([k]) => k);

      // Cancel any previous onDisconnect cleanup
      if (lobbyCleanupRef.current) {
        try { await lobbyCleanupRef.current.cancel(); } catch {}
        lobbyCleanupRef.current = null;
      }

      // If I'm the last alive player, set up onDisconnect to nuke the lobby + presence
      if (aliveIds.length <= 1 && aliveIds.includes(playerId)) {
        const lobbyOD = onDisconnect(ref(db, `lobbies/${lobbyCode}`));
        const presenceOD = onDisconnect(ref(db, `presence/${lobbyCode}`));
        await lobbyOD.remove();
        await presenceOD.remove();
        lobbyCleanupRef.current = lobbyOD;
      }
    };

    onValue(pListRef, handler);
    return () => {
      off(pListRef, "value", handler);
      if (lobbyCleanupRef.current) {
        try { lobbyCleanupRef.current.cancel(); } catch {}
        lobbyCleanupRef.current = null;
      }
    };
  }, [lobbyCode, screen, playerId]);

  /* ─── Listen for players leaving (with grace period to handle tab switches) ─── */
  const pendingRemovalsRef = useRef({});
  useEffect(() => {
    if (!lobbyCode || (screen !== "lobby" && screen !== "game")) return;
    const pListRef = presenceListRef(lobbyCode);
    let knownIds = null;

    const handler = async (snapshot) => {
      const presenceData = snapshot.val() || {};
      const now = Date.now();

      // Determine who's truly alive: online=true AND heartbeat within 60s
      const aliveIds = Object.entries(presenceData).filter(
        ([, v]) => v.online === true && v.lastSeen && (now - v.lastSeen) < 60000
      ).map(([k]) => k);

      // On first load just capture the current set
      if (knownIds === null) { knownIds = aliveIds; return; }

      // Find who just went offline
      const nowGone = knownIds.filter(id => !aliveIds.includes(id));
      // Find who came back
      const returned = aliveIds.filter(id => pendingRemovalsRef.current[id]);

      // Cancel pending removals for anyone who came back
      for (const rid of returned) {
        clearTimeout(pendingRemovalsRef.current[rid]);
        delete pendingRemovalsRef.current[rid];
      }

      // Schedule removals with 45s grace period for newly-gone players
      for (const goneId of nowGone) {
        if (goneId === playerId) continue; // Don't remove ourselves
        if (pendingRemovalsRef.current[goneId]) continue; // Already pending

        pendingRemovalsRef.current[goneId] = setTimeout(async () => {
          delete pendingRemovalsRef.current[goneId];

          // Re-check presence — they might have come back during the grace period
          const freshSnap = await get(presenceRef(lobbyCode, goneId));
          if (freshSnap.exists()) {
            const val = freshSnap.val();
            if (val.online === true && val.lastSeen && (Date.now() - val.lastSeen) < 60000) {
              return; // They're back, don't remove
            }
          }

          // They're truly gone — remove from game state
          const cur = await getGameState(lobbyCode);
          if (!cur || !cur.players) return;
          const player = cur.players.find(p => p.id === goneId);
          if (!player) return;

          const newPlayers = cur.players.filter(p => p.id !== goneId);
          if (!cur.guesses) cur.guesses = {};
          if (!cur.history) cur.history = [];

          if (newPlayers.length === 0) {
            await deleteLobby(lobbyCode);
            return;
          }

          const t0 = newPlayers.filter(p => p.team === 0).length;
          const t1 = newPlayers.filter(p => p.team === 1).length;
          const inGame = cur.phase !== "lobby";

          if (inGame && (t0 < 2 || t1 < 2)) {
            await setGameState(lobbyCode, {
              ...cur, players: newPlayers,
              phase: "lobby", round: 0, scores: [0, 0],
              history: [null], clue: "", guesses: { _init: true },
              leftNotice: `${player.name} has left the game. Not enough players — game ended.`,
            });
          } else {
            await setGameState(lobbyCode, {
              ...cur, players: newPlayers,
              leftNotice: `${player.name} has left the game.`,
            });
          }

          // Clean up their presence node
          await remove(presenceRef(lobbyCode, goneId));
        }, 45000); // 45 second grace period
      }

      knownIds = aliveIds;
    };

    onValue(pListRef, handler);
    return () => {
      off(pListRef, "value", handler);
      // Clear all pending removal timers on unmount
      for (const tid of Object.values(pendingRemovalsRef.current)) {
        clearTimeout(tid);
      }
      pendingRemovalsRef.current = {};
    };
  }, [lobbyCode, screen]);

  /* ─── Real-time listener (replaces polling) ─── */
  useEffect(() => {
    if (!lobbyCode || (screen !== "lobby" && screen !== "game")) return;

    const dbRef = lobbyRef(lobbyCode);
    const handler = (snapshot) => {
      if (!snapshot.exists()) {
        // Lobby was deleted — return to menu
        showNotification("Lobby has been closed.", "#ff5a3c");
        setScreen("menu");
        setGs(null);
        setLobbyCode("");
        window.history.replaceState(null, "", "/");
        return;
      }
      const state = snapshot.val();
      // Firebase strips empty objects/arrays, so ensure guesses and history exist
      if (!state.guesses) state.guesses = {};
      if (!state.history) state.history = [];
      if (!state.players) state.players = [];
      // Check if this player was kicked
      if (state.kickedIds && state.kickedIds[playerId]) {
        showNotification("You were kicked from the lobby.", "#ff5a3c");
        setScreen("menu");
        setGs(null);
        setLobbyCode("");
        window.history.replaceState(null, "", "/");
        return;
      }

      // Auto-rejoin: if we're not in the players list (dropped during tab switch) but weren't kicked or voluntarily left, re-add ourselves
      if (state.players && !state.players.find(p => p.id === playerId) && playerName) {
        // Don't rejoin if we were kicked or voluntarily left
        if ((state.kickedIds && state.kickedIds[playerId]) || (state.leftIds && state.leftIds[playerId])) {
          showNotification("You have left this game.", "#ff5a3c");
          setScreen("menu");
          setGs(null);
          setLobbyCode("");
          window.history.replaceState(null, "", "/");
          return;
        }
        // Determine which team we should rejoin (smaller team, or team 0 if equal)
        const t0Count = state.players.filter(p => p.team === 0).length;
        const t1Count = state.players.filter(p => p.team === 1).length;
        const rejoinTeam = t0Count <= t1Count ? 0 : 1;
        const updatedPlayers = [...state.players, { id: playerId, name: playerName.trim(), team: rejoinTeam }];
        setGameState(lobbyCode, { ...state, players: updatedPlayers });
        showNotification("Reconnected!", "#4caf50");
        return; // The next state update will have us in the list
      }
      setGs(state);
      // Show leave notification if present, then clear it so it doesn't re-trigger
      if (state.leftNotice) {
        showNotification(state.leftNotice);
        // Clear the notice from firebase so subsequent state updates don't re-show it
        const dbRefUpdate = lobbyRef(lobbyCode);
        set(ref(db, `lobbies/${lobbyCode}/leftNotice`), null);
      }
      if (state.phase !== "lobby" && screen === "lobby") setScreen("game");
      if (state.phase === "lobby" && screen === "game") {
        // Auto-assign spectators (team: -1) to teams when returning to lobby
        const spectators = state.players.filter(p => p.team === -1);
        if (spectators.length > 0) {
          const updated = state.players.map(p => {
            if (p.team !== -1) return p;
            const t0 = state.players.filter(x => x.team === 0).length;
            const t1 = state.players.filter(x => x.team === 1).length;
            return { ...p, team: t0 <= t1 ? 0 : 1 };
          });
          setGameState(lobbyCode, { ...state, players: updated });
        }
        setScreen("lobby");
      }
    };

    onValue(dbRef, handler);
    listenerRef.current = { dbRef, handler };

    return () => {
      off(dbRef, "value", handler);
      listenerRef.current = null;
    };
  }, [lobbyCode, screen]);

  const update = async (fn) => {
    const cur = await getGameState(lobbyCode) || gs;
    if (!cur.guesses) cur.guesses = {};
    if (!cur.history) cur.history = [];
    const next = fn(cur);
    const ok = await setGameState(lobbyCode, next);
    if (!ok) showNotification("Action failed — check your connection and try again.", "#e65100");
  };

  /* ─── Actions ─── */
  const createLobby = async () => {
    if (!playerName.trim()) { setError("Enter your name!"); return; }
    const code = genLobbyCode();
    const state = {
      lobbyCode: code,
      players: [{ id: playerId, name: playerName.trim(), team: 0 }],
      teams: ["Red Team", "Blue Team"],
      scores: [0, 0], phase: "lobby", round: 0,
      activeTeam: 0, clueGiverId: "", spectrum: null, targetAngle: 0,
      clue: "", guesses: { _init: true }, history: [null],
    };
    setLobbyCode(code);
    await setGameState(code, state);
    setGs(state);
    window.history.replaceState(null, "", `/game/${code}`);
    setScreen("lobby");
  };

  const joinLobby = async () => {
    if (!playerName.trim()) { setError("Enter your name!"); return; }
    if (!joinCode.trim()) { setError("Enter lobby code!"); return; }
    const code = joinCode.trim().toUpperCase();
    const state = await getGameState(code);
    if (!state) { setError("Lobby not found!"); return; }
    // If the lobby exists but nobody is online, it's a stale orphan — clean it up
    if (await isLobbyStale(code)) {
      await deleteLobby(code);
      setError("That lobby has expired (all players left). Please create a new one!");
      return;
    }
    // Prune stale players who are in the players list but no longer online
    const cleaned = await pruneStalePlayersAndRejoin(code, playerId);
    const current = cleaned || state;
    if (!current.players) current.players = [];
    if (!current.players.find(p => p.id === playerId)) {
      if (current.players.some(p => p.name.toLowerCase() === playerName.trim().toLowerCase())) {
        setError("That name is already taken in this lobby!"); return;
      }
      // If game is in progress, join as spectator (team: -1)
      const inGame = current.phase && current.phase !== "lobby";
      const t = inGame ? -1 : (current.players.filter(p => p.team === 0).length <= current.players.filter(p => p.team === 1).length ? 0 : 1);
      current.players.push({ id: playerId, name: playerName.trim(), team: t });
      await setGameState(code, current);
    }
    setLobbyCode(code);
    setGs(current);
    window.history.replaceState(null, "", `/game/${code}`);
    setScreen(current.phase === "lobby" ? "lobby" : "game");
  };

  const switchTeam = async (pid, team) => {
    await update(s => ({ ...s, players: s.players.map(p => p.id === pid ? { ...p, team } : p) }));
  };

  const kickPlayer = async (pid) => {
    const cur = await getGameState(lobbyCode);
    if (!cur || !cur.players) return;
    const kicked = cur.players.find(p => p.id === pid);
    const newPlayers = cur.players.filter(p => p.id !== pid);
    await setGameState(lobbyCode, { ...cur, players: newPlayers, kickedIds: { ...(cur.kickedIds || {}), [pid]: true } });
    if (kicked) showNotification(`${kicked.name} was kicked.`, "#ff5a3c");
  };

  const leaveGame = async () => {
    const cur = await getGameState(lobbyCode);
    if (!cur || !cur.players) return;

    const leavingPlayer = cur.players.find(p => p.id === playerId);
    const newPlayers = cur.players.filter(p => p.id !== playerId);
    if (!cur.guesses) cur.guesses = {};
    if (!cur.history) cur.history = [];

    // Remove presence
    await remove(presenceRef(lobbyCode, playerId));

    // If no players left, delete the lobby
    if (newPlayers.length === 0) {
      await deleteLobby(lobbyCode);
    } else {
      const t0 = newPlayers.filter(p => p.team === 0).length;
      const t1 = newPlayers.filter(p => p.team === 1).length;
      const inGame = cur.phase !== "lobby";

      if (inGame && (t0 < 2 || t1 < 2)) {
        // Not enough players to continue — end game back to lobby
        await setGameState(lobbyCode, {
          ...cur, players: newPlayers,
          phase: "lobby", round: 0, scores: [0, 0],
          history: [null], clue: "", guesses: { _init: true },
          leftNotice: `${leavingPlayer?.name || "A player"} left. Not enough players — game ended.`,
        });
      } else {
        await setGameState(lobbyCode, {
          ...cur, players: newPlayers,
          // Mark as voluntarily left so auto-rejoin doesn't fire
          leftIds: { ...(cur.leftIds || {}), [playerId]: true },
          leftNotice: `${leavingPlayer?.name || "A player"} has left the game.`,
        });
      }
    }

    // Return to menu locally
    setScreen("menu");
    setGs(null);
    setLobbyCode("");
    window.history.replaceState(null, "", "/");
  };

  const startGame = async () => {
    const spectrum = pickUnusedSpectrum([]);
    const target = Math.random() * 180;
    const startingTeam = Math.random() < 0.5 ? 0 : 1;
    const teamPlayers = gs.players.filter(p => p.team === startingTeam);
    const otherTeam = startingTeam === 0 ? 1 : 0;
    const otherPlayers = gs.players.filter(p => p.team === otherTeam);
    // Store initial team rosters for stable clue giver rotation
    const teamRoster = {
      0: gs.players.filter(p => p.team === 0).map(p => p.id),
      1: gs.players.filter(p => p.team === 1).map(p => p.id),
    };
    // Random starting index for each team's clue giver rotation
    const startOffset0 = startingTeam === 0
      ? Math.floor(Math.random() * teamPlayers.length)
      : Math.floor(Math.random() * otherPlayers.length);
    const startOffset1 = startingTeam === 1
      ? Math.floor(Math.random() * teamPlayers.length)
      : Math.floor(Math.random() * otherPlayers.length);
    const cg = teamPlayers.length > 0 ? teamPlayers[startOffset0 % teamPlayers.length].id : gs.players[0].id;
    await update(s => ({
      ...s, phase: "clue", round: 1, activeTeam: startingTeam, spectrum, targetAngle: target,
      clueGiverId: cg, clue: "", guesses: { _init: true },
      startingTeam: startingTeam,
      teamTurnCount: { [startingTeam]: 1, [otherTeam]: 0 },
      clueGiverOffset: { 0: startOffset0, 1: startOffset1 },
      teamRoster: teamRoster,
      usedSpectrums: [spectrum],
    }));
  };

  const submitClue = async () => {
    if (!clueInput.trim()) return;
    haptic();
    await update(s => ({ ...s, clue: clueInput.trim(), phase: "guess" }));
    setClueInput("");
  };

  const submitGuess = async () => {
    haptic();
    await update(s => ({ ...s, guesses: { ...s.guesses, [playerId]: guessAngle } }));
  };

  const revealAnswer = async () => {
    const cur = await getGameState(lobbyCode);
    if (!cur.guesses) cur.guesses = {};
    if (!cur.history) cur.history = [];
    const teamGuesses = Object.entries(cur.guesses)
      .filter(([pid]) => pid !== "_init" && cur.players.find(p => p.id === pid)?.team === cur.activeTeam)
      .map(([, a]) => a);
    const avg = teamGuesses.length > 0 ? teamGuesses.reduce((a, b) => a + b, 0) / teamGuesses.length : 90;
    const diff = Math.abs(avg - cur.targetAngle);
    let points = 0;
    if (diff <= 4) points = 4;
    else if (diff <= 11) points = 3;
    else if (diff <= 18) points = 2;
    const clueGiver = cur.players.find(p => p.id === cur.clueGiverId);
    const historyEntry = { round: cur.round, team: cur.activeTeam, spectrum: cur.spectrum, clue: cur.clue, target: cur.targetAngle, guess: avg, points, clueGiver: clueGiver?.name || "?" };
    const newHistory = cur.history.filter(h => h !== null);
    newHistory.push(historyEntry);
    // Go to counter_guess phase — opposing team votes left/right before target is revealed
    await update(s => ({ ...s, phase: "counter_guess", teamGuessAngle: avg, pendingPoints: points, history: newHistory, counterVotes: { _init: true }, counterGuess: null, counterGuessResolved: false }));
  };

  const submitCounterVote = async (direction) => {
    haptic();
    await update(s => ({ ...s, counterVotes: { ...s.counterVotes, [playerId]: direction } }));
  };

  const resolveCounterVotes = async () => {
    const cur = await getGameState(lobbyCode);
    if (!cur.history) cur.history = [];
    if (!cur.counterVotes) cur.counterVotes = {};
    const oppositeTeam = cur.activeTeam === 0 ? 1 : 0;
    const votes = Object.entries(cur.counterVotes).filter(([k]) => k !== "_init");
    const leftCount = votes.filter(([, v]) => v === "left").length;
    const rightCount = votes.filter(([, v]) => v === "right").length;
    let direction;
    if (leftCount > rightCount) direction = "left";
    else if (rightCount > leftCount) direction = "right";
    else direction = Math.random() < 0.5 ? "left" : "right"; // tie-breaker
    const actualDirection = cur.targetAngle < cur.teamGuessAngle ? "left" : cur.targetAngle > cur.teamGuessAngle ? "right" : null;
    const correct = actualDirection !== null && direction === actualDirection;
    const newScores = [...cur.scores];
    newScores[cur.activeTeam] += cur.pendingPoints || 0;
    if (correct) newScores[oppositeTeam] += 1;
    await update(s => ({ ...s, phase: "reveal", scores: newScores, counterGuess: direction, counterGuessCorrect: correct, counterGuessResolved: true, counterVoteTally: { left: leftCount, right: rightCount } }));
  };

  const skipCounterGuess = async () => {
    const cur = await getGameState(lobbyCode);
    if (!cur.history) cur.history = [];
    const newScores = [...cur.scores];
    newScores[cur.activeTeam] += cur.pendingPoints || 0;
    await update(s => ({ ...s, phase: "reveal", scores: newScores, counterGuess: null, counterGuessCorrect: null, counterGuessResolved: true }));
  };

  const nextRound = async () => {
    const cur = await getGameState(lobbyCode);
    if (!cur.history) cur.history = [];
    const nextTeam = cur.activeTeam === 0 ? 1 : 0;
    const spectrum = pickUnusedSpectrum(cur.usedSpectrums || []);
    const target = Math.random() * 180;
    // Use stored roster for stable rotation, fall back to live players
    const roster = cur.teamRoster && cur.teamRoster[nextTeam] ? cur.teamRoster[nextTeam] : [];
    const livePlayers = cur.players.filter(p => p.team === nextTeam);
    // Filter roster to only players still in the game
    const activeRoster = roster.filter(id => livePlayers.some(p => p.id === id));
    const tp = activeRoster.length > 0 ? activeRoster : livePlayers.map(p => p.id);
    const teamTurnCount = cur.teamTurnCount || { 0: 0, 1: 0 };
    const thisTeamTurn = teamTurnCount[nextTeam] || 0;
    const offset = (cur.clueGiverOffset && cur.clueGiverOffset[nextTeam]) || 0;
    const cg = tp.length > 0 ? tp[(offset + thisTeamTurn) % tp.length] : cur.players[0].id;
    const newTeamTurnCount = { ...teamTurnCount, [nextTeam]: thisTeamTurn + 1 };
    const newUsedSpectrums = [...(cur.usedSpectrums || []), spectrum];
    await update(s => ({
      ...s, phase: "clue", round: s.round + 1, activeTeam: nextTeam, spectrum, targetAngle: target,
      clueGiverId: cg, clue: "", guesses: { _init: true },
      counterGuess: null, counterGuessCorrect: null, counterGuessResolved: false, pendingPoints: 0, counterVotes: { _init: true }, counterVoteTally: null,
      teamTurnCount: newTeamTurnCount,
      usedSpectrums: newUsedSpectrums,
    }));
    setGuessAngle(90);
  };

  /* ─── Derived state ─── */
  const me = gs?.players?.find(p => p.id === playerId);
  const isClueGiver = gs?.clueGiverId === playerId;
  const isMyTurn = me?.team === gs?.activeTeam;
  const realGuesses = gs?.guesses ? Object.entries(gs.guesses).filter(([k]) => k !== "_init") : [];
  const myGuessed = realGuesses.some(([k]) => k === playerId);
  const isHost = gs?.players?.[0]?.id === playerId;
  const allTeamGuessed = gs?.phase === "guess" && gs?.players
    ?.filter(p => p.team === gs.activeTeam && p.id !== gs.clueGiverId)
    .every(p => realGuesses.some(([k]) => k === p.id));
  const history = gs?.history?.filter(h => h !== null) || [];

  /* ─── Auto-proceed: guess → counter_guess when all guesses are in ─── */
  const autoRevealRef = useRef(false);
  useEffect(() => {
    if (!isHost || !gs || gs.phase !== "guess" || !allTeamGuessed) {
      autoRevealRef.current = false;
      return;
    }
    if (autoRevealRef.current) return; // already triggered
    autoRevealRef.current = true;
    const timer = setTimeout(() => { revealAnswer(); }, 1500);
    return () => clearTimeout(timer);
  }, [isHost, gs?.phase, allTeamGuessed]);

  /* ─── Auto-proceed: counter_guess → reveal when all votes are in ─── */
  const autoResolveRef = useRef(false);
  useEffect(() => {
    if (!isHost || !gs || gs.phase !== "counter_guess") {
      autoResolveRef.current = false;
      return;
    }
    const oppositeTeam = gs.activeTeam === 0 ? 1 : 0;
    const votes = gs.counterVotes ? Object.entries(gs.counterVotes).filter(([k]) => k !== "_init") : [];
    const oppositeTeamMembers = gs.players.filter(p => p.team === oppositeTeam);
    const allVoted = oppositeTeamMembers.length > 0 && oppositeTeamMembers.every(p => votes.some(([k]) => k === p.id));
    if (!allVoted) { autoResolveRef.current = false; return; }
    if (autoResolveRef.current) return;
    autoResolveRef.current = true;
    const timer = setTimeout(() => { resolveCounterVotes(); }, 1500);
    return () => clearTimeout(timer);
  }, [isHost, gs?.phase, gs?.counterVotes]);

  /* ─── Auto-proceed: reveal → next round after 5 seconds ─── */
  const autoNextRoundRef = useRef(false);
  useEffect(() => {
    if (!isHost || !gs || gs.phase !== "reveal") {
      autoNextRoundRef.current = false;
      return;
    }
    // Don't auto-advance if game is over (someone at 10+ and turns equal)
    const someoneAt10 = gs.scores[0] >= 10 || gs.scores[1] >= 10;
    const ttc = gs.teamTurnCount || { 0: 0, 1: 0 };
    const turnsEqual = (ttc[0] || 0) === (ttc[1] || 0);
    if (someoneAt10 && turnsEqual) {
      autoNextRoundRef.current = false;
      return;
    }
    if (autoNextRoundRef.current) return;
    autoNextRoundRef.current = true;
    const timer = setTimeout(() => { nextRound(); }, 5000);
    return () => clearTimeout(timer);
  }, [isHost, gs?.phase, gs?.scores, gs?.teamTurnCount]);

  /* ─── Turn notification chime ─── */
  const lastChimePhaseRef = useRef(null);
  useEffect(() => {
    if (!gs || !me || screen !== "game") return;
    const phase = gs.phase;
    if (phase === lastChimePhaseRef.current) return;
    lastChimePhaseRef.current = phase;
    // Chime when it's your turn to act
    const shouldChime =
      (phase === "clue" && gs.clueGiverId === playerId) ||
      (phase === "guess" && me.team === gs.activeTeam && gs.clueGiverId !== playerId) ||
      (phase === "counter_guess" && me.team !== gs.activeTeam);
    if (shouldChime) playChime();
  }, [gs?.phase, screen]);

  /* ─── Auto-scroll to top on phase change ─── */
  const lastScrollPhaseRef = useRef(null);
  useEffect(() => {
    if (!gs || screen !== "game") return;
    if (gs.phase === lastScrollPhaseRef.current) return;
    lastScrollPhaseRef.current = gs.phase;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [gs?.phase, screen]);

  /* ─── Countdown timer for auto-advance ─── */
  useEffect(() => {
    if (!gs || gs.phase !== "reveal") { setAutoAdvanceCountdown(null); return; }
    const someoneAt10 = gs.scores[0] >= 10 || gs.scores[1] >= 10;
    const ttc = gs.teamTurnCount || { 0: 0, 1: 0 };
    const turnsEqual = (ttc[0] || 0) === (ttc[1] || 0);
    if (someoneAt10 && turnsEqual) { setAutoAdvanceCountdown(null); return; }
    setAutoAdvanceCountdown(5);
    const interval = setInterval(() => {
      setAutoAdvanceCountdown(prev => {
        if (prev === null || prev <= 1) { clearInterval(interval); return null; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [gs?.phase, gs?.scores, gs?.teamTurnCount]);

  /* ─── Styles ─── */
  const sty = {
    app: { minHeight: "100vh", background: th.bg, fontFamily: "'Inter', sans-serif", color: th.text, padding: "18px 12px", display: "flex", flexDirection: "column", alignItems: "center", transition: "background 0.3s ease, color 0.3s ease" },
    card: { background: th.cardBg, border: `1px solid ${th.cardBorder}`, borderRadius: 22, padding: "28px 24px", maxWidth: 600, width: "100%", marginBottom: 16, backdropFilter: "blur(8px)", transition: "background 0.3s ease, border-color 0.3s ease" },
    btn: (c = th.accent) => ({ background: `linear-gradient(135deg, ${c}, ${c}bb)`, border: "none", borderRadius: 14, padding: "13px 30px", color: "#fff", fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 15, cursor: "pointer", letterSpacing: 0.5 }),
    btnO: (c = th.accent) => ({ background: "transparent", border: `2px solid ${c}`, borderRadius: 14, padding: "11px 24px", color: c, fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer" }),
    inp: { background: th.inputBg, border: `1px solid ${th.inputBorder}`, borderRadius: 14, padding: "14px 18px", color: th.text, fontSize: 16, fontFamily: "'Inter', sans-serif", width: "100%", outline: "none", boxSizing: "border-box", transition: "background 0.3s ease, border-color 0.3s ease, color 0.3s ease" },
    title: { fontFamily: "'Unbounded', sans-serif", fontSize: 40, fontWeight: 900, background: "linear-gradient(135deg, #ff6b6b, #ffd93d, #6bcbff, #c46bff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", textAlign: "center", letterSpacing: -1 },
    sub: { textAlign: "center", fontSize: 12, opacity: 0.4, letterSpacing: 4, textTransform: "uppercase", marginBottom: 24, marginTop: 2 },
    tag: (t) => ({ display: "inline-block", padding: "4px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", background: t === 0 ? th.tagRedBg : th.tagBlueBg, color: t === 0 ? th.red : th.blue, border: `1px solid ${t === 0 ? th.tagRedBorder : th.tagBlueBorder}` }),
  };

  const globalStyles = <style>{`
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
  `}</style>;

  const notifBanner = notification ? (
    <div style={{
      position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
      background: notifColor, color: "#fff", padding: "10px 24px",
      borderRadius: 14, fontSize: 15, fontFamily: "'Inter', sans-serif",
      fontWeight: 700, zIndex: 9999, maxWidth: 500, textAlign: "center",
      boxShadow: "0 4px 24px rgba(0,0,0,0.4)", animation: "fadeIn 0.3s ease",
    }}>
      {notification}
    </div>
  ) : null;

  const connectionBanner = !firebaseConnected ? (
    <div style={{
      position: "fixed", top: notification ? 56 : 16, left: "50%", transform: "translateX(-50%)",
      background: "#e65100", color: "#fff", padding: "8px 20px",
      borderRadius: 14, fontSize: 14, fontFamily: "'Inter', sans-serif",
      fontWeight: 700, zIndex: 9998, maxWidth: 500, textAlign: "center",
      boxShadow: "0 4px 24px rgba(0,0,0,0.4)", display: "flex", alignItems: "center", gap: 8,
    }}>
      <span style={{ animation: "pulse 1.5s ease-in-out infinite" }}>●</span> Connection lost — reconnecting...
    </div>
  ) : null;

  const helpButton = (
    <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 9998, display: "flex", gap: 8, alignItems: "center" }}>
      <button onClick={() => setSoundEnabled(s => !s)} style={{
        borderRadius: 50, padding: "10px 14px",
        background: th.helpBg, border: `2px solid ${th.helpBorder}`,
        color: "#fff", fontSize: 16, fontWeight: 700, fontFamily: "'Inter', sans-serif",
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 4px 20px rgba(108,99,255,0.4)", backdropFilter: "blur(8px)",
        width: 40, height: 40, opacity: soundEnabled ? 1 : 0.5,
      }} title={soundEnabled ? "Mute sounds" : "Unmute sounds"}>{soundEnabled ? "🔊" : "🔇"}</button>
      <button onClick={() => setThemeMode(m => m === "dark" ? "light" : "dark")} style={{
        borderRadius: 50, padding: "10px 14px",
        background: th.helpBg, border: `2px solid ${th.helpBorder}`,
        color: "#fff", fontSize: 16, fontWeight: 700, fontFamily: "'Inter', sans-serif",
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 4px 20px rgba(108,99,255,0.4)", backdropFilter: "blur(8px)",
        width: 40, height: 40,
      }}>{themeMode === "dark" ? "☀" : "🌙"}</button>
      <button onClick={() => setShowHelp(true)} style={{
        borderRadius: 50, padding: "10px 18px 10px 14px",
        background: th.helpBg, border: `2px solid ${th.helpBorder}`,
        color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "'Inter', sans-serif",
        cursor: "pointer", display: "flex", alignItems: "center", gap: 7,
        boxShadow: "0 4px 20px rgba(108,99,255,0.4)", backdropFilter: "blur(8px)",
      }}><span style={{ fontSize: 17, fontWeight: 900, lineHeight: 1 }}>?</span> How to Play</button>
    </div>
  );

  const helpModal = showHelp ? (
    <div onClick={() => setShowHelp(false)} style={{
      position: "fixed", inset: 0, zIndex: 10000,
      background: th.overlayBg, backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: th.modalBg,
        border: `1px solid ${th.modalBorder}`, borderRadius: 22,
        padding: "28px 26px", maxWidth: 480, width: "100%",
        maxHeight: "80vh", overflowY: "auto",
        color: th.text, fontFamily: "'Inter', sans-serif",
        boxShadow: "0 12px 48px rgba(0,0,0,0.6)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 22, fontWeight: 900, background: "linear-gradient(135deg, #ff6b6b, #ffd93d, #6bcbff, #c46bff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>How to Play</div>
          <button onClick={() => setShowHelp(false)} style={{ background: th.hoverBg, border: `1px solid ${th.inputBorder}`, borderRadius: 10, color: th.text, fontSize: 18, width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif" }}>✕</button>
        </div>

        <div style={{ fontSize: 14, lineHeight: 1.8, opacity: 0.85 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: th.gold, marginBottom: 6 }}>The Goal</div>
          <p style={{ margin: "0 0 16px" }}>Read your teammates' minds! A spectrum appears with two opposing concepts (e.g. Hot ↔ Cold). The clue giver sees a secret target on the dial and gives a one-word clue to hint where it falls.</p>

          <div style={{ fontWeight: 700, fontSize: 15, color: th.cyan, marginBottom: 6 }}>Each Round</div>
          <p style={{ margin: "0 0 6px" }}><span style={{ color: th.purple, fontWeight: 700 }}>1. Clue</span> — The clue giver sees the target on the dial and types a clue for their team.</p>
          <p style={{ margin: "0 0 6px" }}><span style={{ color: th.purple, fontWeight: 700 }}>2. Guess</span> — Teammates drag the needle to where they think the target is based on the clue.</p>
          <p style={{ margin: "0 0 6px" }}><span style={{ color: th.purple, fontWeight: 700 }}>3. Counter</span> — The opposing team votes whether the real target is to the left or right of the guess. If they're right, they earn a bonus point!</p>
          <p style={{ margin: "0 0 16px" }}><span style={{ color: th.purple, fontWeight: 700 }}>4. Reveal</span> — The target is revealed and points are awarded.</p>

          <div style={{ fontWeight: 700, fontSize: 15, color: "#4caf50", marginBottom: 6 }}>Scoring</div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <span style={{ background: "rgba(50,200,90,0.3)", border: "1px solid rgba(50,200,90,0.5)", borderRadius: 10, padding: "4px 14px", fontWeight: 700 }}>Bullseye = 4 pts</span>
            <span style={{ background: "rgba(250,200,30,0.25)", border: "1px solid rgba(250,200,30,0.4)", borderRadius: 10, padding: "4px 14px", fontWeight: 700 }}>Close = 3 pts</span>
            <span style={{ background: "rgba(240,100,40,0.25)", border: "1px solid rgba(240,100,40,0.4)", borderRadius: 10, padding: "4px 14px", fontWeight: 700 }}>Near = 2 pts</span>
          </div>

          <div style={{ fontWeight: 700, fontSize: 15, color: th.red, marginBottom: 6 }}>Winning</div>
          <p style={{ margin: "0 0 10px" }}>First team to <span style={{ fontWeight: 700, color: th.gold }}>10 points</span> wins! Teams alternate turns, and the clue giver rotates each round.</p>
          <p style={{ margin: 0, opacity: 0.75, fontSize: 13 }}>To keep things fair, both teams are guaranteed an equal number of turns. If a team reaches 10 points, the other team still gets to finish their turn for that round. If both teams end up tied at 10+, a tiebreaker round is played until one team comes out ahead.</p>
        </div>
      </div>
    </div>
  ) : null;

  /* ─── JOIN FROM URL SCREEN ─── */
  if (screen === "join_from_url") {
    const joinFromUrl = async () => {
      if (!playerName.trim()) { setError("Enter your name!"); return; }
      const state = await getGameState(urlCode);
      if (!state) { setError("Lobby not found!"); setScreen("menu"); window.history.replaceState(null, "", "/"); return; }
      // If the lobby exists but nobody is online, it's a stale orphan — clean it up
      if (await isLobbyStale(urlCode)) {
        await deleteLobby(urlCode);
        setError("That lobby has expired (all players left). Please create a new one!");
        setScreen("menu");
        window.history.replaceState(null, "", "/");
        return;
      }
      // Prune stale players who are in the players list but no longer online
      const cleaned = await pruneStalePlayersAndRejoin(urlCode, playerId);
      const current = cleaned || state;
      if (!current.players) current.players = [];
      if (!current.players.find(p => p.id === playerId)) {
        if (current.players.some(p => p.name.toLowerCase() === playerName.trim().toLowerCase())) {
          setError("That name is already taken in this lobby!"); return;
        }
        const inGame = current.phase && current.phase !== "lobby";
        const t = inGame ? -1 : (current.players.filter(p => p.team === 0).length <= current.players.filter(p => p.team === 1).length ? 0 : 1);
        current.players.push({ id: playerId, name: playerName.trim(), team: t });
        await setGameState(urlCode, current);
      }
      setLobbyCode(urlCode);
      setGs(current);
      setScreen(current.phase === "lobby" ? "lobby" : "game");
    };

    return (
      <div style={sty.app}>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Unbounded:wght@400;700;900&display=swap" rel="stylesheet" />
        {globalStyles}
        <div style={{ marginTop: 48 }}>
          <div style={sty.title}>WAVELENGTH</div>
          <div style={sty.sub}>Joining Room {urlCode}</div>
        </div>
        <div style={sty.card}>
          <div style={{ textAlign: "center", marginBottom: 16, fontSize: 15, opacity: 0.6 }}>
            You've been invited to join a game!
          </div>
          <input style={sty.inp} placeholder="Enter your name..." value={playerName} onChange={e => { setPlayerName(e.target.value); setError(""); }} maxLength={20}
            onKeyDown={e => e.key === "Enter" && joinFromUrl()} autoFocus />
          <button style={{ ...sty.btn(th.blue), width: "100%", marginTop: 14, padding: "14px" }} onClick={joinFromUrl}>
            Join Game
          </button>
          {error && <div style={{ color: th.red, marginTop: 10, fontSize: 15, textAlign: "center" }}>{error}</div>}
          <button style={{ ...sty.btnO("#666"), width: "100%", marginTop: 10, fontSize: 14 }} onClick={() => { setScreen("menu"); window.history.replaceState(null, "", "/"); }}>
            Back to Menu
          </button>
        </div>
        {helpButton}
        {helpModal}
      </div>
    );
  }

  /* ─── MENU SCREEN ─── */
  if (screen === "menu") {
    return (
      <div style={sty.app}>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Unbounded:wght@400;700;900&display=swap" rel="stylesheet" />
        {globalStyles}
        <div style={{ marginTop: 48 }}>
          <div style={sty.title}>WAVELENGTH</div>
          <div style={sty.sub}>Tune In Together</div>
        </div>
        <div style={sty.card}>
          <input style={sty.inp} placeholder="Your name..." value={playerName} onChange={e => { setPlayerName(e.target.value); setError(""); }} maxLength={20} />
          <div style={{ marginTop: 18, display: "flex", gap: 10, flexDirection: "column" }}>
            <button style={sty.btn(th.accent)} onClick={createLobby}>Create Lobby</button>
            <div style={{ display: "flex", gap: 8 }}>
              <input style={{ ...sty.inp, flex: 1, textTransform: "uppercase" }} placeholder="Lobby code..." value={joinCode} onChange={e => { setJoinCode(e.target.value); setError(""); }} maxLength={6} />
              <button style={sty.btn(th.blue)} onClick={joinLobby}>Join</button>
            </div>
          </div>
          {error && <div style={{ color: th.red, marginTop: 10, fontSize: 15, textAlign: "center" }}>{error}</div>}
        </div>
        <div style={{ fontSize: 14, opacity: 0.3, textAlign: "center", maxWidth: 380, lineHeight: 1.7, marginTop: 8 }}>
          One player gives a clue. Their team guesses where it falls on the spectrum. Score points by reading each other's wavelength!
        </div>
        <div style={{ marginTop: "auto", paddingTop: 40, paddingBottom: 8, fontSize: 12, opacity: 0.2, textAlign: "center", letterSpacing: 0.5 }}>
          wavelengthgame.me · Inspired by the board game Wavelength
        </div>
        {helpButton}
        {helpModal}
      </div>
    );
  }

  /* ─── LOBBY SCREEN ─── */
  if (screen === "lobby" && gs) {
    const t0 = gs.players.filter(p => p.team === 0);
    const t1 = gs.players.filter(p => p.team === 1);
    return (
      <div style={sty.app}>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Unbounded:wght@400;700;900&display=swap" rel="stylesheet" />
        {globalStyles}
        {notifBanner}
        {connectionBanner}
        {helpButton}
        {helpModal}
        <div style={sty.title}>WAVELENGTH</div>
        <div style={sty.sub}>Lobby</div>
        <div style={sty.card}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 13, opacity: 0.45, letterSpacing: 2, textTransform: "uppercase" }}>Share this link with friends</div>
            <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: 8, fontFamily: "'Unbounded', sans-serif", background: "linear-gradient(135deg, #ffd93d, #ff6b6b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginTop: 4 }}>{lobbyCode}</div>
            <div style={{ fontSize: 14, opacity: 0.4, marginTop: 6, wordBreak: "break-all" }}>{window.location.origin}/game/{lobbyCode}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 10 }}>
              <button style={{ ...sty.btnO(th.gold), fontSize: 13, padding: "6px 16px" }} onClick={() => { try { navigator.clipboard.writeText(`${window.location.origin}/game/${lobbyCode}`); showNotification("Link copied!", "#ffd93d"); } catch {} }}>Copy Link</button>
              <button style={{ ...sty.btnO(th.accent), fontSize: 13, padding: "6px 16px" }} onClick={() => { try { navigator.clipboard.writeText(lobbyCode); showNotification("Code copied!", "#6c63ff"); } catch {} }}>Copy Code</button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 16 }}>
            {[0, 1].map(team => {
              const members = team === 0 ? t0 : t1;
              return (
                <div key={team} style={{ background: team === 0 ? th.redBgLobby : th.blueBgLobby, border: `1px solid ${team === 0 ? th.redBorderLobby : th.blueBorderLobby}`, borderRadius: 16, padding: 14 }}>
                  {isHost ? (
                    <input
                      style={{ background: "transparent", border: "none", borderBottom: `1.5px dashed ${team === 0 ? th.red : th.blue}44`, fontSize: 15, fontWeight: 700, textAlign: "center", color: team === 0 ? th.red : th.blue, fontFamily: "'Inter', sans-serif", width: "100%", outline: "none", marginBottom: 10, padding: "2px 0" }}
                      value={gs.teams[team]}
                      onChange={e => {
                        const val = e.target.value.slice(0, 16);
                        update(s => ({ ...s, teams: s.teams.map((t, i) => i === team ? val : t) }));
                      }}
                      maxLength={16}
                      placeholder={team === 0 ? "Red Team" : "Blue Team"}
                    />
                  ) : (
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, textAlign: "center", color: team === 0 ? th.red : th.blue }}>{gs.teams[team]}</div>
                  )}
                  {members.map(p => (
                    <div key={p.id} style={{ padding: "5px 8px", marginBottom: 3, borderRadius: 8, fontSize: 15, background: th.hoverBg, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>{p.name}{p.id === playerId ? " (you)" : ""}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {p.id === gs.players[0].id && <span style={{ fontSize: 11, opacity: 0.45 }}>HOST</span>}
                        {isHost && p.id !== playerId && (
                          <button onClick={() => kickPlayer(p.id)} style={{ background: "rgba(255,90,60,0.15)", border: "1px solid rgba(255,90,60,0.3)", borderRadius: 6, color: th.red, fontSize: 12, padding: "2px 7px", cursor: "pointer", fontFamily: "'Inter', sans-serif", fontWeight: 700 }}>✕</button>
                        )}
                      </div>
                    </div>
                  ))}
                  {me?.team !== team && <button style={{ ...sty.btnO(team === 0 ? th.red : th.blue), width: "100%", marginTop: 8, fontSize: 13 }} onClick={() => switchTeam(playerId, team)}>Join</button>}
                </div>
              );
            })}
          </div>

          {/* Shuffle teams button (host only) */}
          {isHost && gs.players.length >= 4 && (
            <button style={{ ...sty.btnO(th.purple), width: "100%", marginTop: 12, fontSize: 13 }} onClick={async () => {
              const host = gs.players[0];
              const others = gs.players.slice(1).sort(() => Math.random() - 0.5);
              const all = [host, ...others];
              const half = Math.ceil(all.length / 2);
              // Randomly assign teams, then place host on a random team
              const hostTeam = Math.random() < 0.5 ? 0 : 1;
              const slots = { 0: hostTeam === 0 ? half - 1 : half, 1: hostTeam === 1 ? half - 1 : all.length - half };
              const newPlayers = [{ ...host, team: hostTeam }];
              for (const p of others) {
                const team = slots[0] > 0 ? 0 : 1;
                slots[team]--;
                newPlayers.push({ ...p, team });
              }
              await update(s => ({ ...s, players: newPlayers }));
              showNotification("Teams shuffled!", th.purple);
            }}>Shuffle Teams</button>
          )}

          {/* Uneven teams warning */}
          {isHost && t0.length >= 2 && t1.length >= 2 && Math.abs(t0.length - t1.length) >= 2 && (
            <div style={{ textAlign: "center", marginTop: 10, fontSize: 13, color: th.gold, opacity: 0.8 }}>
              ⚠ Teams are uneven ({t0.length} vs {t1.length})
            </div>
          )}
          {isHost ? (
            <>
              <button style={{ ...sty.btn(t0.length < 2 || t1.length < 2 ? th.red : "#4caf50"), width: "100%", marginTop: 18, padding: "14px", color: "#fff", cursor: t0.length < 2 || t1.length < 2 ? "not-allowed" : "pointer" }} onClick={startGame} disabled={t0.length < 2 || t1.length < 2}>
                {t0.length < 2 || t1.length < 2 ? "Need 2 players per team to begin" : "Start Game"}
              </button>
              <button style={{ ...sty.btnO(th.red), width: "100%", marginTop: 8, fontSize: 13 }} onClick={() => setShowDeleteConfirm(true)}>End Game & Delete Lobby</button>

              {/* Delete lobby confirmation modal */}
              {showDeleteConfirm && (
                <div onClick={() => setShowDeleteConfirm(false)} style={{
                  position: "fixed", inset: 0, zIndex: 10001,
                  background: th.overlayBg, backdropFilter: "blur(6px)",
                  display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
                }}>
                  <div onClick={e => e.stopPropagation()} style={{
                    background: th.modalBg,
                    border: `1px solid ${th.modalBorder}`, borderRadius: 22,
                    padding: "24px 26px", maxWidth: 360, width: "100%",
                    color: th.text, fontFamily: "'Inter', sans-serif",
                    boxShadow: "0 12px 48px rgba(0,0,0,0.6)", textAlign: "center",
                  }}>
                    <div style={{ fontSize: 18, fontWeight: 900, fontFamily: "'Unbounded', sans-serif", marginBottom: 10, color: th.red }}>Delete Lobby?</div>
                    <div style={{ fontSize: 14, opacity: 0.6, marginBottom: 18, lineHeight: 1.6 }}>
                      Are you sure? This will kick everyone and permanently delete the lobby.
                    </div>
                    <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                      <button style={{ ...sty.btnO("#888"), fontSize: 14, padding: "10px 22px" }} onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                      <button style={{ ...sty.btn(th.red), fontSize: 14, padding: "10px 22px" }} onClick={async () => { await deleteLobby(lobbyCode); setShowDeleteConfirm(false); setScreen("menu"); setGs(null); setLobbyCode(""); window.history.replaceState(null, "", "/"); }}>Delete</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : <div style={{ textAlign: "center", marginTop: 14 }}>
            <div style={{ opacity: 0.45, fontSize: 15, marginBottom: 8 }}>Waiting for host to start...</div>
            <button style={{ ...sty.btnO("#888"), fontSize: 13 }} onClick={leaveGame}>Leave Lobby</button>
          </div>}
        </div>
        <div style={{ fontSize: 13, opacity: 0.25 }}>{gs.players.length} player{gs.players.length !== 1 ? "s" : ""} connected</div>
      </div>
    );
  }

  /* ─── GAME SCREEN ─── */
  if (screen === "game" && gs) {
    const phase = gs.phase;
    const cg = gs.players.find(p => p.id === gs.clueGiverId);
    const lastR = history.length > 0 ? history[history.length - 1] : null;

    return (
      <div style={sty.app}>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Unbounded:wght@400;700;900&display=swap" rel="stylesheet" />
        {globalStyles}
        {notifBanner}
        {connectionBanner}
        {helpButton}
        {helpModal}
        <style>{`
          .wl-scroll::-webkit-scrollbar { width: 5px; }
          .wl-scroll::-webkit-scrollbar-track { background: transparent; }
          .wl-scroll::-webkit-scrollbar-thumb { background: ${th.scrollThumb}; border-radius: 10px; }
          .wl-scroll::-webkit-scrollbar-thumb:hover { background: ${th.scrollThumbHover}; }
          .wl-scroll { scrollbar-width: thin; scrollbar-color: ${th.scrollThumb} transparent; }
        `}</style>

        {/* Player menu (all players can leave, host has extra options) */}
        <div style={{ position: "fixed", top: 14, right: 14, zIndex: 9998 }}>
          <button onClick={() => setShowHostMenu(prev => !prev)} style={{
            background: th.hoverBg, border: `1px solid ${th.inputBorder}`,
            borderRadius: 10, color: th.text, fontSize: 18, width: 36, height: 36,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'Inter', sans-serif",
          }}>⚙</button>
          {showHostMenu && (
            <div style={{
              position: "absolute", top: 42, right: 0, background: th.menuBg,
              border: `1px solid ${th.menuBorder}`, borderRadius: 14, padding: 10,
              minWidth: 180, backdropFilter: "blur(12px)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              display: "flex", flexDirection: "column", gap: 6,
            }}>
              {isHost && (
                <button style={{ ...sty.btnO(th.red), width: "100%", fontSize: 13, padding: "8px 14px" }} onClick={async () => {
                  await update(s => ({ ...s, phase: "lobby", round: 0, scores: [0, 0], history: [null], clue: "", guesses: { _init: true }, usedSpectrums: null }));
                  setScreen("lobby");
                  setShowHostMenu(false);
                }}>End Game → Lobby</button>
              )}
              <button style={{ ...sty.btnO("#888"), width: "100%", fontSize: 13, padding: "8px 14px" }} onClick={() => {
                setShowHostMenu(false);
                setShowLeaveConfirm(true);
              }}>Leave Game</button>
            </div>
          )}
        </div>

        {/* Leave confirmation modal */}
        {showLeaveConfirm && (
          <div onClick={() => setShowLeaveConfirm(false)} style={{
            position: "fixed", inset: 0, zIndex: 10001,
            background: th.overlayBg, backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              background: th.modalBg,
              border: `1px solid ${th.modalBorder}`, borderRadius: 22,
              padding: "24px 26px", maxWidth: 360, width: "100%",
              color: th.text, fontFamily: "'Inter', sans-serif",
              boxShadow: "0 12px 48px rgba(0,0,0,0.6)", textAlign: "center",
            }}>
              <div style={{ fontSize: 18, fontWeight: 900, fontFamily: "'Unbounded', sans-serif", marginBottom: 10, color: th.red }}>Leave Game?</div>
              <div style={{ fontSize: 14, opacity: 0.6, marginBottom: 18, lineHeight: 1.6 }}>
                {(() => {
                  const myTeam = me?.team;
                  const myTeamCount = gs.players.filter(p => p.team === myTeam).length;
                  if (myTeamCount <= 2) {
                    return "Your team only has 2 players. If you leave, the game will end for everyone.";
                  }
                  return "Are you sure you want to leave the game?";
                })()}
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button style={{ ...sty.btnO("#888"), padding: "10px 24px", fontSize: 14 }} onClick={() => setShowLeaveConfirm(false)}>Cancel</button>
                <button style={{ ...sty.btn(th.red), padding: "10px 24px", fontSize: 14 }} onClick={() => { setShowLeaveConfirm(false); leaveGame(); }}>Leave</button>
              </div>
            </div>
          </div>
        )}
        <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Unbounded', sans-serif", letterSpacing: 3, opacity: 0.6 }}>ROUND {gs.round}</div>
        <ScoreBar scores={gs.scores} teamNames={gs.teams} theme={th} />

        <div style={sty.card}>
          {gs.spectrum && (
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, padding: "0 12px" }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: th.red, fontFamily: "'Unbounded', sans-serif" }}>{gs.spectrum[0]}</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: th.blue, fontFamily: "'Unbounded', sans-serif" }}>{gs.spectrum[1]}</span>
            </div>
          )}

          <Dial
            targetAngle={gs.targetAngle}
            guessAngle={phase === "guess" && isMyTurn && !isClueGiver ? (gs.guesses?.[playerId] ?? guessAngle) : null}
            teamGuessAngle={(phase === "reveal" || phase === "counter_guess") ? gs.teamGuessAngle : null}
            individualGuesses={phase === "reveal" && gs.guesses ? Object.entries(gs.guesses).filter(([k]) => k !== "_init").map(([, a]) => ({ angle: a })) : null}
            onGuess={setGuessAngle}
            revealed={phase === "reveal"}
            showTarget={isClueGiver && (phase === "clue" || phase === "guess")}
            interactive={phase === "guess" && isMyTurn && !isClueGiver && !myGuessed}
            theme={th}
          />

          <div style={{ textAlign: "center", margin: "8px 0 12px" }}>
            <span style={sty.tag(gs.activeTeam)}>{gs.teams[gs.activeTeam]}'s turn</span>
            {me?.team === -1 && <div style={{ fontSize: 12, opacity: 0.5, marginTop: 6 }}>You're spectating — you'll join a team next game</div>}
          </div>

          {/* Phase stepper */}
          {(() => {
            const phases = [
              { key: "clue", label: "Clue" },
              { key: "guess", label: "Guess" },
              { key: "counter_guess", label: "Counter" },
              { key: "reveal", label: "Reveal" },
            ];
            const currentIdx = phases.findIndex(p => p.key === phase);
            return (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 0, marginBottom: 14 }}>
                {phases.map((p, i) => {
                  const isActive = i === currentIdx;
                  const isDone = i < currentIdx;
                  return (
                    <div key={p.key} style={{ display: "flex", alignItems: "center" }}>
                      <div style={{
                        padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase",
                        background: isActive ? `${th.gold}33` : isDone ? th.hoverBg : "transparent",
                        color: isActive ? th.gold : isDone ? th.textMuted : `${th.text}33`,
                        border: isActive ? `1px solid ${th.gold}66` : "1px solid transparent",
                      }}>{p.label}</div>
                      {i < phases.length - 1 && <div style={{ width: 16, height: 1, background: isDone ? th.textMuted : th.separatorColor }} />}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {phase === "clue" && (
            <div style={{ textAlign: "center" }}>
              {isClueGiver ? (
                <>
                  <div style={{ fontSize: 15, marginBottom: 6, opacity: 0.65 }}>You're the clue giver! The target is on the dial.</div>
                  <div style={{ fontSize: 14, opacity: 0.4, marginBottom: 12 }}>Give a clue that hints where the target falls on the spectrum.</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input style={{ ...sty.inp, flex: 1 }} placeholder="Your clue..." value={clueInput} onChange={e => setClueInput(e.target.value)} onKeyDown={e => e.key === "Enter" && submitClue()} maxLength={50} />
                    <button style={sty.btn(th.gold)} onClick={submitClue}>Send</button>
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.35, marginTop: 6, textAlign: "right" }}>{clueInput.length}/50</div>
                </>
              ) : (
                <div>
                  <div style={{ fontSize: 20, fontWeight: 900, fontFamily: "'Unbounded', sans-serif", marginBottom: 6 }}>
                    <span style={{ color: gs.activeTeam === 0 ? th.red : th.blue }}>{cg?.name || "Clue giver"}</span>
                    <span style={{ color: th.text }}> is thinking...</span>
                  </div>
                  <div style={{ fontSize: 15, opacity: 0.45 }}>Waiting for their clue</div>
                </div>
              )}
            </div>
          )}

          {phase === "guess" && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 900, fontFamily: "'Unbounded', sans-serif", color: th.gold, marginBottom: 8 }}>"{gs.clue}"</div>
              <div style={{ fontSize: 14, opacity: 0.4, marginBottom: 14 }}>— clue by {cg?.name}</div>
              {isMyTurn && !isClueGiver && !myGuessed && (
                <>
                  <div style={{ fontSize: 15, marginBottom: 10, opacity: 0.6 }}>Drag the needle to your guess!</div>
                  <button style={sty.btn(th.cyan)} onClick={submitGuess}>Lock In Guess</button>
                </>
              )}
              {myGuessed && <div style={{ fontSize: 15, color: th.cyan }}>Guess locked in ✓</div>}
              {isClueGiver && <div style={{ fontSize: 15, opacity: 0.5 }}>Waiting for your team to guess...</div>}
              {!isMyTurn && <div style={{ fontSize: 15, opacity: 0.5 }}>Other team is guessing...</div>}
              {(() => {
                const teamGuessers = gs.players.filter(p => p.team === gs.activeTeam && p.id !== gs.clueGiverId);
                const totalNeeded = teamGuessers.length;
                const guessedCount = teamGuessers.filter(p => realGuesses.some(([k]) => k === p.id)).length;
                return <div style={{ marginTop: 10, fontSize: 16, fontWeight: 700, color: guessedCount === totalNeeded ? "#4caf50" : th.textMuted, background: th.hoverBg, borderRadius: 12, padding: "6px 18px", display: "inline-block" }}>
                  Guesses: {guessedCount}/{totalNeeded}
                </div>;
              })()}
              {allTeamGuessed && (
                <div style={{ marginTop: 10, fontSize: 15, fontWeight: 700, color: th.purple, animation: "pulse 1.5s ease-in-out infinite" }}>
                  All guesses in — revealing...
                </div>
              )}
            </div>
          )}

          {phase === "counter_guess" && lastR && (() => {
            const oppositeTeam = gs.activeTeam === 0 ? 1 : 0;
            const isOppositeTeam = me?.team === oppositeTeam;
            const spectrumLeft = gs.spectrum?.[0];
            const spectrumRight = gs.spectrum?.[1];
            const votes = gs.counterVotes ? Object.entries(gs.counterVotes).filter(([k]) => k !== "_init") : [];
            const myVote = votes.find(([k]) => k === playerId)?.[1] || null;
            const leftVotes = votes.filter(([, v]) => v === "left").length;
            const rightVotes = votes.filter(([, v]) => v === "right").length;
            const totalVotes = leftVotes + rightVotes;
            const oppositeTeamMembers = gs.players.filter(p => p.team === oppositeTeam);
            const allVoted = oppositeTeamMembers.every(p => votes.some(([k]) => k === p.id));
            return (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 900, fontFamily: "'Unbounded', sans-serif", color: th.gold, marginBottom: 4 }}>"{gs.clue}"</div>
                <div style={{ fontSize: 14, opacity: 0.4, marginBottom: 14 }}>— clue by {cg?.name}</div>
                <div style={{ display: "flex", justifyContent: "center", gap: 20, marginBottom: 12, fontSize: 14 }}>
                  <span style={{ color: th.text }}>● {gs.teams[gs.activeTeam]}'s Guess</span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, fontFamily: "'Unbounded', sans-serif", color: th.gold, marginBottom: 4 }}>
                  {gs.teams[oppositeTeam]} — Vote!
                </div>
                <div style={{ fontSize: 14, opacity: 0.5, marginBottom: 16 }}>
                  Is the real target to the left ({spectrumLeft}) or right ({spectrumRight}) of their guess?
                </div>
                {isOppositeTeam && !myVote && (
                  <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 12 }}>
                    <button style={{ ...sty.btn(th.red), padding: "12px 32px" }} onClick={() => submitCounterVote("left")}>
                      ◄ {spectrumLeft}
                    </button>
                    <button style={{ ...sty.btn(th.blue), padding: "12px 32px" }} onClick={() => submitCounterVote("right")}>
                      {spectrumRight} ►
                    </button>
                  </div>
                )}
                {isOppositeTeam && myVote && (
                  <div style={{ fontSize: 15, color: th.purple, marginBottom: 12 }}>
                    You voted: <strong>{myVote === "left" ? `◄ ${spectrumLeft}` : `${spectrumRight} ►`}</strong>
                  </div>
                )}
                {/* Vote tally */}
                {totalVotes > 0 && (
                  <div style={{ background: th.hoverBg, borderRadius: 12, padding: "10px 16px", marginBottom: 12, maxWidth: 300, marginLeft: "auto", marginRight: "auto" }}>
                    <div style={{ fontSize: 13, opacity: 0.45, marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" }}>Votes</div>
                    <div style={{ display: "flex", gap: 20, justifyContent: "center", fontSize: 15, fontWeight: 700 }}>
                      <span style={{ color: th.red }}>◄ {spectrumLeft}: {leftVotes}</span>
                      <span style={{ color: th.blue }}>{spectrumRight} ►: {rightVotes}</span>
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.35, marginTop: 4 }}>{totalVotes} of {oppositeTeamMembers.length} voted</div>
                  </div>
                )}
                {!isOppositeTeam && totalVotes === 0 && (
                  <div style={{ fontSize: 15, opacity: 0.5 }}>Waiting for {gs.teams[oppositeTeam]} to vote...</div>
                )}
                {allVoted && totalVotes > 0 && (
                  <div style={{ marginTop: 8, fontSize: 15, fontWeight: 700, color: th.accent, animation: "pulse 1.5s ease-in-out infinite" }}>
                    All votes in — revealing target...
                  </div>
                )}
                {isHost && !allVoted && (
                  <button style={{ ...sty.btnO("#666"), marginTop: 10, fontSize: 13 }} onClick={skipCounterGuess}>Skip → Reveal Target</button>
                )}
              </div>
            );
          })()}

          {phase === "reveal" && lastR && (
            <div style={{ textAlign: "center" }}>
              {/* Legend */}
              <div style={{ display: "flex", justifyContent: "center", gap: 20, marginBottom: 12, fontSize: 14 }}>
                <span style={{ color: th.text }}>● Team's Guess</span>
                <span style={{ color: th.gold }}>● Target</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, fontFamily: "'Unbounded', sans-serif", color: th.text, marginBottom: 2 }}>
                {lastR.points === 4 ? "BULLSEYE!" : lastR.points === 3 ? "CLOSE!" : lastR.points === 2 ? "Not Bad!" : "Missed!"}
              </div>
              <div style={{ fontSize: 44, fontWeight: 900, fontFamily: "'Unbounded', sans-serif", color: lastR.points === 4 ? "#4caf50" : lastR.points === 3 ? "#66bb6a" : lastR.points === 2 ? "#ffa94d" : th.red }}>+{lastR.points}</div>
              <div style={{ fontSize: 14, opacity: 0.4, margin: "4px 0 14px" }}>Clue: "{lastR.clue}"</div>

              {/* Counter-guess result */}
              {gs.counterGuessResolved && gs.counterGuess && (() => {
                const oppositeTeam = gs.activeTeam === 0 ? 1 : 0;
                const tally = gs.counterVoteTally;
                return (
                  <div style={{ background: gs.counterGuessCorrect ? "rgba(76,175,80,0.15)" : "rgba(255,107,91,0.12)", border: `1px solid ${gs.counterGuessCorrect ? "rgba(76,175,80,0.4)" : "rgba(255,107,91,0.3)"}`, borderRadius: 14, padding: "10px 18px", marginBottom: 14 }}>
                    <div style={{ fontSize: 14, opacity: 0.7 }}>
                      {gs.teams[oppositeTeam]} voted <strong>{gs.counterGuess === "left" ? `◄ ${gs.spectrum[0]}` : `${gs.spectrum[1]} ►`}</strong>
                      {tally && <span style={{ opacity: 0.5 }}> ({tally.left} left, {tally.right} right{tally.left === tally.right ? " — tie broken randomly" : ""})</span>}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 900, fontFamily: "'Unbounded', sans-serif", color: gs.counterGuessCorrect ? "#4caf50" : th.red, marginTop: 4 }}>
                      {gs.counterGuessCorrect ? "Correct! +1 bonus point" : "Wrong!"}
                    </div>
                  </div>
                );
              })()}

              {(() => {
                const someoneAt10 = gs.scores[0] >= 10 || gs.scores[1] >= 10;
                if (!someoneAt10) {
                  return <div style={{ fontSize: 14, opacity: 0.5, marginTop: 6, animation: "pulse 1.5s ease-in-out infinite" }}>
                    Next round {autoAdvanceCountdown ? `in ${autoAdvanceCountdown}s` : "starting soon"}...
                  </div>;
                }
                const ttc = gs.teamTurnCount || { 0: 0, 1: 0 };
                const turnsEqual = (ttc[0] || 0) === (ttc[1] || 0);
                if (!turnsEqual) {
                  const behindTeam = (ttc[0] || 0) < (ttc[1] || 0) ? 0 : 1;
                  return <>
                    <div style={{ fontSize: 15, opacity: 0.7, marginBottom: 10, color: th.gold }}>
                      {gs.teams[behindTeam]} still gets their turn this round!
                    </div>
                    <div style={{ fontSize: 14, opacity: 0.5, animation: "pulse 1.5s ease-in-out infinite" }}>
                      Continuing {autoAdvanceCountdown ? `in ${autoAdvanceCountdown}s` : "automatically"}...
                    </div>
                  </>;
                }
                const winner = gs.scores[0] > gs.scores[1] ? 0 : gs.scores[1] > gs.scores[0] ? 1 : -1;
                if (winner === -1) {
                  return <>
                    <div style={{ fontSize: 20, fontWeight: 900, fontFamily: "'Unbounded', sans-serif", color: th.gold, marginBottom: 6 }}>
                      TIE! {gs.scores[0]} – {gs.scores[1]}
                    </div>
                    <div style={{ fontSize: 14, opacity: 0.6, marginBottom: 10 }}>Tiebreaker round!</div>
                    {isHost && <button style={sty.btn(th.accent)} onClick={nextRound}>Tiebreaker Round →</button>}
                    {!isHost && <div style={{ fontSize: 14, opacity: 0.4, marginTop: 6 }}>Waiting for host...</div>}
                  </>;
                }
                return <div>
                  <div style={{ fontSize: 28, fontWeight: 900, fontFamily: "'Unbounded', sans-serif", color: winner === 0 ? th.red : th.blue, marginBottom: 10 }}>
                    {gs.teams[winner]} WIN!
                  </div>
                  <div style={{ fontSize: 14, opacity: 0.5, marginBottom: 14 }}>{gs.scores[0]} – {gs.scores[1]}</div>

                  {/* Game summary */}
                  <div style={{ background: th.hoverBg, borderRadius: 14, padding: "12px 16px", marginBottom: 14, textAlign: "left", fontSize: 14, lineHeight: 1.8 }}>
                    <div style={{ fontSize: 12, opacity: 0.4, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6, textAlign: "center" }}>Game Summary</div>
                    <div style={{ opacity: 0.7 }}>Rounds played: <strong>{gs.round}</strong></div>
                    {(() => {
                      // Find best clue (highest points)
                      const best = history.reduce((a, b) => (b.points > a.points ? b : a), history[0]);
                      if (best) return <div style={{ opacity: 0.7 }}>Best clue: <strong>"{best.clue}"</strong> <span style={{ color: th.gold }}>+{best.points}</span> <span style={{ opacity: 0.4 }}>({best.spectrum[0]} ↔ {best.spectrum[1]})</span></div>;
                      return null;
                    })()}
                    {(() => {
                      // Bullseye count
                      const bulls = history.filter(h => h.points === 4).length;
                      if (bulls > 0) return <div style={{ opacity: 0.7 }}>Bullseyes: <strong style={{ color: th.gold }}>{bulls}</strong></div>;
                      return null;
                    })()}
                  </div>

                  <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                    {isHost && <button style={sty.btn("#4caf50")} onClick={async () => {
                      await update(s => ({ ...s, phase: "lobby", round: 0, scores: [0, 0], history: [null], clue: "", guesses: { _init: true }, usedSpectrums: null }));
                      setScreen("lobby");
                    }}>Rematch</button>}
                    {isHost && <button style={sty.btnO(th.accent)} onClick={async () => { await update(s => ({ ...s, phase: "lobby", round: 0, scores: [0, 0], history: [null], clue: "", guesses: { _init: true }, usedSpectrums: null })); setScreen("lobby"); }}>Back to Lobby</button>}
                    {!isHost && <div style={{ fontSize: 14, opacity: 0.4, marginTop: 6 }}>Waiting for host...</div>}
                  </div>
                </div>;
              })()}
            </div>
          )}
        </div>

        {/* Team player panels */}
        <div style={{ display: "flex", gap: 10, width: "100%", maxWidth: 580, marginBottom: 10, marginTop: 4, justifyContent: "center" }}>
          {[0, 1].map(team => {
            const teamPlayers = gs.players.filter(p => p.team === team);
            const teamColor = team === 0 ? th.red : th.blue;
            const teamBg = team === 0 ? th.redBg : th.blueBg;
            const teamBorder = team === 0 ? th.redBorder : th.blueBorder;
            return (
              <div key={team} style={{ flex: 1, background: teamBg, border: `1px solid ${teamBorder}`, borderRadius: 14, padding: "10px 12px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: teamColor, opacity: 0.7, marginBottom: 6, textAlign: "center" }}>{gs.teams[team]}</div>
                <div className="wl-scroll" style={{ maxHeight: teamPlayers.length > 4 ? 120 : "none", overflowY: teamPlayers.length > 4 ? "auto" : "visible" }}>
                {teamPlayers.map(p => {
                  const isCg = p.id === gs.clueGiverId;
                  return (
                    <div key={p.id} style={{
                      padding: "4px 8px", marginBottom: 2, borderRadius: 8, fontSize: 14,
                      background: isCg ? `${teamColor}22` : "transparent",
                      border: isCg ? `1.5px solid ${teamColor}55` : "1.5px solid transparent",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}>
                      <span style={{ opacity: isCg ? 1 : 0.6, fontWeight: isCg ? 700 : 400 }}>
                        {p.name}{p.id === playerId ? " (you)" : ""}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        {isCg && <span style={{ fontSize: 11, fontWeight: 700, color: teamColor, letterSpacing: 0.5 }}>CLUE</span>}
                        {isHost && p.id !== playerId && (
                          <button onClick={() => kickPlayer(p.id)} title={`Kick ${p.name}`} style={{ background: "rgba(255,90,60,0.15)", border: "1px solid rgba(255,90,60,0.3)", borderRadius: 6, color: th.red, fontSize: 11, padding: "1px 5px", cursor: "pointer", fontFamily: "'Inter', sans-serif", fontWeight: 700, lineHeight: 1.2 }}>✕</button>
                        )}
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Spectator panel */}
        {gs.players.some(p => p.team === -1) && (
          <div style={{ width: "100%", maxWidth: 580, marginBottom: 10 }}>
            <div style={{ background: th.cardBg, border: `1px solid ${th.cardBorder}`, borderRadius: 14, padding: "8px 12px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", opacity: 0.4, marginBottom: 4, textAlign: "center" }}>Spectators</div>
              {gs.players.filter(p => p.team === -1).map(p => (
                <div key={p.id} style={{ padding: "3px 8px", fontSize: 13, opacity: 0.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>{p.name}{p.id === playerId ? " (you)" : ""}</span>
                  {isHost && p.id !== playerId && (
                    <button onClick={() => kickPlayer(p.id)} title={`Kick ${p.name}`} style={{ background: "rgba(255,90,60,0.15)", border: "1px solid rgba(255,90,60,0.3)", borderRadius: 6, color: th.red, fontSize: 11, padding: "1px 5px", cursor: "pointer", fontFamily: "'Inter', sans-serif", fontWeight: 700, lineHeight: 1.2 }}>✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div style={{ ...sty.card, padding: "14px 18px" }}>
            <div style={{ fontSize: 13, opacity: 0.35, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>History</div>
            <div className="wl-scroll" style={{ maxHeight: 200, overflowY: "auto" }}>
            {history.slice().reverse().map((h, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: `1px solid ${th.separatorColor}`, fontSize: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={sty.tag(h.team)}>{gs.teams[h.team]}</span>
                  <span style={{ opacity: 0.65 }}>"{h.clue}"</span>
                  {h.clueGiver && <span style={{ opacity: 0.35, fontSize: 12 }}>by {h.clueGiver}</span>}
                  <span style={{ opacity: 0.3, fontSize: 12 }}>({h.spectrum[0]} ↔ {h.spectrum[1]})</span>
                </div>
                <span style={{ fontWeight: 700, color: h.points >= 3 ? th.gold : h.points >= 1 ? "#ffa94d" : th.red, whiteSpace: "nowrap" }}>+{h.points}</span>
              </div>
            ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={sty.app}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Unbounded:wght@400;700;900&display=swap" rel="stylesheet" />
      {globalStyles}
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .wl-skeleton {
          background: linear-gradient(90deg, ${th.cardBg} 25%, ${th.inputBg} 50%, ${th.cardBg} 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s ease-in-out infinite;
          border-radius: 14px;
        }
      `}</style>
      <div style={{ marginTop: 48, textAlign: "center" }}>
        <div style={sty.title}>WAVELENGTH</div>
        <div style={sty.sub}>Connecting...</div>
      </div>
      <div style={{ maxWidth: 600, width: "100%", display: "flex", flexDirection: "column", gap: 12, marginTop: 10 }}>
        <div className="wl-skeleton" style={{ height: 56, width: "100%" }} />
        <div className="wl-skeleton" style={{ height: 120, width: "100%" }} />
        <div className="wl-skeleton" style={{ height: 44, width: "60%", alignSelf: "center" }} />
      </div>
    </div>
  );
}