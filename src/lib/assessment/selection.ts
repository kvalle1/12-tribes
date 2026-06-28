import { WORDS, MIN_WORDS, MAX_WORDS } from "./words";

/**
 * Selection helpers shared by the selection UI's submission guard and the
 * server action's defense-in-depth validation. Kept pure (no I/O, no React) so
 * the rules live in one place and are unit-tested directly.
 */

const VALID_WORDS = new Set(WORDS.map((w) => w.word));

/**
 * Normalize a raw, client-supplied selection into a trustworthy list: drop
 * unknown words (exact match against the word list) and duplicates, preserving
 * first-seen order. The selection UI already gates submission, but the server
 * must never trust the client — this is the filter the server action runs
 * before scoring.
 */
export function normalizeSelection(raw: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const word of raw) {
    if (!VALID_WORDS.has(word) || seen.has(word)) continue;
    seen.add(word);
    out.push(word);
  }
  return out;
}

/**
 * Whether a selection count is within the submittable range. The soft 8–15
 * bound (words.ts) gates submission so a result is statistically meaningful;
 * the same constraint applies to Observers (#8) so self and observer scores
 * stay comparable.
 */
export function isSubmittable(count: number): boolean {
  return count >= MIN_WORDS && count <= MAX_WORDS;
}
