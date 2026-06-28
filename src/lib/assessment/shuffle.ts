/**
 * Deterministic, seeded shuffle for presenting the assessment word list.
 *
 * The words must be shown in a different order each session so ordering never
 * nudges a participant's choices (PRD story 5) — but the order also has to be
 * stable *within* a render: the server and client must agree (no hydration
 * mismatch) and the words must not jump around while being selected. A seed
 * threads both needs. The server picks a fresh seed per visit (giving a new
 * order each session) and hands it to the client, and because the same seed
 * always yields the same permutation, both sides reproduce the same order.
 *
 * Pure and dependency-free so it is trivially unit-testable.
 */

/**
 * Mulberry32: a small, fast PRNG mapping a 32-bit seed to a deterministic
 * stream of values in [0, 1). Good enough for cosmetic shuffling (it is not
 * cryptographic) and self-contained so the shuffle needs no dependencies.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Return a new array with `items` shuffled by a Fisher–Yates pass driven by
 * `seed`. Deterministic for a given seed and never mutates the input.
 */
export function shuffleWithSeed<T>(items: readonly T[], seed: number): T[] {
  const out = items.slice();
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
