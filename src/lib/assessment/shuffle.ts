/**
 * Fisher–Yates shuffle that returns a new array and never mutates its input.
 *
 * The RNG is injectable so the shuffle is deterministic under test; in
 * production it defaults to `Math.random`, giving each session a fresh order.
 * The assessment word list must be presented in a different order each session
 * (ASSESSMENT_DESIGN.md / PRD story 5) so that ordering never nudges a
 * participant's choices.
 */
export function shuffle<T>(
  items: readonly T[],
  rng: () => number = Math.random,
): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
