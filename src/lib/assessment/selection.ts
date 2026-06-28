import { MAX_WORDS, MIN_WORDS, WORDS } from "./words";

/**
 * Pure helpers for presenting the word list and gating submission. Kept separate
 * from the scoring core (`score.ts`) and the word data (`words.ts`) so the
 * selection UI and the server-side submission guard share one source of truth
 * and can be unit-tested without React, the DB, or auth.
 */

/**
 * Whether a selection of `count` words may be submitted. The Subject must pick
 * within the soft range (`MIN_WORDS`–`MAX_WORDS`): too few yields a noisy result,
 * too many flattens the signal. The same gate is applied client-side (to enable
 * the submit button) and server-side (to reject out-of-range submissions), so it
 * lives here once.
 */
export function isWithinSelectionRange(count: number): boolean {
  return count >= MIN_WORDS && count <= MAX_WORDS;
}

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
