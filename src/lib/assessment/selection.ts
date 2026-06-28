import "server-only";
import { WORDS } from "./words";

/**
 * Server-only helpers for presenting the word list. `shuffledWordList` reads the
 * mapping-bearing `WORDS` array, so this module must never reach the client
 * (ADR-0009) — the client gets the already-shuffled plain strings as props. The
 * client-safe submission gate lives in `constants.ts` and is re-exported here
 * for server-side callers that already import from `selection`.
 */

export { isWithinSelectionRange } from "./constants";

/**
 * Fisher–Yates shuffle returning a new array; the input is never mutated. The
 * RNG is injectable so the shuffle is deterministic (and therefore testable)
 * under a seeded source while defaulting to `Math.random` in the app.
 */
export function shuffle<T>(
  items: readonly T[],
  random: () => number = Math.random,
): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The flat, unlabeled word list in a freshly shuffled order — the exact thing the
 * Subject sees. Only the words are returned; the tribe mapping never leaves the
 * server-side scoring core. Re-shuffled on every call so ordering can't nudge
 * choices (PRD story 5).
 */
export function shuffledWordList(random: () => number = Math.random): string[] {
  return shuffle(
    WORDS.map((w) => w.word),
    random,
  );
}
